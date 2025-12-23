
const API_URL = 'https://api-loopi.onrender.com/api/auspiciantes';

const gridAuspiciantes = document.getElementById('gridAuspiciantes');
const searchInput = document.getElementById('buscarAusp');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('formAusp');
const btnNuevo = document.getElementById('btnNuevoAusp');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');

const inpId = document.getElementById('idAusp');
const inpNombre = document.getElementById('nombreAusp');
const inpCodigo = document.getElementById('codigoAusp');
const inpDescripcion = document.getElementById('descripcionAusp');

// Imagen
const btnImagen = document.getElementById('btnImagenAusp');
const inputImagen = document.getElementById('imagenAusp');
const previewImagen = document.getElementById('previewAusp');

let auspiciantesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    listarAuspiciantes();

    if(btnNuevo) btnNuevo.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    const cerrar = () => { if(modalOverlay) modalOverlay.style.display = 'none'; };
    if(btnCerrarModal) btnCerrarModal.addEventListener('click', cerrar);
    if(btnCancelar) btnCancelar.addEventListener('click', cerrar);

    if(btnImagen) btnImagen.addEventListener('click', () => inputImagen.click());
    if(inputImagen) inputImagen.addEventListener('change', procesarImagen);

    if(form) form.addEventListener('submit', guardarAuspiciante);

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase().trim();
            if(!auspiciantesCache) return;
            const filtrados = auspiciantesCache.filter(a => {
                const nombre = a.nombre ? a.nombre.toLowerCase() : "";
                const codigo = a.codigo ? a.codigo.toLowerCase() : "";
                return nombre.includes(termino) || codigo.includes(termino);
            });
            renderizarGrid(filtrados);
        });
    }
});

async function listarAuspiciantes() {
    try {
        gridAuspiciantes.innerHTML = '<p style="text-align:center;">Cargando...</p>';
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Datos inválidos");

        auspiciantesCache = data;
        renderizarGrid(data);
    } catch (error) {
        console.error(error);
        if(gridAuspiciantes) gridAuspiciantes.innerHTML = '<p style="text-align:center; color:red;">No se pudo conectar.</p>';
    }
}

async function guardarAuspiciante(e) {
    e.preventDefault();

    const nombre = inpNombre.value.trim();
    const codigo = inpCodigo.value.trim();
    const desc = inpDescripcion.value.trim();
    const imagenSrc = previewImagen.src;

    if (!nombre || nombre.length < 3) return alert("El nombre es muy corto.");
    if (!codigo) return alert("El código es obligatorio.");
    if (!desc) return alert("La descripción es obligatoria.");

    if (imagenSrc.includes("flaticon")) {
        return alert("⚠️ Debes subir una imagen para el auspiciante.");
    }

    const id = inpId.value;
    
    const data = {
        nombre: nombre,
        codigo: codigo,
        descripcion: desc,
        imagen: imagenSrc // Base64
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const btnSubmit = form.querySelector('button[type="submit"]');
        if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerText = "Guardando..."; }

        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            modalOverlay.style.display = 'none';
            listarAuspiciantes();
            alert(id ? 'Actualizado correctamente' : 'Creado correctamente');
        } else {
            const errorText = await response.text();
            alert('Error al guardar: ' + errorText);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión.');
    } finally {
        const btnSubmit = form.querySelector('button[type="submit"]');
        if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "Guardar"; }
    }
}

window.eliminarAuspiciante = async function(id) {
    if (!id || !confirm('¿Eliminar auspiciante?')) return;
    try {
        const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (res.ok || res.status === 204) listarAuspiciantes();
        else alert('No se pudo eliminar.');
    } catch (error) { console.error(error); }
};

window.cargarEdicion = function(id) {
    if (!auspiciantesCache) return;
    const item = auspiciantesCache.find(a => a.id_auspiciante == id);
    if (!item) return;

    inpId.value = item.id_auspiciante;
    inpNombre.value = item.nombre || "";
    inpCodigo.value = item.codigo || "";
    inpDescripcion.value = item.descripcion || "";

    if (item.imagen && item.imagen.length > 50) {
        previewImagen.src = item.imagen.startsWith('data:image') 
            ? item.imagen 
            : `data:image/png;base64,${item.imagen}`;
    } else {
        previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/747/747543.png';
    }

    const title = document.getElementById('modalTitle');
    if(title) title.innerText = 'Editar Auspiciante';
    
    if(modalOverlay) modalOverlay.style.display = 'flex';
};

function renderizarGrid(lista) {
    if(!gridAuspiciantes) return;
    gridAuspiciantes.innerHTML = '';

    if (!lista || lista.length === 0) {
        gridAuspiciantes.innerHTML = '<p style="text-align:center; width:100%; color:#666;">No hay resultados.</p>';
        return;
    }

    lista.forEach(item => {
        const nombre = escapeHtml(item.nombre || "Sin Nombre");
        const codigo = escapeHtml(item.codigo || "N/A");
        const desc = escapeHtml(item.descripcion || "Sin descripción");
        const id = item.id_auspiciante;

        let imgUrl = 'https://cdn-icons-png.flaticon.com/512/747/747543.png';
        if (item.imagen && item.imagen.length > 50) {
            imgUrl = item.imagen.startsWith('data:image') ? item.imagen : `data:image/png;base64,${item.imagen}`;
        }

        const card = document.createElement('div');
        card.className = 'card-ausp';
        card.innerHTML = `
            <img src="${imgUrl}" alt="Logo" onerror="this.src='https://cdn-icons-png.flaticon.com/512/747/747543.png'">
            <h3>${nombre}</h3>
            <p style="font-size:12px; color:#888; margin-bottom:5px;">Code: <strong>${codigo}</strong></p>
            <p style="font-size:13px; color:#666; height:40px; overflow:hidden;">${desc}</p>
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-eliminar" onclick="eliminarAuspiciante(${id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        gridAuspiciantes.appendChild(card);
    });
}

function limpiarFormulario() {
    if(form) form.reset();
    if(inpId) inpId.value = '';
    // Reseteamos a la imagen default para que la validación funcione
    if(previewImagen) previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/747/747543.png';
    const title = document.getElementById('modalTitle');
    if(title) title.innerText = 'Agregar Auspiciante';
}

function procesarImagen(event) {
    const file = event.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Solo se permiten imágenes.');
            inputImagen.value = "";
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Imagen muy pesada (máx 2MB).');
            inputImagen.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            if(previewImagen) previewImagen.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}