const API_RECOMPENSAS = 'https://api-loopi.onrender.com/api/recompensas';
const API_AUSPICIANTES = 'https://api-loopi.onrender.com/api/auspiciantes';

const gridRecompensas = document.getElementById('gridRecompensas');
const searchInput = document.getElementById('buscarRecompensa');
const modalOverlay = document.getElementById('modalOverlay'); 
const modalMapa = document.getElementById('modalMapa');       
const form = document.getElementById('formRecompensa');
const btnNuevo = document.getElementById('btnNuevaRecompensa');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelar');
const selectAuspiciante = document.getElementById('auspicianteRecompensa');

let recompensasCache = [];
let map = null; 
let marker;
let coordenadasSeleccionadas = null; 
let coordenadasTemporales = null;    

document.addEventListener('DOMContentLoaded', () => {
    listarRecompensas();
    cargarAuspiciantesEnSelect();

    if(btnNuevo) btnNuevo.addEventListener('click', () => {
        limpiarFormulario();
        modalOverlay.style.display = 'flex';
    });

    if(btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
    if(btnCancelar) btnCancelar.addEventListener('click', cerrarModal);

    if(form) form.addEventListener('submit', guardarRecompensa);

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const filtradas = recompensasCache.filter(r => 
                r.nombre.toLowerCase().includes(termino) || 
                (r.auspiciante && r.auspiciante.nombre.toLowerCase().includes(termino))
            );
            renderizarGrid(filtradas);
        });
    }
});


window.abrirModalMapa = function() {
    modalMapa.style.display = 'flex';
    setTimeout(() => {
        iniciarMapa();
        map.invalidateSize(); 
        
        if (coordenadasSeleccionadas) {
            colocarMarcador(coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng);
            map.setView([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], 15);
        } else {
            // Coordenadas por defecto (puedes cambiarlas a tu ciudad)
            map.setView([-2.9001, -79.0059], 13); 
            if (marker) map.removeLayer(marker);
        }
    }, 300);
}

window.cerrarModalMapa = function() {
    modalMapa.style.display = 'none';
}

window.confirmarCoordenadas = function() {
    if (coordenadasTemporales) {
        coordenadasSeleccionadas = coordenadasTemporales;
        document.getElementById("txtLat").innerText = coordenadasSeleccionadas.lat.toFixed(6);
        document.getElementById("txtLng").innerText = coordenadasSeleccionadas.lng.toFixed(6);
        cerrarModalMapa();
    } else {
        Swal.fire('Mapa', 'Haz clic en el mapa para seleccionar un punto exacto.', 'info');
    }
}

