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

let rangosCache = []; 
let fotoNuevaFile = null; 

document.addEventListener('DOMContentLoaded', () => {
    listarRangos();

    if(btnNuevo) btnNuevo.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    if(btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
    if(btnCancelar) btnCancelar.addEventListener('click', cerrarModal);

    if(btnImagen) btnImagen.addEventListener('click', () => inputImagen.click());
    if(inputImagen) inputImagen.addEventListener('change', procesarImagen);

    if(form) form.addEventListener('submit', guardarRango);

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const filtrados = rangosCache.filter(r => 
                r.nombre_rango.toLowerCase().includes(termino)
            );
            renderizarGrid(filtrados);
        });
    }
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

// --- GUARDAR CON SWEETALERT ---
async function guardarRango(e) {
    e.preventDefault();

    const id = document.getElementById('idRango').value;
    const nombre = document.getElementById('nombreRango').value.trim(); 
    const imagenSrc = previewImagen.src;

    // Validaciones
    if (!nombre) return Swal.fire('Error', 'El nombre es obligatorio', 'warning');

    const nombreDuplicado = rangosCache.some(r => {
        const mismoNombre = r.nombre_rango.toLowerCase() === nombre.toLowerCase();
        if (id) return mismoNombre && r.id_rango != id;
        return mismoNombre;
    });

    if (nombreDuplicado) return Swal.fire('Duplicado', 'Ya existe un rango con ese nombre.', 'error');

    if (imagenSrc.includes("flaticon") && !id) {
         return Swal.fire('Falta imagen', 'Debes elegir una insignia o ícono para el rango.', 'warning');
    }

    const rangoData = {
        nombre_rango: nombre,
        imagen: null
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(rangoData));

    // Aquí se envía el archivo original sin comprimir
    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        // Bloquear botón para evitar doble click
        const btnGuardar = form.querySelector('.btn-guardar');
        const textoOriginal = btnGuardar.innerText;
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Guardando...";

        const response = await fetch(url, {
            method: metodo,
            body: formData 
        });

        if (response.ok) {
            cerrarModal();
            listarRangos();
            Swal.fire({
                title: '¡Excelente!',
                text: id ? 'Rango actualizado correctamente' : 'Rango creado correctamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            const errText = await response.text();
            console.error(errText);
            Swal.fire('Error', 'No se pudo guardar el rango.', 'error');
        }

        btnGuardar.disabled = false;
        btnGuardar.innerText = textoOriginal;

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Problema de conexión.', 'error');
    }
}

// --- ELIMINAR CON SWEETALERT ---
window.eliminarRango = function(id) {
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
                    listarRangos();
                    Swal.fire('Eliminado', 'El rango ha sido eliminado.', 'success');
                } else {
                    Swal.fire('Error', 'No se pudo eliminar el rango.', 'error');
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Error de conexión.', 'error');
            }
        }
    });
};

window.cargarEdicion = function(id) {
    const rango = rangosCache.find(r => r.id_rango === id);
    if (!rango) return;

    limpiarFormulario(); 

    document.getElementById('idRango').value = rango.id_rango;
    document.getElementById('nombreRango').value = rango.nombre_rango;

    if (rango.imagen && rango.imagen.length > 5) {
        let imgUrl = rango.imagen;
        if (!imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
             imgUrl = `data:image/png;base64,${rango.imagen}`;
        }
        previewImagen.src = imgUrl;
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
        
        if (r.imagen && r.imagen.length > 5) {
            if (r.imagen.startsWith('http') || r.imagen.startsWith('data:')) {
                imgUrl = r.imagen;
            } else {
                imgUrl = `data:image/png;base64,${r.imagen}`;
            }
        }

        const card = document.createElement('div');
        card.className = 'card-rango';

        card.innerHTML = `
            <div class="card-img-container">
                <img src="${imgUrl}" alt="Icono Rango" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1828/1828884.png'">
            </div>
            <h3>${r.nombre_rango}</h3>
            
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${r.id_rango})" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-eliminar" onclick="eliminarRango(${r.id_rango})" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
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
    fotoNuevaFile = null; 
}

// --- FUNCIÓN SIMPLIFICADA (Sin compresión) ---
function procesarImagen(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        Swal.fire('Formato incorrecto', 'Solo se permiten imágenes.', 'error');
        inputImagen.value = "";
        return;
    }

    // Guardamos el archivo original directamente
    fotoNuevaFile = file; 

    // Solo creamos la vista previa
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImagen.src = e.target.result;
    }
    reader.readAsDataURL(file);
}