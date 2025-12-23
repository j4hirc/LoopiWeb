// 🌍 URLs de las APIs (Ajusta el puerto 8095 u 8080)
const API_PARROQUIAS = 'https://api-loopi.onrender.com/api/parroquias';
const API_CIUDADES   = 'https://api-loopi.onrender.com/api/ciudades';

// Elementos del DOM
const gridParroquias = document.getElementById('gridParroquias');
const searchInput = document.getElementById('buscarParroquia');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('formParroquia');
const btnNueva = document.getElementById('btnNuevaParroquia');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');
const selectCiudad = document.getElementById('ciudadParroquia'); // El <select>

// Cache
let parroquiasCache = [];

document.addEventListener('DOMContentLoaded', () => {
    listarParroquias();
    cargarCiudadesEnSelect(); // ⚠️ Importante: Cargar las opciones del dropdown

    // Abrir Modal
    btnNueva.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    // Cerrar Modal
    btnCerrarModal.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);

    // Guardar
    form.addEventListener('submit', guardarParroquia);

    // Buscador
    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        const filtradas = parroquiasCache.filter(p => 
            p.nombre_parroquia.toLowerCase().includes(termino) || 
            (p.ciudad && p.ciudad.nombre_ciudad.toLowerCase().includes(termino))
        );
        renderizarGrid(filtradas);
    });
});

// --- 1. CARGAR SELECT DE CIUDADES ---
async function cargarCiudadesEnSelect() {
    try {
        const response = await fetch(API_CIUDADES);
        const ciudades = await response.json();
        
        // Limpiamos y dejamos la opción por defecto
        selectCiudad.innerHTML = '<option value="">Seleccione una ciudad</option>';

        ciudades.forEach(ciudad => {
            const option = document.createElement('option');
            // Usamos los nombres exactos de tu Entity Ciudad
            option.value = ciudad.id_ciudad; 
            option.textContent = ciudad.nombre_ciudad;
            selectCiudad.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando ciudades:", error);
    }
}

// --- 2. LISTAR PARROQUIAS ---
async function listarParroquias() {
    try {
        const response = await fetch(API_PARROQUIAS);
        if (!response.ok) throw new Error('Error API Parroquias');
        const parroquias = await response.json();
        
        parroquiasCache = parroquias;
        renderizarGrid(parroquias);
    } catch (error) {
        console.error(error);
        gridParroquias.innerHTML = '<p style="text-align:center; color:red;">Error al cargar datos.</p>';
    }
}

// --- 3. GUARDAR (RELACIÓN MANY-TO-ONE) ---
async function guardarParroquia(e) {
    e.preventDefault();

    const id = document.getElementById('idParroquia').value;
    const nombre = document.getElementById('nombreParroquia').value;
    const idCiudadSeleccionada = selectCiudad.value; // ID obtenido del select

    if (!idCiudadSeleccionada) {
        alert("Por favor selecciona una ciudad");
        return;
    }

    // ESTRUCTURA JSON PARA RELACIÓN @ManyToOne
    const datosParroquia = {
        nombre_parroquia: nombre,
        // Spring Boot espera un objeto Ciudad con su ID dentro
        ciudad: {
            id_ciudad: parseInt(idCiudadSeleccionada)
        }
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_PARROQUIAS}/${id}` : API_PARROQUIAS;

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosParroquia)
        });

        if (response.ok) {
            cerrarModal();
            listarParroquias();
        } else {
            alert('Error al guardar. Revisa la consola.');
        }
    } catch (error) {
        console.error(error);
    }
}

// --- 4. ELIMINAR ---
window.eliminarParroquia = async function(id) {
    if (!confirm('¿Borrar esta parroquia?')) return;

    try {
        const response = await fetch(`${API_PARROQUIAS}/${id}`, {
            method: 'DELETE'
        });

        if (response.ok || response.status === 204) {
            listarParroquias();
        } else {
            alert('No se pudo eliminar');
        }
    } catch (error) {
        console.error(error);
    }
};

// --- 5. CARGAR EDICIÓN ---
window.cargarEdicion = function(id) {
    const parroquia = parroquiasCache.find(p => p.id_parroquia === id);
    if (!parroquia) return;

    document.getElementById('idParroquia').value = parroquia.id_parroquia;
    document.getElementById('nombreParroquia').value = parroquia.nombre_parroquia;
    
    // Seleccionar la ciudad en el dropdown
    if (parroquia.ciudad) {
        selectCiudad.value = parroquia.ciudad.id_ciudad;
    }

    document.getElementById('modalTitle').innerText = 'Editar Parroquia';
    modalOverlay.style.display = 'flex';
};

// --- RENDERIZADO ---
function renderizarGrid(parroquias) {
    gridParroquias.innerHTML = '';

    if (parroquias.length === 0) {
        gridParroquias.innerHTML = '<p style="text-align:center; color:#777;">No hay parroquias registradas.</p>';
        return;
    }

    parroquias.forEach(p => {
        // Validación por si una parroquia no tiene ciudad asignada (null safety)
        const nombreCiudad = p.ciudad ? p.ciudad.nombre_ciudad : 'Sin Ciudad Asignada';

        const card = document.createElement('div');
        card.className = 'card-parroquia';

        card.innerHTML = `
            <div style="font-size: 35px; color:#2D5A4A;">🏘️</div>
            <h3>${p.nombre_parroquia}</h3>
            <p>📍 ${nombreCiudad}</p> <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${p.id_parroquia})">✎</button>
                <button class="btn-eliminar" onclick="eliminarParroquia(${p.id_parroquia})">🗑</button>
            </div>
        `;
        gridParroquias.appendChild(card);
    });
}

// --- UTILIDADES ---
function cerrarModal() {
    modalOverlay.style.display = 'none';
    limpiarFormulario();
}

function limpiarFormulario() {
    form.reset();
    document.getElementById('idParroquia').value = '';
    document.getElementById('modalTitle').innerText = 'Nueva Parroquia';
    selectCiudad.value = ""; // Resetear select
}