function iniciarMapa() {
    if (map) return;
    map = L.map('mapaLeaflet').setView([-2.9001, -79.0059], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    map.on('click', function(e) {
        colocarMarcador(e.latlng.lat, e.latlng.lng);
    });
}

function colocarMarcador(lat, lng) {
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
    coordenadasTemporales = { lat: lat, lng: lng };
}


async function cargarAuspiciantesEnSelect() {
    try {
        const response = await fetch(API_AUSPICIANTES);
        if (!response.ok) return;
        const auspiciantes = await response.json();
        selectAuspiciante.innerHTML = '<option value="">Seleccione...</option>';
        auspiciantes.forEach(ausp => {
            const option = document.createElement('option');
            option.value = ausp.id_auspiciante; 
            option.textContent = ausp.nombre;
            selectAuspiciante.appendChild(option);
        });
    } catch (e) { console.error(e); }
}

async function listarRecompensas() {
    try {
        const response = await fetch(API_RECOMPENSAS);
        const lista = await response.json();
        recompensasCache = lista;
        renderizarGrid(lista);
    } catch (e) { 
        console.error(e); 
        gridRecompensas.innerHTML = '<p style="text-align:center; color:red;">Error de conexión</p>';
    }
}

async function guardarRecompensa(e) {
    e.preventDefault();

    const id = document.getElementById('idRecompensa').value;
    const nombre = document.getElementById('nombreRecompensa').value.trim();
    const costo = parseInt(document.getElementById('costoRecompensa').value);
    const idAusp = selectAuspiciante.value;

    // VALIDACIONES SWEETALERT
    if (costo <= 0) {
        return Swal.fire('Atención', 'El costo en puntos debe ser mayor a 0.', 'warning');
    }

    const existeNombre = recompensasCache.some(r => {
        const mismoNombre = r.nombre.toLowerCase() === nombre.toLowerCase();
        if (id) {
            return mismoNombre && r.id_recompensa != id;
        }
        return mismoNombre;
    });

    if (existeNombre) {
        return Swal.fire('Duplicado', 'Ya existe una recompensa con ese nombre.', 'error');
    }

    if (!idAusp) {
        return Swal.fire('Faltan datos', 'Seleccione un auspiciante.', 'warning');
    }

    if (!coordenadasSeleccionadas) {
        return Swal.fire('Ubicación requerida', 'Debes abrir el mapa y seleccionar donde se retira la recompensa.', 'warning');
    }

    const data = {
        nombre: nombre,
        descripcion: document.getElementById('descripcionRecompensa').value,
        costoPuntos: costo,
        direccion: document.getElementById('direccionRecompensa').value,
        latitud: coordenadasSeleccionadas ? coordenadasSeleccionadas.lat : null,
        longitud: coordenadasSeleccionadas ? coordenadasSeleccionadas.lng : null,
        auspiciante: { id_auspiciante: parseInt(idAusp) }
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_RECOMPENSAS}/${id}` : API_RECOMPENSAS;

    try {
        // Bloquear botón
        const btnGuardar = form.querySelector('.btn-guardar');
        const txtOriginal = btnGuardar.innerText;
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Guardando...";

        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            cerrarModal();
            listarRecompensas();
            Swal.fire({
                title: '¡Excelente!',
                text: id ? 'Recompensa actualizada' : 'Recompensa creada con éxito',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire('Error', 'No se pudo guardar la recompensa.', 'error');
        }

        btnGuardar.disabled = false;
        btnGuardar.innerText = txtOriginal;

    } catch (e) { 
        console.error(e); 
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
    }
}

window.cargarEdicion = function(id) {
    const item = recompensasCache.find(r => r.id_recompensa === id);
    if (!item) return;

    document.getElementById('idRecompensa').value = item.id_recompensa;
    document.getElementById('nombreRecompensa').value = item.nombre;
    document.getElementById('descripcionRecompensa').value = item.descripcion;
    document.getElementById('costoRecompensa').value = item.costoPuntos;
    document.getElementById('direccionRecompensa').value = item.direccion || "";

    if (item.auspiciante) selectAuspiciante.value = item.auspiciante.id_auspiciante;

    if (item.latitud && item.longitud) {
        coordenadasSeleccionadas = { lat: item.latitud, lng: item.longitud };
        document.getElementById("txtLat").innerText = item.latitud.toFixed(6);
        document.getElementById("txtLng").innerText = item.longitud.toFixed(6);
    } else {
        coordenadasSeleccionadas = null;
        document.getElementById("txtLat").innerText = "0.0";
        document.getElementById("txtLng").innerText = "0.0";
    }

    document.getElementById('modalTitle').innerText = 'Editar Recompensa';
    modalOverlay.style.display = 'flex';
};

window.eliminarRecompensa = function(id) {
    if (!id) return;

    Swal.fire({
        title: '¿Eliminar recompensa?',
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
                const response = await fetch(`${API_RECOMPENSAS}/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    listarRecompensas();
                    Swal.fire('Eliminado', 'La recompensa ha sido eliminada.', 'success');
                } else {
                    Swal.fire('Error', 'No se pudo eliminar.', 'error');
                }
            } catch (e) { 
                console.error(e); 
                Swal.fire('Error', 'Error de conexión.', 'error');
            }
        }
    });
};

function renderizarGrid(lista) {
    gridRecompensas.innerHTML = '';
    if (!lista || lista.length === 0) {
        gridRecompensas.innerHTML = '<p style="text-align:center; width:100%; color: #666;">No hay recompensas registradas.</p>';
        return;
    }

    lista.forEach(item => {
        const nombreAusp = item.auspiciante ? item.auspiciante.nombre : 'Sin Auspiciante';
        const card = document.createElement('div');
        card.className = 'card-recompensa';
        card.innerHTML = `
            <div style="font-size:30px; margin-bottom:10px; text-align:center;">🎁</div>
            <h3 style="text-align:center;">${item.nombre}</h3>
            <div style="text-align:center; margin: 5px 0;">
                <span style="background:#e8f5e9; color:#2e7d32; padding: 4px 10px; border-radius: 12px; font-weight:bold; font-size:13px;">
                    ${item.costoPuntos} Puntos
                </span>
            </div>
            <p style="font-size:13px; text-align:center; margin-top:10px;">
                <i class="fa-solid fa-handshake"></i> ${nombreAusp}
            </p>
            <p style="font-size:12px; color:#555; text-align:center;">
                <i class="fa-solid fa-location-dot"></i> ${item.direccion || 'Sin dirección'}
            </p>
            <div class="acciones">
                <button class="btn-editar" onclick="cargarEdicion(${item.id_recompensa})" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-eliminar" onclick="eliminarRecompensa(${item.id_recompensa})" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        gridRecompensas.appendChild(card);
    });
}

function cerrarModal() {
    modalOverlay.style.display = 'none';
    limpiarFormulario();
}

function limpiarFormulario() {
    form.reset();
    document.getElementById('idRecompensa').value = '';
    document.getElementById('modalTitle').innerText = 'Nueva Recompensa';
    selectAuspiciante.value = "";
    
    coordenadasSeleccionadas = null;
    coordenadasTemporales = null;
    document.getElementById("txtLat").innerText = "0.0";
    document.getElementById("txtLng").innerText = "0.0";
    if(marker && map) map.removeLayer(marker);
}