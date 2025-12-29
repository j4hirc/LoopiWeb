const BASE_URL = 'https://api-loopi.onrender.com';
const API_URL = `${BASE_URL}/api/multimedias`;

const grid = document.getElementById('gridMultimedia');
const modal = document.getElementById('modalOverlay');
const btnNuevo = document.getElementById('btnNuevo');
const btnCerrar = document.getElementById('btnCerrar');
const btnCancelar = document.getElementById('btnCancelar');
const btnGuardar = document.getElementById('btnGuardar');

const idInput = document.getElementById('idMultimedia');
const imagenInput = document.getElementById('imagen');
const tituloInput = document.getElementById('titulo');
const descripcionInput = document.getElementById('descripcion');
const previewImg = document.getElementById('previewImg');
const searchInput = document.getElementById('searchInput');

let cache = [];
let fotoNuevaFile = null; 

document.addEventListener('DOMContentLoaded', cargar);

btnNuevo.onclick = abrirModal;
btnCerrar.onclick = cerrarModal;
btnCancelar.onclick = cerrarModal;
btnGuardar.onclick = guardar;

imagenInput.onchange = () => {
    const file = imagenInput.files[0];
    if (file) {
        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
            Swal.fire('Error', 'Solo se permiten archivos de imagen.', 'error');
            imagenInput.value = '';
            return;
        }
        
        fotoNuevaFile = file; 
        const reader = new FileReader();
        reader.onload = e => previewImg.style.backgroundImage = `url(${e.target.result})`;
        reader.readAsDataURL(file);
    }
};

searchInput.oninput = () => {
    const t = searchInput.value.toLowerCase();
    render(cache.filter(m =>
        m.titulo.toLowerCase().includes(t) ||
        m.descripcion.toLowerCase().includes(t)
    ));
};

function abrirModal() {
    resetForm();
    modal.style.display = 'flex';
}

function cerrarModal() {
    modal.style.display = 'none';
    resetForm();
}

function resetForm() {
    idInput.value = '';
    tituloInput.value = '';
    descripcionInput.value = '';
    imagenInput.value = '';
    previewImg.style.backgroundImage = '';
    fotoNuevaFile = null;
    document.getElementById('modalTitle').innerText = 'Nuevo Contenido';
}

async function cargar() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Error al cargar datos');
        cache = await res.json();
        render(cache);
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p style="text-align:center; color:red;">No se pudo conectar con el servidor.</p>';
    }
}

function render(lista) {
    grid.innerHTML = '';
    if (lista.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#777; width:100%;">No hay contenido multimedia.</p>';
        return;
    }

    lista.forEach(m => {
        const card = document.createElement('div');
        card.className = 'card';
        
        let imageUrl = 'https://via.placeholder.com/150?text=Sin+Img';
        
        if (m.imagenes) {
            if (m.imagenes.startsWith('http') || m.imagenes.startsWith('data:')) {
                imageUrl = m.imagenes;
            } else {
                imageUrl = `data:image/png;base64,${m.imagenes}`;
            }
        }

        card.innerHTML = `
            <img src="${imageUrl}" alt="${m.titulo}" style="object-fit: cover;" onerror="this.src='https://via.placeholder.com/150?text=Error'"/>
            <div class="card-body">
                <div class="card-title">${m.titulo}</div>
                <div class="card-desc">${m.descripcion || ''}</div>
            </div>
            <div class="card-actions">
                <button class="btn-edit" onclick="editar(${m.id_multimedia})" title="Editar">
                    <i class="fa-solid fa-pen"></i> Editar
                </button>
                <button class="btn-delete" onclick="eliminar(${m.id_multimedia})" title="Eliminar">
                    <i class="fa-solid fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.editar = (id) => {
    const m = cache.find(x => x.id_multimedia === id);
    if(!m) return;

    resetForm(); 

    idInput.value = id;
    tituloInput.value = m.titulo;
    descripcionInput.value = m.descripcion;
    
    if (m.imagenes) {
        let imageUrl = m.imagenes;
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
             imageUrl = `data:image/png;base64,${m.imagenes}`;
        }
        previewImg.style.backgroundImage = `url(${imageUrl})`;
    }
    
    document.getElementById('modalTitle').innerText = 'Editar Contenido';
    modal.style.display = 'flex'; 
};

async function guardar() {
    const id = idInput.value;
    const titulo = tituloInput.value.trim();

    if (!titulo) {
        return Swal.fire('Campo requerido', 'El título es obligatorio.', 'warning');
    }
    
    const dataObj = {
        titulo: titulo,
        descripcion: descripcionInput.value,
        imagenes: null 
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(dataObj));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const url = id ? `${API_URL}/${id}` : API_URL;
    const method = id ? 'PUT' : 'POST';

    try {
        // Bloquear botón
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Guardando...";

        const res = await fetch(url, { 
            method: method, 
            body: formData 
        });

        if(!res.ok) {
            const errText = await res.text();
            throw new Error("Error en la petición: " + errText);
        }

        cerrarModal();
        cargar(); 
        
        Swal.fire({
            title: '¡Éxito!',
            text: id ? 'Contenido actualizado correctamente' : 'Contenido creado correctamente',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error("Error al guardar:", error);
        Swal.fire('Error', 'No se pudo guardar el contenido.', 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerText = "Guardar";
    }
}

window.eliminar = function(id) {
    if (!id) return;

    Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    cargar();
                    Swal.fire('Eliminado', 'El contenido ha sido eliminado.', 'success');
                } else {
                    Swal.fire('Error', 'No se pudo eliminar.', 'error');
                }
            } catch(e) { 
                console.error(e); 
                Swal.fire('Error', 'Error de conexión.', 'error');
            }
        }
    });
};