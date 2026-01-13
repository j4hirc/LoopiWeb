const API_URL = 'https://api-loopi.onrender.com/api/auspiciantes';

const DEFAULT_IMG = 'https://cdn-icons-png.flaticon.com/512/5968/5968764.png';

const gridAuspiciantes = document.getElementById('gridAuspiciantes');
const searchInput = document.getElementById('buscarAusp');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('formAusp');
const btnNuevo = document.getElementById('btnNuevoAusp');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');

const inpId = document.getElementById('idAusp');
const inpNombre = document.getElementById('nombreAusp');
const inpCodigo = document.getElementById('codigoAusp');
const inpDescripcion = document.getElementById('descripcionAusp');

const btnImagen = document.getElementById('btnImagenAusp');
const inputImagen = document.getElementById('imagenAusp');
const previewImagen = document.getElementById('previewAusp');

let auspiciantesCache = [];
let fotoNuevaFile = null;

document.addEventListener('DOMContentLoaded', () => {
    listarAuspiciantes();

    if (btnNuevo) btnNuevo.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    const cerrar = () => {
        if (modalOverlay) modalOverlay.style.display = 'none';
        limpiarFormulario();
    };

    if (btnCerrarModal) btnCerrarModal.addEventListener('click', cerrar);
    if (btnCancelar) btnCancelar.addEventListener('click', cerrar);

    if (btnImagen) btnImagen.addEventListener('click', () => inputImagen.click());
    if (inputImagen) inputImagen.addEventListener('change', procesarImagen);

    if (form) form.addEventListener('submit', guardarAuspiciante);

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase().trim();
            if (!auspiciantesCache) return;
            const filtrados = auspiciantesCache.filter(a => {
                const nombre = a.nombre ? a.nombre.toLowerCase() : "";
                const codigo = a.codigo ? a.codigo.toLowerCase() : "";
                return nombre.includes(termino) || codigo.includes(termino);
            });
            renderizarGrid(filtrados);
        });
    }
});

async function listarAuspiciantes() {
    try {
        gridAuspiciantes.innerHTML = '<p style="text-align:center;">Cargando...</p>';
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Datos inválidos");

        auspiciantesCache = data;
        renderizarGrid(data);
    } catch (error) {
        console.error(error);
        if (gridAuspiciantes) gridAuspiciantes.innerHTML = '<p style="text-align:center; color:red;">No se pudo conectar.</p>';
    }
}

async function guardarAuspiciante(e) {
    e.preventDefault();

    const nombre = inpNombre.value.trim();
    const codigo = inpCodigo.value.trim();
    const desc = inpDescripcion.value.trim();
    const imagenSrc = previewImagen.src;

    // VALIDACIONES CON SWEETALERT
    if (!nombre || nombre.length < 3) return Swal.fire('Cuidado', 'El nombre es muy corto.', 'warning');
    if (!codigo) return Swal.fire('Falta información', 'El código es obligatorio.', 'warning');
    if (!desc) return Swal.fire('Falta información', 'La descripción es obligatoria.', 'warning');

    if (imagenSrc.includes("flaticon")) {
        return Swal.fire('Imagen requerida', 'Debes subir una imagen para el auspiciante.', 'warning');
    }

    const id = inpId.value;

    const dataObj = {
        nombre: nombre,
        codigo: codigo,
        descripcion: desc,
        imagen: null
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(dataObj));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const btnSubmit = form.querySelector('button[type="submit"]');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerText = "Guardando..."; }

        const response = await fetch(url, {
            method: metodo,
            body: formData
        });

        if (response.ok) {
            modalOverlay.style.display = 'none';
            listarAuspiciantes();
            // ALERTA DE ÉXITO
            Swal.fire({
                title: '¡Excelente!',
                text: id ? 'Auspiciante actualizado correctamente' : 'Auspiciante creado correctamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            const errorText = await response.text();
            try {
                const errJson = JSON.parse(errorText);
                Swal.fire('Error', errJson.mensaje || errorText, 'error');
            } catch {
                Swal.fire('Error al guardar', errorText, 'error');
            }
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error de conexión', 'No se pudo contactar con el servidor', 'error');
    } finally {
        const btnSubmit = form.querySelector('button[type="submit"]');
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "Guardar"; }
    }
}

