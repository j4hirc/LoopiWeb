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

document.addEventListener('DOMContentLoaded', () => {
    listarLogros();

    btnNuevo.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    btnCerrarModal.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);

    btnImagen.addEventListener('click', () => inputImagen.click());
    inputImagen.addEventListener('change', procesarImagen);

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
    
    const logroData = {
        nombre: document.getElementById('nombreLogro').value,
        descripcion: document.getElementById('descripcionLogro').value,
        puntos_ganados: parseInt(document.getElementById('puntosLogro').value),
        imagen_logro: previewImagen.src
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logroData)
        });

        if (response.ok) {
            cerrarModal();
            listarLogros();
        } else {
            alert('Error al guardar. Revisa los datos.');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
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

    document.getElementById('idLogro').value = logro.id_logro;
    document.getElementById('nombreLogro').value = logro.nombre;
    document.getElementById('descripcionLogro').value = logro.descripcion;
    
    document.getElementById('puntosLogro').value = logro.puntos_ganados || logro.Puntos_ganados;

    if (logro.imagen_logro && logro.imagen_logro.length > 20) {
        previewImagen.src = logro.imagen_logro.startsWith('data:image') 
            ? logro.imagen_logro 
            : `data:image/png;base64,${logro.imagen_logro}`;
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
        if (l.imagen_logro && l.imagen_logro.length > 20) {
            imgUrl = l.imagen_logro.startsWith('data:image') ? l.imagen_logro : `data:image/png;base64,${l.imagen_logro}`;
        }

        const puntos = l.puntos_ganados || l.Puntos_ganados || 0;

        const card = document.createElement('div');
        card.className = 'card-logro';

        card.innerHTML = `
            <img src="${imgUrl}" alt="Insignia">
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
}

function procesarImagen(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImagen.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}