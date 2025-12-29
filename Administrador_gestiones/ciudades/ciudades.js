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
        modalOverlay.style.display = 'flex'; 
    });

    // Cerrar Modal
    if(btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
    if(btnCancelar) btnCancelar.addEventListener('click', cerrarModal);

    // Guardar (Submit)
    form.addEventListener('submit', guardarCiudad);

    // Buscador en tiempo real
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const filtradas = ciudadesCache.filter(c => 
                c.nombre_ciudad.toLowerCase().includes(termino)
            );
            renderizarGrid(filtradas);
        });
    }
});

// --- FUNCIONES CRUD ---

// 1. LISTAR (GET)
async function listarCiudades() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Fallo al conectar con la API');
        const ciudades = await response.json();
        
        ciudadesCache = ciudades; 
        renderizarGrid(ciudades);
    } catch (error) {
        console.error(error);
        gridCiudades.innerHTML = `<p style="color:red; text-align:center; width:100%;">No se pudo cargar las ciudades.</p>`;
    }
}

// 2. GUARDAR CON SWEETALERT (POST / PUT)
async function guardarCiudad(e) {
    e.preventDefault();

    const id = document.getElementById('idCiudad').value;
    const nombre = document.getElementById('nombreCiudad').value.trim();

    if (!nombre) {
        return Swal.fire('Campo requerido', 'El nombre de la ciudad es obligatorio.', 'warning');
    }

    const datosCiudad = {
        nombre_ciudad: nombre
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        // Bloquear botón
        const btnGuardar = form.querySelector('.btn-guardar');
        const txtOriginal = btnGuardar.innerText;
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Guardando...";

        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCiudad)
        });

        if (response.ok) {
            cerrarModal();
            listarCiudades(); 
            Swal.fire({
                title: '¡Éxito!',
                text: id ? 'Ciudad actualizada correctamente' : 'Ciudad creada correctamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire('Error', 'No se pudo guardar la ciudad.', 'error');
        }

        btnGuardar.disabled = false;
        btnGuardar.innerText = txtOriginal;

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Error de conexión.', 'error');
    }
}

// 3. ELIMINAR CON SWEETALERT (DELETE)
window.eliminarCiudad = function(id) {
    if (!id) return;

    Swal.fire({
        title: '¿Estás seguro?',
        text: "No podrás revertir esta acción",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_URL}/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok || response.status === 204) {
                    listarCiudades();
                    Swal.fire('Eliminado', 'La ciudad ha sido eliminada.', 'success');
                } else {
                    Swal.fire('Error', 'No se pudo eliminar la ciudad.', 'error');
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Error de conexión.', 'error');
            }
        }
    });
};

// 4. PREPARAR EDICIÓN
window.cargarEdicion = function(id) {
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

        card.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 10px; text-align:center; color: #2D5A4A;">
                <i class="fa-solid fa-city"></i>
            </div>
            <h3>${c.nombre_ciudad}</h3>
            
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${c.id_ciudad})" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-eliminar" onclick="eliminarCiudad(${c.id_ciudad})" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
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