// ELIMINAR CON SWEETALERT (CONFIRMACIÓN)
window.eliminarAuspiciante = function (id) {
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
                const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                if (res.ok || res.status === 204) {
                    Swal.fire('¡Eliminado!', 'El auspiciante ha sido eliminado.', 'success');
                    listarAuspiciantes();
                } else {
                    Swal.fire('Error', 'No se pudo eliminar el registro.', 'error');
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Error de conexión.', 'error');
            }
        }
    });
};

window.cargarEdicion = function (id) {
    if (!auspiciantesCache) return;
    const item = auspiciantesCache.find(a => a.id_auspiciante == id);
    if (!item) return;

    limpiarFormulario();

    inpId.value = item.id_auspiciante;
    inpNombre.value = item.nombre || "";
    inpCodigo.value = item.codigo || "";
    inpDescripcion.value = item.descripcion || "";

    if (item.imagen && item.imagen.length > 5) {
        let imgUrl = item.imagen;
        if (!imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
            imgUrl = `data:image/png;base64,${item.imagen}`;
        }
        previewImagen.src = imgUrl;
    } else {
        previewImagen.src = DEFAULT_IMG;
    }

    const title = document.getElementById('modalTitle');
    if (title) title.innerText = 'Editar Auspiciante';

    if (modalOverlay) modalOverlay.style.display = 'flex';
};

function renderizarGrid(lista) {
    if (!gridAuspiciantes) return;
    gridAuspiciantes.innerHTML = '';

    if (!lista || lista.length === 0) {
        gridAuspiciantes.innerHTML = '<p style="text-align:center; width:100%; color:#666;">No hay resultados.</p>';
        return;
    }

    lista.forEach(item => {
        const nombre = escapeHtml(item.nombre || "Sin Nombre");
        const codigo = escapeHtml(item.codigo || "N/A");
        const desc = escapeHtml(item.descripcion || "Sin descripción");
        const id = item.id_auspiciante;

        let imgUrl = DEFAULT_IMG;

        if (item.imagen && item.imagen.length > 5) {
            if (item.imagen.startsWith('http') || item.imagen.startsWith('data:')) {
                imgUrl = item.imagen;
            } else {
                imgUrl = `data:image/png;base64,${item.imagen}`;
            }
        }

        const card = document.createElement('div');
        card.className = 'card-ausp';
        card.innerHTML = `
           <img src="${imgUrl}" alt="Logo" onerror="this.src='${DEFAULT_IMG}'">
            <h3>${nombre}</h3>
            <p style="font-size:12px; color:#888; margin-bottom:5px;">Code: <strong>${codigo}</strong></p>
            <p style="font-size:13px; color:#666; height:40px; overflow:hidden;">${desc}</p>
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-eliminar" onclick="eliminarAuspiciante(${id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        gridAuspiciantes.appendChild(card);
    });
}

function limpiarFormulario() {
    if (form) form.reset();
    if (inpId) inpId.value = '';
    if (previewImagen) previewImagen.src = DEFAULT_IMG; 
    const title = document.getElementById('modalTitle');
    if (title) title.innerText = 'Agregar Auspiciante';

    fotoNuevaFile = null;
}

async function procesarImagen(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        Swal.fire('Archivo incorrecto', 'Solo se permiten imágenes.', 'error');
        inputImagen.value = "";
        return;
    }

    try {
        const archivoComprimido = await comprimirImagen(file);

        fotoNuevaFile = archivoComprimido;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (previewImagen) previewImagen.src = e.target.result;
        };
        reader.readAsDataURL(archivoComprimido);

    } catch (error) {
        console.error("Error al comprimir:", error);
        Swal.fire('Error', 'No se pudo procesar la imagen', 'error');
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

                    console.log(`Compresión: ${(archivo.size / 1024).toFixed(2)}KB -> ${(archivoComprimido.size / 1024).toFixed(2)}KB`);
                    resolve(archivoComprimido);
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}