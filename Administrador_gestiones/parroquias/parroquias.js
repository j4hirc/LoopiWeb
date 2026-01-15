const API_PARROQUIAS = 'https://api-loopi.onrender.com/api/parroquias';
const API_CIUDADES   = 'https://api-loopi.onrender.com/api/ciudades';

const gridParroquias = document.getElementById('gridParroquias');
const searchInput = document.getElementById('buscarParroquia');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('formParroquia');
const btnNueva = document.getElementById('btnNuevaParroquia');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');
const selectCiudad = document.getElementById('ciudadParroquia'); 

let parroquiasCache = [];

document.addEventListener('DOMContentLoaded', () => {
    listarParroquias();
    cargarCiudadesEnSelect(); 

    btnNueva.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    if(btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
    if(btnCancelar) btnCancelar.addEventListener('click', cerrarModal);

    
    form.addEventListener('submit', guardarParroquia);

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const filtradas = parroquiasCache.filter(p => 
                p.nombre_parroquia.toLowerCase().includes(termino) || 
                (p.ciudad && p.ciudad.nombre_ciudad.toLowerCase().includes(termino))
            );
            renderizarGrid(filtradas);
        });
    }
});

async function cargarCiudadesEnSelect() {
    try {
        const response = await fetch(API_CIUDADES);
        const ciudades = await response.json();
        
        selectCiudad.innerHTML = '<option value="">Seleccione una ciudad</option>';

        ciudades.forEach(ciudad => {
            const option = document.createElement('option');
            option.value = ciudad.id_ciudad; 
            option.textContent = ciudad.nombre_ciudad;
            selectCiudad.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando ciudades:", error);
    }
}

async function listarParroquias() {
    try {
        const response = await fetch(API_PARROQUIAS);
        if (!response.ok) throw new Error('Error API Parroquias');
        const parroquias = await response.json();
        
        parroquiasCache = parroquias;
        renderizarGrid(parroquias);
    } catch (error) {
        console.error(error);
        gridParroquias.innerHTML = '<p style="text-align:center; color:red;">No se pudo conectar con el servidor.</p>';
    }
}

async function guardarParroquia(e) {
    e.preventDefault();

    const idInput = document.getElementById('idParroquia').value;
    const nombreInput = document.getElementById('nombreParroquia').value.trim(); // Quitamos espacios extra
    const idCiudadSeleccionada = selectCiudad.value; 

    if (!nombreInput) {
        return Swal.fire('Atención', 'El nombre de la parroquia es obligatorio', 'warning');
    }
    if (!idCiudadSeleccionada) {
        return Swal.fire('Atención', 'Por favor selecciona una ciudad', 'warning');
    }

    const existeDuplicado = parroquiasCache.some(p => {
        if (idInput && p.id_parroquia == idInput) {
            return false; 
        }
        return p.nombre_parroquia.toLowerCase() === nombreInput.toLowerCase();
    });

    if (existeDuplicado) {
        return Swal.fire({
            title: 'Nombre Duplicado',
            text: `Ya existe una parroquia llamada "${nombreInput}". Por favor usa otro nombre.`,
            icon: 'error',
            confirmButtonColor: '#3A6958'
        });
    }


    const datosParroquia = {
        nombre_parroquia: nombreInput, 
        ciudad: {
            id_ciudad: parseInt(idCiudadSeleccionada)
        }
    };

    const metodo = idInput ? 'PUT' : 'POST';
    const url = idInput ? `${API_PARROQUIAS}/${idInput}` : API_PARROQUIAS;

    try {
        const btnGuardar = form.querySelector('.btn-guardar');
        const txtOriginal = btnGuardar.innerText;
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Guardando...";

        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosParroquia)
        });

        if (response.ok) {
            cerrarModal();
            listarParroquias(); 
            Swal.fire({
                title: '¡Éxito!',
                text: idInput ? 'Parroquia actualizada correctamente' : 'Parroquia creada correctamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.mensaje || 'No se pudo guardar la parroquia.';
            Swal.fire('Error', msg, 'error');
        }

        btnGuardar.disabled = false;
        btnGuardar.innerText = txtOriginal;

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
        const btnGuardar = form.querySelector('.btn-guardar');
        if(btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerText = "Guardar";
        }
    }
}

window.eliminarParroquia = function(id) {
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
                const response = await fetch(`${API_PARROQUIAS}/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok || response.status === 204) {
                    listarParroquias();
                    Swal.fire('Eliminado', 'La parroquia ha sido eliminada.', 'success');
                } else {
                    Swal.fire('Error', 'No se pudo eliminar la parroquia.', 'error');
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Error de conexión.', 'error');
            }
        }
    });
};

window.cargarEdicion = function(id) {
    const parroquia = parroquiasCache.find(p => p.id_parroquia === id);
    if (!parroquia) return;

    document.getElementById('idParroquia').value = parroquia.id_parroquia;
    document.getElementById('nombreParroquia').value = parroquia.nombre_parroquia;
    
    if (parroquia.ciudad) {
        selectCiudad.value = parroquia.ciudad.id_ciudad;
    }

    document.getElementById('modalTitle').innerText = 'Editar Parroquia';
    modalOverlay.style.display = 'flex';
};

function renderizarGrid(parroquias) {
    gridParroquias.innerHTML = '';

    if (parroquias.length === 0) {
        gridParroquias.innerHTML = '<p style="text-align:center; color:#777;">No hay parroquias registradas.</p>';
        return;
    }

    parroquias.forEach(p => {
        const nombreCiudad = p.ciudad ? p.ciudad.nombre_ciudad : 'Sin Ciudad';

        const card = document.createElement('div');
        card.className = 'card-parroquia';

        card.innerHTML = `
            <div style="font-size: 35px; color:#2D5A4A; text-align:center; margin-bottom:10px;">
                <i class="fa-solid fa-tree-city"></i>
            </div>
            <h3>${p.nombre_parroquia}</h3>
            <p><i class="fa-solid fa-map-pin"></i> ${nombreCiudad}</p> 
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${p.id_parroquia})" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-eliminar" onclick="eliminarParroquia(${p.id_parroquia})" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        gridParroquias.appendChild(card);
    });
}

function cerrarModal() {
    modalOverlay.style.display = 'none';
    limpiarFormulario();
}

function limpiarFormulario() {
    form.reset();
    document.getElementById('idParroquia').value = '';
    document.getElementById('modalTitle').innerText = 'Nueva Parroquia';
    selectCiudad.value = ""; 
}