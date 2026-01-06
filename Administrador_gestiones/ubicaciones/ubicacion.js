const API_URL = 'https://api-loopi.onrender.com/api/ubicacion_reciclajes';
const API_PARROQUIAS = 'https://api-loopi.onrender.com/api/parroquias';
const API_RECICLADORES = 'https://api-loopi.onrender.com/api/usuarios/recicladores';
const API_MATERIALES = 'https://api-loopi.onrender.com/api/materiales';

const gridUbicaciones = document.getElementById("gridUbicaciones");
const searchInput = document.getElementById("buscarUbicacion");
const modalOverlay = document.getElementById("modalOverlay");
const modalMapa = document.getElementById("modalMapa");

const inputImagen = document.getElementById("inputImg");
const previewImagen = document.getElementById("previewImg");
const selectParroquia = document.getElementById("parroquia");
const selectReciclador = document.getElementById("selectReciclador");
const containerHorarios = document.getElementById("containerHorarios"); 

let ubicacionesCache = [];

let mainMap = null;       
let mainLayerGroup = null; 
let editMap = null;       
let editMarker = null;    

let coordenadasSeleccionadas = null;
let coordenadasTemporales = null;
let fotoNuevaFile = null;

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const iconPuntoFijo = L.divIcon({
  className: "custom-icon",
  html: `<div style="background-color:#2ecc71; width:30px; height:30px; border-radius:50%; display:flex; justify-content:center; align-items:center; border:2px solid white; box-shadow:0 3px 5px rgba(0,0,0,0.3);">
            <i class="fa-solid fa-recycle" style="color:white; font-size:16px;"></i>
         </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const iconRecicladorMovil = L.divIcon({
  className: "custom-icon",
  html: `<div style="background-color:#3498db; width:30px; height:30px; border-radius:50%; display:flex; justify-content:center; align-items:center; border:2px solid white; box-shadow:0 3px 5px rgba(0,0,0,0.3);">
            <i class="fa-solid fa-truck" style="color:white; font-size:14px;"></i>
         </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

document.addEventListener("DOMContentLoaded", () => {
    initMainMap(); 
    cargarParroquias();
    cargarRecicladores();
    cargarMateriales();
    listarUbicaciones();

    inputImagen.addEventListener("change", procesarImagen);

    searchInput.addEventListener("input", (e) => {
        const termino = e.target.value.toLowerCase();
        const filtrados = ubicacionesCache.filter(u =>
            u.nombre.toLowerCase().includes(termino) ||
            u.direccion.toLowerCase().includes(termino)
        );
        renderizarGrid(filtrados);
        renderizarMapaPrincipal(filtrados); 
    });
});

function initMainMap() {
    if(document.getElementById('mapaGeneral')) {
        mainMap = L.map('mapaGeneral').setView([-2.9001, -79.0059], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            attribution: '© OpenStreetMap' 
        }).addTo(mainMap);
        mainLayerGroup = L.layerGroup().addTo(mainMap);
    }
}

function renderizarMapaPrincipal(lista) {
    if(!mainMap || !mainLayerGroup) return;
    mainLayerGroup.clearLayers(); 

    lista.forEach(u => {
        if(u.latitud && u.longitud) {
            const esReciclador = (u.reciclador && u.reciclador.cedula);
            const iconoUsar = esReciclador ? iconRecicladorMovil : iconPuntoFijo;
            const tipoTexto = esReciclador ? "Reciclador Asignado" : "Punto Fijo";

            const marker = L.marker([u.latitud, u.longitud], { icon: iconoUsar });
            
            const popupContent = `
                <div style="text-align:center">
                    <strong>${u.nombre}</strong><br>
                    <small style="color:#666">${tipoTexto}</small><br>
                    <button onclick="cargarDatosEdicion(${u.id_ubicacion_reciclaje})" 
                        style="margin-top:5px; background:#2D5F4F; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                </div>
            `;
            marker.bindPopup(popupContent);
            marker.addTo(mainLayerGroup);
        }
    });
}

function abrirModal() {
    resetearFormulario();
    document.getElementById("tituloModal").innerText = "Nueva Ubicación";
    agregarFilaHorario(null, "08:00", "18:00"); 
    modalOverlay.style.display = "flex";
}

// --- LOGICA INTELIGENTE PARA HORARIOS ---
function agregarFilaHorario(data = null, horaIniDefecto = "08:00", horaFinDefecto = "18:00") {
    
    // Identificar días ya seleccionados
    const diasSeleccionados = Array.from(document.querySelectorAll(".dia-select")).map(s => s.value);
    
    // Buscar el primer día disponible
    let diaSugerido = DIAS_SEMANA.find(d => !diasSeleccionados.includes(d));

    // Si es edición (viene data), usamos el día de la data. Si no hay data y no hay días libres, error.
    if (!data && !diaSugerido) {
        Swal.fire("Horario Completo", "Ya has agregado todos los días de la semana.", "info");
        return;
    }

    const diaVal = data ? data.dia_semana : diaSugerido;
    const iniVal = data ? data.hora_inicio : horaIniDefecto;
    const finVal = data ? data.hora_fin : horaFinDefecto;

    const div = document.createElement("div");
    div.className = "horario-row";
    div.style.display = "flex";
    div.style.gap = "5px";
    div.style.marginBottom = "5px";
    div.style.alignItems = "center";

    // Construir opciones del select
    let optionsHtml = "";
    DIAS_SEMANA.forEach(dia => {
        optionsHtml += `<option value="${dia}" ${dia === diaVal ? 'selected' : ''}>${dia}</option>`;
    });

    div.innerHTML = `
        <select class="input-field dia-select" style="flex: 1; padding: 8px;">
            ${optionsHtml}
        </select>
        <input type="time" class="input-field hora-inicio" value="${iniVal}" style="width: 85px; padding: 8px;">
        <span>-</span>
        <input type="time" class="input-field hora-fin" value="${finVal}" style="width: 85px; padding: 8px;">
        <button type="button" class="btn-delete" style="width: 30px; height: 30px; padding: 0; background: #ffcdd2; color: #c62828; display:flex; align-items:center; justify-content:center;" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    containerHorarios.appendChild(div);
}

async function cargarMateriales() {
    const container = document.getElementById("containerMateriales");
    try {
        const res = await fetch(API_MATERIALES);
        const materiales = await res.json();
        container.innerHTML = ""; 
        materiales.forEach(mat => {
            const div = document.createElement("div");
            div.className = "material-item";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "materiales";
            checkbox.value = mat.id_material;
            checkbox.id = `mat-${mat.id_material}`;
            const label = document.createElement("label");
            label.htmlFor = `mat-${mat.id_material}`;
            label.innerText = mat.nombre;
            label.style.fontWeight = "normal";
            label.style.textTransform = "none";
            label.style.marginBottom = "0";
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
    } catch (e) {
        console.error("Error cargando materiales:", e);
        container.innerHTML = "<p style='color:red'>Error cargando materiales</p>";
    }
}

// --- EDICIÓN ---
window.cargarDatosEdicion = async function (id) {
    const ubi = ubicacionesCache.find(u => u.id_ubicacion_reciclaje == id);
    if (!ubi) return;
    
    resetearFormulario();
    document.getElementById("tituloModal").innerText = "Editar Ubicación";

    document.getElementById("idUbicacion").value = ubi.id_ubicacion_reciclaje;
    document.getElementById("nombrePunto").value = ubi.nombre || "";
    document.getElementById("direccion").value = ubi.direccion || "";

    if (selectParroquia.options.length <= 1) await cargarParroquias();
    if (selectReciclador.options.length <= 1) await cargarRecicladores();

    if (ubi.parroquia) selectParroquia.value = ubi.parroquia.id_parroquia;
    
    if (ubi.reciclador && ubi.reciclador.cedula) selectReciclador.value = ubi.reciclador.cedula.toString();
    else selectReciclador.value = "";

    if (ubi.materialesAceptados && ubi.materialesAceptados.length > 0) {
        ubi.materialesAceptados.forEach(item => {
            if (item.material) {
                const cb = document.getElementById(`mat-${item.material.id_material}`);
                if (cb) cb.checked = true;
            }
        });
    }

    containerHorarios.innerHTML = ""; 
    if (ubi.horarios && ubi.horarios.length > 0) {
        // Ordenar los horarios por día de la semana para que se vea bonito
        const ordenDias = { "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6, "Domingo": 7 };
        ubi.horarios.sort((a,b) => ordenDias[a.dia_semana] - ordenDias[b.dia_semana]);
        
        ubi.horarios.forEach(h => agregarFilaHorario(h));
    } else {
        agregarFilaHorario(null, "08:00", "18:00");
    }

    if (ubi.latitud && ubi.longitud) {
        coordenadasSeleccionadas = { lat: ubi.latitud, lng: ubi.longitud };
        actualizarTextoCoords(ubi.latitud, ubi.longitud);
    }

    if (ubi.foto && ubi.foto.length > 5) {
        let fotoSrc = ubi.foto;
        if (!fotoSrc.startsWith("http") && !fotoSrc.startsWith("data:")) {
             fotoSrc = `data:image/png;base64,${ubi.foto}`;
        }
        previewImagen.style.backgroundImage = `url(${fotoSrc})`;
    }

    modalOverlay.style.display = "flex";
};

function cerrarModal() { modalOverlay.style.display = "none"; }

function resetearFormulario() {
    document.getElementById("idUbicacion").value = "";
    document.getElementById("nombrePunto").value = "";
    document.getElementById("direccion").value = "";
    selectParroquia.value = "";
    selectReciclador.value = "";
    fotoNuevaFile = null;
    inputImagen.value = "";
    previewImagen.style.backgroundImage = "none";
    const checkboxes = document.querySelectorAll('input[name="materiales"]');
    checkboxes.forEach(cb => cb.checked = false);
    containerHorarios.innerHTML = "";
    coordenadasSeleccionadas = null;
    coordenadasTemporales = null;
    actualizarTextoCoords(0.0, 0.0);
}

function actualizarTextoCoords(lat, lng) {
    document.getElementById("txtLat").innerText = lat.toFixed(6);
    document.getElementById("txtLng").innerText = lng.toFixed(6);
}

// MAPA MODAL
window.abrirModalMapa = function () {
    modalMapa.style.display = "flex";
    setTimeout(() => {
        iniciarMapaModal();
        editMap.invalidateSize(); 
        if (coordenadasSeleccionadas) {
            colocarMarcadorModal(coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng);
            editMap.setView([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], 15);
        } else {
            editMap.setView([-2.9001, -79.0059], 13);
            if (editMarker) editMap.removeLayer(editMarker); 
        }
    }, 300);
}
window.cerrarModalMapa = function () { modalMapa.style.display = "none"; }

window.confirmarCoordenadas = function () {
    if (coordenadasTemporales) {
        coordenadasSeleccionadas = coordenadasTemporales;
        actualizarTextoCoords(coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng);
        cerrarModalMapa();
    } else {
        Swal.fire("Atención", "Por favor, haz clic en el mapa para marcar un punto.", "warning");
    }
}

function iniciarMapaModal() {
    if (editMap) return; 
    editMap = L.map('mapaLeaflet').setView([-2.9001, -79.0059], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(editMap);
    editMap.on('click', function (e) { colocarMarcadorModal(e.latlng.lat, e.latlng.lng); });
}

function colocarMarcadorModal(lat, lng) {
    if (editMarker) editMap.removeLayer(editMarker);
    editMarker = L.marker([lat, lng]).addTo(editMap);
    coordenadasTemporales = { lat: lat, lng: lng };
}

async function cargarParroquias() {
    try {
        const res = await fetch(API_PARROQUIAS);
        const data = await res.json();
        selectParroquia.innerHTML = '<option value="">Seleccione...</option>';
        data.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id_parroquia;
            opt.textContent = p.nombre_parroquia;
            selectParroquia.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function cargarRecicladores() {
    try {
        const res = await fetch(API_RECICLADORES);
        const data = await res.json();
        selectReciclador.innerHTML = '<option value="">Ninguno (Sin asignar)</option>';
        if (Array.isArray(data)) {
            data.forEach(r => {
                const opt = document.createElement("option");
                opt.value = r.cedula.toString(); 
                opt.textContent = `${r.primer_nombre} ${r.apellido_paterno}`;
                selectReciclador.appendChild(opt);
            });
        } 
    } catch (e) { console.error(e); }
}

// --- CARGA CON LOADER VISUAL ---
async function listarUbicaciones() {
    try {
        // Mostrar spinner en el grid
        gridUbicaciones.innerHTML = `
            <div class="loader-container">
                <div class="spinner"></div>
                <p>Cargando puntos...</p>
            </div>`;

        const res = await fetch(API_URL);
        const data = await res.json();
        ubicacionesCache = data;
        renderizarGrid(data);
        renderizarMapaPrincipal(data);
    } catch (e) { 
        console.error(e);
        gridUbicaciones.innerHTML = `<p style="text-align:center; color:red; width:100%;">Error al conectar con el servidor.</p>`;
    }
}

// --- GUARDAR CON VALIDACIONES Y LOADING ---
window.guardarUbicacion = async function () {
    const btnGuardar = document.getElementById("btnGuardarUbicacion");
    
    // 1. Recolección de datos
    const idInput = document.getElementById("idUbicacion").value;
    const id = idInput ? parseInt(idInput) : null; 
    
    const nombre = document.getElementById("nombrePunto").value.trim();
    const direccion = document.getElementById("direccion").value.trim();
    const idParroquia = selectParroquia.value;
    const idReciclador = selectReciclador.value;

    // --- VALIDACIONES ---
    if (!nombre) return Swal.fire("Campo requerido", "Ingresa el nombre del punto.", "warning");
    if (!idParroquia) return Swal.fire("Campo requerido", "Selecciona una parroquia.", "warning");
    if (!direccion) return Swal.fire("Campo requerido", "Ingresa una dirección.", "warning");
    if (!coordenadasSeleccionadas) return Swal.fire("Ubicación GPS", "Debes abrir el mapa y marcar el punto exacto.", "warning");

    // Validar Materiales
    const checkboxes = document.querySelectorAll('input[name="materiales"]:checked');
    if (checkboxes.length === 0) return Swal.fire("Materiales", "Selecciona al menos un material aceptado.", "warning");

    // Validar Horarios (Duplicados y Lógica)
    const listaHorarios = [];
    const diasVistos = new Set();
    let errorHorario = null;

    const filasHorario = document.querySelectorAll(".horario-row");
    if(filasHorario.length === 0) return Swal.fire("Horarios", "Agrega al menos un horario de atención.", "warning");

    filasHorario.forEach(row => {
        const dia = row.querySelector(".dia-select").value;
        let ini = row.querySelector(".hora-inicio").value;
        let fin = row.querySelector(".hora-fin").value;
        
        if (diasVistos.has(dia)) {
            errorHorario = `El día ${dia} está repetido. Elimina o cambia la fila.`;
            return;
        }
        diasVistos.add(dia);

        if (!ini || !fin) {
            errorHorario = "Completa todas las horas de inicio y fin.";
            return;
        }
        if (ini >= fin) {
            errorHorario = `En ${dia}, la hora de cierre debe ser después de la apertura.`;
            return;
        }

        if(ini.length === 5) ini += ":00";
        if(fin.length === 5) fin += ":00";
        listaHorarios.push({ dia_semana: dia, hora_inicio: ini, hora_fin: fin });
    });

    if (errorHorario) return Swal.fire("Error en Horarios", errorHorario, "error");

    // 2. Preparar objetos
    const listaMateriales = Array.from(checkboxes).map(cb => ({ material: { id_material: parseInt(cb.value) } }));

    let objReciclador = null;
    if (idReciclador && idReciclador !== "") {
        objReciclador = { cedula: parseInt(idReciclador) }; 
    }

    const datosObj = {
        nombre: nombre,
        direccion: direccion,
        latitud: coordenadasSeleccionadas.lat,
        longitud: coordenadasSeleccionadas.lng,
        foto: null, 
        parroquia: { id_parroquia: parseInt(idParroquia) },
        reciclador: objReciclador,
        materialesAceptados: listaMateriales, 
        horarios: listaHorarios 
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosObj));
    if (fotoNuevaFile) formData.append("archivo", fotoNuevaFile);

    const metodo = id ? "PUT" : "POST";
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        // --- LOADING STATE ---
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        
        // Bloqueo de pantalla suave
        Swal.fire({
            title: "Procesando...",
            text: "Guardando la información de la ubicación",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await fetch(url, { method: metodo, body: formData });

        if (res.ok) {
            Swal.fire({ 
                title: "¡Guardado!", 
                text: "La ubicación se ha registrado correctamente.", 
                icon: "success", 
                timer: 1500, 
                showConfirmButton: false 
            });
            cerrarModal();
            listarUbicaciones();
        } else {
            const errorText = await res.text();
            console.error("Error backend:", errorText);
            Swal.fire("Error", "No se pudo guardar. Revisa los datos.", "error");
        }
    } catch (e) { 
        console.error(e); 
        Swal.fire("Error", "Fallo de conexión con el servidor.", "error");
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
    }
};

function renderizarGrid(lista) {
    gridUbicaciones.innerHTML = "";
    if (lista.length === 0) {
        gridUbicaciones.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">No se encontraron ubicaciones.</div>`;
        return;
    }

    lista.forEach(ubi => {
        let imgUrl = 'https://placehold.co/300x150?text=Sin+Imagen';
        if (ubi.foto && ubi.foto.length > 5) {
            if (ubi.foto.startsWith("http") || ubi.foto.startsWith("data:")) {
                imgUrl = ubi.foto;
            } else {
                imgUrl = `data:image/jpeg;base64,${ubi.foto}`;
            }
        }

        let txtReciclador = '<span style="color:#999">Sin Asignar</span>';
        let tipoBadge = '<span class="card-badge" style="background:#2ecc71;">Punto Fijo</span>';
        
        if (ubi.reciclador) {
            txtReciclador = `<strong>${ubi.reciclador.primer_nombre} ${ubi.reciclador.apellido_paterno}</strong>`;
            tipoBadge = '<span class="card-badge" style="background:#3498db;">Reciclador</span>';
        }

        const card = document.createElement('div');
        card.className = 'card-ubicacion';
        card.innerHTML = `
            <div class="card-img" style="background-image: url('${imgUrl}')">
                ${tipoBadge}
            </div>
            <div class="card-body">
                <div class="card-title">${ubi.nombre}</div>
                <div class="card-sub"><i class="fa-solid fa-map-pin"></i> ${ubi.direccion || 'Sin dirección'}</div>
                
                <div class="info-block">
                    <div>👤 ${txtReciclador}</div>
                    <div style="margin-top:4px;">🏙️ ${ubi.parroquia?.nombre_parroquia || ''}</div>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-edit" onclick="cargarDatosEdicion(${ubi.id_ubicacion_reciclaje})">
                    <i class="fa-solid fa-pen-to-square"></i> Editar
                </button>
                <button class="btn-delete" onclick="eliminarUbicacion(${ubi.id_ubicacion_reciclaje})">
                    <i class="fa-solid fa-trash-can"></i> Eliminar
                </button>
            </div>
        `;
        gridUbicaciones.appendChild(card);
    });
}

