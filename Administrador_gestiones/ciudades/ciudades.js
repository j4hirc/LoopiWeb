
const API_URL = 'https://api-loopi.onrender.com/api/ciudades';

// Elementos del DOM
const gridCiudades = document.getElementById('gridCiudades');
const searchInput = document.getElementById('buscarCiudad');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('formCiudad');
const btnNueva = document.getElementById('btnNuevaCiudad');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');

// Cache para búsqueda rápida
let ciudadesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    listarCiudades();

    // Abrir Modal
    btnNueva.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex'; // Usamos display flex directo
    });

    // Cerrar Modal
    btnCerrarModal.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);

    // Guardar (Submit)
    form.addEventListener('submit', guardarCiudad);

    // Buscador en tiempo real
    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        const filtradas = ciudadesCache.filter(c => 
            c.nombre_ciudad.toLowerCase().includes(termino)
        );
        renderizarGrid(filtradas);
    });
});

// --- FUNCIONES CRUD ---

// 1. LISTAR (GET)
async function listarCiudades() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Fallo al conectar con la API');
        const ciudades = await response.json();
        
        ciudadesCache = ciudades; // Guardamos copia
        renderizarGrid(ciudades);
    } catch (error) {
        console.error(error);
        gridCiudades.innerHTML = `<p style="color:red; text-align:center; width:100%;">No se pudo cargar las ciudades (Revisa el Backend).</p>`;
    }
}

// 2. GUARDAR (POST / PUT)
async function guardarCiudad(e) {
    e.preventDefault();

    const id = document.getElementById('idCiudad').value;
    const nombre = document.getElementById('nombreCiudad').value;

    // EL OBJETO JSON DEBE TENER LOS MISMOS NOMBRES QUE TU JAVA ENTITY
    const datosCiudad = {
        nombre_ciudad: nombre
    };

    // Si hay ID, es PUT (Editar), si no, es POST (Crear)
    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCiudad)
        });

        if (response.ok) {
            cerrarModal();
            listarCiudades(); // Recargar lista
            // alert(id ? 'Ciudad actualizada' : 'Ciudad creada');
        } else {
            alert('Error al guardar. Revisa la consola.');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión.');
    }
}

// 3. ELIMINAR (DELETE)
window.eliminarCiudad = async function(id) {
    if (!confirm('¿Seguro quieres borrar esta ciudad?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        if (response.ok || response.status === 204) {
            listarCiudades();
        } else {
            alert('No se pudo eliminar.');
        }
    } catch (error) {
        console.error(error);
    }
};

// 4. PREPARAR EDICIÓN
window.cargarEdicion = function(id) {
    // Buscamos usando id_ciudad (nombre exacto de tu Java)
    const ciudad = ciudadesCache.find(c => c.id_ciudad === id);
    if (!ciudad) return;

    document.getElementById('idCiudad').value = ciudad.id_ciudad;
    document.getElementById('nombreCiudad').value = ciudad.nombre_ciudad;
    document.getElementById('modalTitle').innerText = 'Editar Ciudad';
    
    modalOverlay.style.display = 'flex';
};

// --- RENDERIZADO (Visual) ---

function renderizarGrid(ciudades) {
    gridCiudades.innerHTML = '';

    if (ciudades.length === 0) {
        gridCiudades.innerHTML = '<p style="text-align:center; color:#777; width:100%;">No hay ciudades registradas.</p>';
        return;
    }

    ciudades.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card-ciudad';

        // Usamos c.nombre_ciudad y c.id_ciudad
        card.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 10px;">🏙️</div>
            <h3>${c.nombre_ciudad}</h3>
            
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${c.id_ciudad})" title="Editar">
                   ✎
                </button>
                <button class="btn-eliminar" onclick="eliminarCiudad(${c.id_ciudad})" title="Eliminar">
                   🗑
                </button>
            </div>
        `;
        gridCiudades.appendChild(card);
    });
}

// --- UTILIDADES MODAL ---

function cerrarModal() {
    modalOverlay.style.display = 'none';
    limpiarFormulario();
}

function limpiarFormulario() {
    form.reset();
    document.getElementById('idCiudad').value = '';
    document.getElementById('modalTitle').innerText = 'Nueva Ciudad';
}