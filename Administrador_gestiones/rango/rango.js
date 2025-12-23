const API_URL = 'https://api-loopi.onrender.com/api/rangos';

const gridRangos = document.getElementById('gridRangos');
const searchInput = document.getElementById('buscarRango');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('formRango');
const btnNuevo = document.getElementById('btnNuevoRango');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');

const btnImagen = document.getElementById('btnImagenRango');
const inputImagen = document.getElementById('imagenRango');
const previewImagen = document.getElementById('previewRango');

let rangosCache = []; // Para búsqueda rápida

document.addEventListener('DOMContentLoaded', () => {
    listarRangos();

    btnNuevo.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    btnCerrarModal.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);

    btnImagen.addEventListener('click', () => inputImagen.click());
    inputImagen.addEventListener('change', procesarImagen);

    form.addEventListener('submit', guardarRango);

    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        const filtrados = rangosCache.filter(r => 
            r.nombre_rango.toLowerCase().includes(termino)
        );
        renderizarGrid(filtrados);
    });
});

async function listarRangos() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error al cargar rangos');
        const rangos = await response.json();
        
        rangosCache = rangos;
        renderizarGrid(rangos);
    } catch (error) {
        console.error(error);
        gridRangos.innerHTML = '<p style="text-align:center; color:red;">No se pudo conectar con el servidor.</p>';
    }
}

async function guardarRango(e) {
    e.preventDefault();

    const id = document.getElementById('idRango').value;
    const nombre = document.getElementById('nombreRango').value.trim(); // Quitamos espacios extra
    const imagenSrc = previewImagen.src;

    if (!nombre) return alert("El nombre es obligatorio");

    const nombreDuplicado = rangosCache.some(r => {
        const mismoNombre = r.nombre_rango.toLowerCase() === nombre.toLowerCase();
        if (id) {
            return mismoNombre && r.id_rango != id;
        }
        return mismoNombre;
    });

    if (nombreDuplicado) {
        return alert("Ya existe un rango con ese nombre. Por favor elige otro.");
    }
    // --------------------------------

    const rangoData = {
        nombre_rango: nombre,
        imagen: imagenSrc
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rangoData)
        });

        if (response.ok) {
            cerrarModal();
            listarRangos();
            alert(id ? 'Rango actualizado' : 'Rango creado');
        } else {
            alert('Error al guardar el rango');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
}

window.eliminarRango = async function(id) {
    if (!confirm('¿Eliminar este rango?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        if (response.ok || response.status === 204) {
            listarRangos();
        } else {
            alert('No se pudo eliminar');
        }
    } catch (error) {
        console.error(error);
    }
};

window.cargarEdicion = function(id) {
    const rango = rangosCache.find(r => r.id_rango === id);
    if (!rango) return;

    document.getElementById('idRango').value = rango.id_rango;
    document.getElementById('nombreRango').value = rango.nombre_rango;

    if (rango.imagen && rango.imagen.length > 20) {
        previewImagen.src = rango.imagen.startsWith('data:image') 
            ? rango.imagen 
            : `data:image/png;base64,${rango.imagen}`;
    } else {
        previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png';
    }

    document.getElementById('modalTitle').innerText = 'Editar Rango';
    modalOverlay.style.display = 'flex';
};

function renderizarGrid(rangos) {
    gridRangos.innerHTML = '';

    if (rangos.length === 0) {
        gridRangos.innerHTML = '<p style="text-align:center; color:#777;">No hay rangos registrados.</p>';
        return;
    }

    rangos.forEach(r => {
        let imgUrl = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png';
        if (r.imagen && r.imagen.length > 20) {
            imgUrl = r.imagen.startsWith('data:image') ? r.imagen : `data:image/png;base64,${r.imagen}`;
        }

        const card = document.createElement('div');
        card.className = 'card-rango';

        card.innerHTML = `
            <div class="card-img-container">
                <img src="${imgUrl}" alt="Icono Rango">
            </div>
            <h3>${r.nombre_rango}</h3>
            
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${r.id_rango})" title="Editar">
                    ✎
                </button>
                <button class="btn-eliminar" onclick="eliminarRango(${r.id_rango})" title="Eliminar">
                    🗑
                </button>
            </div>
        `;
        gridRangos.appendChild(card);
    });
}

function cerrarModal() {
    modalOverlay.style.display = 'none';
    limpiarFormulario();
}

function limpiarFormulario() {
    form.reset();
    document.getElementById('idRango').value = '';
    document.getElementById('modalTitle').innerText = 'Agregar Rango';
    previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png';
}

function procesarImagen(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImagen.src = e.target.result; 
        }
        reader.readAsDataURL(file);
    }
}