async function procesarImagen(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const compressedFile = await comprimirImagen(file);
        fotoNuevaFile = compressedFile;
        const reader = new FileReader();
        reader.onload = (ev) => { previewImagen.style.backgroundImage = `url(${ev.target.result})`; };
        reader.readAsDataURL(compressedFile);
    } catch (error) { Swal.fire("Error", "No se pudo procesar la imagen", "error"); }
}
async function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 800; canvas.height = (800 / img.width) * img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(new File([blob], archivo.name, { type: 'image/jpeg' })), 'image/jpeg', 0.7);
            };
        };
    });
}

window.eliminarUbicacion = async function (id) {
    Swal.fire({
        title: '¿Eliminar ubicación?',
        text: "No podrás revertir esto.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                Swal.fire({title: "Eliminando...", didOpen: () => Swal.showLoading()});
                await fetch(`${API_URL}/${id}`, { method: "DELETE" });
                listarUbicaciones();
                Swal.fire('Eliminado', 'La ubicación ha sido eliminada.', 'success');
            } catch (e) {
                Swal.fire('Error', 'No se pudo eliminar.', 'error');
            }
        }
    });
};

window.obtenerUbicacionActual = function() {
    if (!navigator.geolocation) { Swal.fire("Error", "GPS no soportado.", "error"); return; }
    
    Swal.fire({ title: "Obteniendo GPS...", didOpen: () => Swal.showLoading() });
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            Swal.close();
            if (editMap) { 
                editMap.setView([pos.coords.latitude, pos.coords.longitude], 18); 
                colocarMarcadorModal(pos.coords.latitude, pos.coords.longitude); 
            }
        },
        () => Swal.fire("Error", "No se pudo obtener ubicación.", "error")
    );
}