const API_URL = 'https://api-loopi.onrender.com/api/materiales';

const listaMateriales = document.getElementById('listaMateriales');
const searchInput = document.getElementById('searchInput');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('materialForm');
const btnNuevo = document.getElementById('btnNuevoMaterial');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');
const btnSeleccionarImagen = document.getElementById('btnSeleccionarImagen');
const inputImagen = document.getElementById('imagenMaterial');
const previewImagen = document.getElementById('previewImagenMaterial');

let materialesCache = []; 

document.addEventListener('DOMContentLoaded', () => {
    listarMateriales();

    btnNuevo.addEventListener('click', () => abrirModal());
    btnCerrarModal.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);
    
    btnSeleccionarImagen.addEventListener('click', () => inputImagen.click());
    inputImagen.addEventListener('change', procesarImagen);

    form.addEventListener('submit', guardarMaterial);

    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        const filtrados = materialesCache.filter(m => 
            m.nombre.toLowerCase().includes(termino) || 
            (m.tipo_material && m.tipo_material.toLowerCase().includes(termino))
        );
        renderizarLista(filtrados);
    });
});


function abrirModal() {
    modalOverlay.classList.add('show');
}

function cerrarModal() {
    modalOverlay.classList.remove('show');
    form.reset();
    document.getElementById('idMaterial').value = '';
    previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/685/685662.png';
    document.getElementById('modalTitle').textContent = 'Agregar Material';
}

window.cargarDatosEdicion = function(id) {
    const material = materialesCache.find(m => m.id_material === id);
    if (!material) return;

    document.getElementById('idMaterial').value = material.id_material;
    document.getElementById('nombreMaterial').value = material.nombre;
    document.getElementById('descripcionMaterial').value = material.descripcion;
    document.getElementById('tipoMaterial').value = material.tipo_material; 
    document.getElementById('puntosKg').value = material.puntos_por_kg; 
    
    if(material.imagen && material.imagen.length > 20) {
        previewImagen.src = material.imagen.startsWith('data:image') 
            ? material.imagen 
            : `data:image/png;base64,${material.imagen}`;
    } else {
        previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/685/685662.png';
    }

    document.getElementById('modalTitle').textContent = 'Editar Material';
    abrirModal();
};


async function listarMateriales() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error al obtener materiales');
        const materiales = await response.json();
        materialesCache = materiales; 
        renderizarLista(materiales);
    } catch (error) {
        console.error(error);
        listaMateriales.innerHTML = `<p style="text-align:center; padding:20px; color:red;">No se pudo conectar con el servidor.</p>`;
    }
}

async function guardarMaterial(e) {
    e.preventDefault();

    const id = document.getElementById('idMaterial').value;
    const nombre = document.getElementById('nombreMaterial').value.trim();
    const puntos = parseFloat(document.getElementById('puntosKg').value);
    const imagenSrc = previewImagen.src;

    if (isNaN(puntos) || puntos <= 0) {
        return alert("⚠️ Los puntos por Kg deben ser mayor a 0.");
    }

    const nombreDuplicado = materialesCache.some(m => {
        const mismoNombre = m.nombre.toLowerCase() === nombre.toLowerCase();
        if (id) {
            return mismoNombre && m.id_material != id;
        }
        return mismoNombre;
    });

    if (nombreDuplicado) {
        return alert("Ya existe un material con ese nombre.");
    }

    if (imagenSrc.includes("flaticon")) {
        return alert("Debes seleccionar una imagen para el material.");
    }

    const materialData = {
        nombre: nombre,
        descripcion: document.getElementById('descripcionMaterial').value,
        tipo_material: document.getElementById('tipoMaterial').value, 
        puntos_por_kg: puntos,
        imagen: imagenSrc 
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(materialData)
        });

        if (response.ok) {
            cerrarModal();
            listarMateriales(); 
            alert(id ? 'Material actualizado correctamente' : 'Material creado correctamente');
        } else {
            alert('Error al guardar. Verifica los datos.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

window.eliminarMaterial = async function(id) {
    if (!confirm('¿Seguro que quieres eliminar este material?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (response.ok || response.status === 204) {
            listarMateriales();
        } else {
            alert('No se pudo eliminar');
        }
    } catch (error) { console.error(error); }
}

function renderizarLista(materiales) {
    listaMateriales.innerHTML = '';

    if (materiales.length === 0) {
        listaMateriales.innerHTML = '<p class="empty-msg" style="text-align:center; padding:20px; color:#666;">No hay materiales registrados.</p>';
        return;
    }

    materiales.forEach(mat => {
        let imgUrl = 'https://cdn-icons-png.flaticon.com/512/685/685662.png';
        if (mat.imagen && mat.imagen.length > 20) {
            imgUrl = mat.imagen.startsWith('data:image') ? mat.imagen : `data:image/png;base64,${mat.imagen}`;
        }

        const card = document.createElement('div');
        card.className = 'card-material';
        
        card.innerHTML = `
            <div class="card-icono">
                <div class="card-icono-inner">
                    <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">
                </div>
            </div>
            <div class="card-info">
                <h3>${mat.nombre}</h3>
                <div class="card-tipo">${mat.tipo_material || 'General'}</div>
            </div>
            <div class="card-puntos">
                <span class="cantidad">${mat.puntos_por_kg || 0}</span>
                <span class="unidad">Pts/Kg</span>
            </div>
            <div class="card-acciones">
                <button class="btn-editar" onclick="cargarDatosEdicion(${mat.id_material})" title="Editar">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-eliminar" onclick="eliminarMaterial(${mat.id_material})" title="Eliminar">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        listaMateriales.appendChild(card);
    });
}

function procesarImagen(event) {
    const file = event.target.files[0];
    if (file) {
        // Validación extra de tipo y tamaño
        if (!file.type.startsWith('image/')) {
            alert("Solo se permiten imágenes");
            return;
        }
        if (file.size > 2 * 1024 * 1024) { 
            alert("La imagen es muy pesada (Máx 2MB)");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            previewImagen.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}