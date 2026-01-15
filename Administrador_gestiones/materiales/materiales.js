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
let fotoNuevaFile = null; 

document.addEventListener('DOMContentLoaded', () => {
    listarMateriales();

    if(btnNuevo) btnNuevo.addEventListener('click', () => abrirModal());
    if(btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
    if(btnCancelar) btnCancelar.addEventListener('click', cerrarModal);
    
    if(btnSeleccionarImagen) btnSeleccionarImagen.addEventListener('click', () => inputImagen.click());
    if(inputImagen) inputImagen.addEventListener('change', procesarImagen);

    if(form) form.addEventListener('submit', guardarMaterial);

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const filtrados = materialesCache.filter(m => 
                m.nombre.toLowerCase().includes(termino) || 
                (m.tipo_material && m.tipo_material.toLowerCase().includes(termino))
            );
            renderizarLista(filtrados);
        });
    }
});


function abrirModal() {
    resetForm();
    modalOverlay.classList.add('show');
}

function cerrarModal() {
    modalOverlay.classList.remove('show');
    resetForm();
}

function resetForm() {
    form.reset();
    document.getElementById('idMaterial').value = '';
    previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/685/685662.png';
    document.getElementById('modalTitle').textContent = 'Agregar Material';
    fotoNuevaFile = null; 
}

window.cargarDatosEdicion = function(id) {
    const material = materialesCache.find(m => m.id_material === id);
    if (!material) return;

    document.getElementById('idMaterial').value = material.id_material;
    document.getElementById('nombreMaterial').value = material.nombre;
    document.getElementById('descripcionMaterial').value = material.descripcion;
    document.getElementById('tipoMaterial').value = material.tipo_material; 
    document.getElementById('puntosKg').value = material.puntos_por_kg; 
    
    if(material.imagen && material.imagen.length > 5) {
        let imgUrl = material.imagen;
        if (!imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
             imgUrl = `data:image/png;base64,${material.imagen}`;
        }
        previewImagen.src = imgUrl;
    } else {
        previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/685/685662.png';
    }

    document.getElementById('modalTitle').textContent = 'Editar Material';
    modalOverlay.classList.add('show');
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

    if (isNaN(puntos) || puntos <= 0) {
        return Swal.fire('Atención', 'Los puntos por Kg deben ser mayores a 0.', 'warning');
    }

    const nombreDuplicado = materialesCache.some(m => {
        const mismoNombre = m.nombre.toLowerCase() === nombre.toLowerCase();
        if (id) return mismoNombre && m.id_material != id;
        return mismoNombre;
    });

    if (nombreDuplicado) {
        return Swal.fire('Duplicado', 'Ya existe un material con ese nombre.', 'error');
    }

    const materialData = {
        nombre: nombre,
        descripcion: document.getElementById('descripcionMaterial').value,
        tipo_material: document.getElementById('tipoMaterial').value, 
        puntos_por_kg: puntos,
        imagen: null 
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(materialData));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const btnGuardar = document.getElementById('btnGuardar');
        btnGuardar.disabled = true; 
        btnGuardar.innerText = "Guardando...";

        const response = await fetch(url, {
            method: metodo,
            body: formData 
        });

        if (response.ok) {
            cerrarModal();
            listarMateriales(); 
            Swal.fire({
                title: '¡Éxito!',
                text: id ? 'Material actualizado correctamente' : 'Material creado correctamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            const errText = await response.text();
            console.error(errText);
            Swal.fire('Error', 'No se pudo guardar. Verifica los datos.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error de conexión', 'Intenta nuevamente más tarde.', 'error');
    } finally {
        const btnGuardar = document.getElementById('btnGuardar');
        btnGuardar.disabled = false;
        btnGuardar.innerText = "Guardar";
    }
}

window.eliminarMaterial = function(id) {
    if (!id) return;

    Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                if (response.ok || response.status === 204) {
                    listarMateriales();
                    Swal.fire('¡Eliminado!', 'El material ha sido eliminado.', 'success');
                } else {
                    Swal.fire('Error', 'No se pudo eliminar el material.', 'error');
                }
            } catch (error) { 
                console.error(error); 
                Swal.fire('Error', 'Error de conexión', 'error');
            }
        }
    });
}

function renderizarLista(materiales) {
    listaMateriales.innerHTML = '';

    if (materiales.length === 0) {
        listaMateriales.innerHTML = '<p class="empty-msg" style="text-align:center; padding:20px; color:#666;">No hay materiales registrados.</p>';
        return;
    }

    materiales.forEach(mat => {
        let imgUrl = 'https://cdn-icons-png.flaticon.com/512/685/685662.png';
        
        if (mat.imagen && mat.imagen.length > 5) {
            if (mat.imagen.startsWith('http') || mat.imagen.startsWith('data:')) {
                imgUrl = mat.imagen;
            } else {
                imgUrl = `data:image/png;base64,${mat.imagen}`;
            }
        }

        const card = document.createElement('div');
        card.className = 'card-material';
        
        card.innerHTML = `
            <div class="card-icono">
                <div class="card-icono-inner">
                    <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/685/685662.png'">
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
                   <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-eliminar" onclick="eliminarMaterial(${mat.id_material})" title="Eliminar">
                   <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        listaMateriales.appendChild(card);
    });
}

function procesarImagen(event) {
    const file = event.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            Swal.fire('Formato inválido', 'Solo se permiten imágenes.', 'warning');
            return;
        }
        if (file.size > 2 * 1024 * 1024) { 
            Swal.fire('Muy pesado', 'La imagen es muy pesada (Máx 2MB)', 'warning');
            return;
        }

        fotoNuevaFile = file;

        const reader = new FileReader();
        reader.onload = function(e) {
            previewImagen.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}