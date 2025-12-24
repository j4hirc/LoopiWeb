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
let fotoNuevaFile = null; // Variable para guardar el archivo real

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

// --- GUARDAR CON FORMDATA Y COMPRESIÓN ---
async function guardarRango(e) {
    e.preventDefault();

    const id = document.getElementById('idRango').value;
    const nombre = document.getElementById('nombreRango').value.trim(); 
    const imagenSrc = previewImagen.src;

    if (!nombre) return alert("El nombre es obligatorio");

    // Validación duplicados
    const nombreDuplicado = rangosCache.some(r => {
        const mismoNombre = r.nombre_rango.toLowerCase() === nombre.toLowerCase();
        if (id) return mismoNombre && r.id_rango != id;
        return mismoNombre;
    });

    if (nombreDuplicado) return alert("Ya existe un rango con ese nombre.");

    // Validar imagen obligatoria (solo si es nuevo o si cambiaron la default)
    if (imagenSrc.includes("flaticon") && !id) {
         return alert("Debes elegir una imagen para el rango.");
    }

    const rangoData = {
        nombre_rango: nombre,
        imagen: null
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(rangoData));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const response = await fetch(url, {
            method: metodo,
            body: formData 
        });

        if (response.ok) {
            cerrarModal();
            listarRangos();
            alert(id ? 'Rango actualizado' : 'Rango creado');
        } else {
            const errText = await response.text();
            console.error(errText);
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

    limpiarFormulario(); // Limpiar previo

    document.getElementById('idRango').value = rango.id_rango;
    document.getElementById('nombreRango').value = rango.nombre_rango;

    // Cargar imagen (URL o Base64)
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
    fotoNuevaFile = null; // Limpiar foto
}

async function procesarImagen(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("Solo se permiten imágenes");
        inputImagen.value = "";
        return;
    }

    try {
        const archivoComprimido = await comprimirImagen(file);
        
        fotoNuevaFile = archivoComprimido; 

        const reader = new FileReader();
        reader.onload = function(e) {
            previewImagen.src = e.target.result;
        }
        reader.readAsDataURL(archivoComprimido);

    } catch (error) {
        console.error("Error al comprimir:", error);
        alert("No se pudo procesar la imagen");
    }
}

async function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const maxWidth = 800; 
        const quality = 0.7;  

        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Error al comprimir imagen"));
                        return;
                    }
                    const archivoComprimido = new File([blob], archivo.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    
                    console.log(`Compresión: ${(archivo.size/1024).toFixed(2)}KB -> ${(archivoComprimido.size/1024).toFixed(2)}KB`);
                    resolve(archivoComprimido);
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}