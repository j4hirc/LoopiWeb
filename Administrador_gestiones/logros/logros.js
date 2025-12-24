const API_URL = 'https://api-loopi.onrender.com/api/logros';

const gridLogros = document.getElementById('gridLogros');
const searchInput = document.getElementById('buscarLogro');
const modalOverlay = document.getElementById('modalOverlay');
const form = document.getElementById('formLogro');
const btnNuevo = document.getElementById('btnNuevoLogro');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');

const btnImagen = document.getElementById('btnImagenLogro');
const inputImagen = document.getElementById('insigniaLogro');
const previewImagen = document.getElementById('previewLogro');

let logrosCache = [];
let fotoNuevaFile = null; // Variable global para el archivo real

document.addEventListener('DOMContentLoaded', () => {
    listarLogros();

    btnNuevo.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    btnCerrarModal.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);

    btnImagen.addEventListener('click', () => inputImagen.click());
    inputImagen.addEventListener('change', procesarImagen); // Ahora usa la función con compresión

    form.addEventListener('submit', guardarLogro);

    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        const filtrados = logrosCache.filter(l => 
            l.nombre.toLowerCase().includes(termino) || 
            l.descripcion.toLowerCase().includes(termino)
        );
        renderizarGrid(filtrados);
    });
});

async function listarLogros() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Error al cargar logros');
        const logros = await response.json();
        
        logrosCache = logros;
        renderizarGrid(logros);
    } catch (error) {
        console.error(error);
        gridLogros.innerHTML = '<p style="text-align:center; color:red;">No se pudo conectar con el servidor.</p>';
    }
}

async function guardarLogro(e) {
    e.preventDefault();

    const id = document.getElementById('idLogro').value;
    const nombre = document.getElementById('nombreLogro').value;
    const desc = document.getElementById('descripcionLogro').value;
    const puntos = document.getElementById('puntosLogro').value;

    if(!nombre || !puntos) return alert("Nombre y Puntos son obligatorios");
    
    const logroData = {
        nombre: nombre,
        descripcion: desc,
        puntos_ganados: parseInt(puntos),
        imagen_logro: null 
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(logroData));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const btnSubmit = form.querySelector('button[type="submit"]');
        if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerText = "Guardando..."; }

        const response = await fetch(url, {
            method: metodo,
            body: formData 
        });

        if (response.ok) {
            cerrarModal();
            listarLogros();
            alert("Logro guardado correctamente");
        } else {
            const errText = await response.text();
            console.error(errText);
            alert('Error al guardar. Revisa los datos.');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    } finally {
        const btnSubmit = form.querySelector('button[type="submit"]');
        if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "Guardar"; }
    }
}

window.eliminarLogro = async function(id) {
    if (!confirm('¿Eliminar este logro?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        if (response.ok || response.status === 204) {
            listarLogros();
        } else {
            alert('No se pudo eliminar');
        }
    } catch (error) {
        console.error(error);
    }
};

window.cargarEdicion = function(id) {
    const logro = logrosCache.find(l => l.id_logro === id);
    if (!logro) return;

    limpiarFormulario(); // Limpiar previo

    document.getElementById('idLogro').value = logro.id_logro;
    document.getElementById('nombreLogro').value = logro.nombre;
    document.getElementById('descripcionLogro').value = logro.descripcion;
    document.getElementById('puntosLogro').value = logro.puntos_ganados || logro.Puntos_ganados;

    if (logro.imagen_logro && logro.imagen_logro.length > 5) {
        let imgUrl = logro.imagen_logro;
        if (!imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
             imgUrl = `data:image/png;base64,${logro.imagen_logro}`;
        }
        previewImagen.src = imgUrl;
    } else {
        previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png';
    }

    document.getElementById('modalTitle').innerText = 'Editar Logro';
    modalOverlay.style.display = 'flex';
};

function renderizarGrid(logros) {
    gridLogros.innerHTML = '';

    if (logros.length === 0) {
        gridLogros.innerHTML = '<p style="text-align:center; color:#777;">No hay logros registrados.</p>';
        return;
    }

    logros.forEach(l => {
        let imgUrl = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png';
        
        if (l.imagen_logro && l.imagen_logro.length > 5) {
            if (l.imagen_logro.startsWith('http') || l.imagen_logro.startsWith('data:')) {
                imgUrl = l.imagen_logro;
            } else {
                imgUrl = `data:image/png;base64,${l.imagen_logro}`;
            }
        }

        const puntos = l.puntos_ganados || l.Puntos_ganados || 0;

        const card = document.createElement('div');
        card.className = 'card-logro';

        card.innerHTML = `
            <img src="${imgUrl}" alt="Insignia" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1828/1828884.png'">
            <h3>${l.nombre}</h3>
            <p>${l.descripcion || ''}</p>
            
            <div class="puntos" style="background:#e3f2fd; color:#1565c0; font-size: 0.9em; padding: 5px 10px; border-radius: 5px;">
                🔓 Se desbloquea a los <strong>${puntos} Pts</strong>
            </div>
            
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${l.id_logro})" title="Editar">
                    ✎
                </button>
                <button class="btn-eliminar" onclick="eliminarLogro(${l.id_logro})" title="Eliminar">
                    🗑
                </button>
            </div>
        `;
        gridLogros.appendChild(card);
    });
}

function cerrarModal() {
    modalOverlay.style.display = 'none';
    limpiarFormulario();
}

function limpiarFormulario() {
    form.reset();
    document.getElementById('idLogro').value = '';
    document.getElementById('modalTitle').innerText = 'Nuevo Logro';
    previewImagen.src = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png';
    fotoNuevaFile = null; 
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