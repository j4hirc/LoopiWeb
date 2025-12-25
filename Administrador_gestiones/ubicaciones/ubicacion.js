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
let map = null;
let marker;
let coordenadasSeleccionadas = null;
let coordenadasTemporales = null;
let fotoNuevaFile = null;

document.addEventListener("DOMContentLoaded", () => {
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
    });
});

function abrirModal() {
    resetearFormulario();
    document.getElementById("tituloModal").innerText = "Nueva Ubicación";
    
    // MEJORA 1: Agregar horario por defecto al abrir
    agregarFilaHorario(null, "08:00", "18:00"); 
    
    modalOverlay.style.display = "flex";
}

// --- FUNCIÓN MEJORADA: AGREGAR FILA DE HORARIO ---
// Ahora acepta valores opcionales para autocompletar
function agregarFilaHorario(data = null, horaIniDefecto = "", horaFinDefecto = "") {
    
    // Si no es edición (data es null) y no se pasan valores por defecto,
    // intentamos copiar de la fila anterior (MEJORA 2)
    if (!data && (!horaIniDefecto || !horaFinDefecto)) {
        const filas = containerHorarios.querySelectorAll(".horario-row");
        if (filas.length > 0) {
            const ultima = filas[filas.length - 1];
            horaIniDefecto = ultima.querySelector(".hora-inicio").value;
            horaFinDefecto = ultima.querySelector(".hora-fin").value;
        }
    }

    const div = document.createElement("div");
    div.className = "horario-row";
    div.style.display = "flex";
    div.style.gap = "10px";
    div.style.marginBottom = "10px";
    div.style.alignItems = "center";

    // Prioridad de valores: 1. Datos de BD -> 2. Valores copiados/defecto -> 3. Vacío
    const diaVal = data ? data.dia_semana : "Lunes";
    const iniVal = data ? data.hora_inicio : horaIniDefecto;
    const finVal = data ? data.hora_fin : horaFinDefecto;

    div.innerHTML = `
        <select class="input-field dia-select" style="flex: 1;">
            <option value="Lunes" ${diaVal === 'Lunes' ? 'selected' : ''}>Lunes</option>
            <option value="Martes" ${diaVal === 'Martes' ? 'selected' : ''}>Martes</option>
            <option value="Miércoles" ${diaVal === 'Miércoles' ? 'selected' : ''}>Miércoles</option>
            <option value="Jueves" ${diaVal === 'Jueves' ? 'selected' : ''}>Jueves</option>
            <option value="Viernes" ${diaVal === 'Viernes' ? 'selected' : ''}>Viernes</option>
            <option value="Sábado" ${diaVal === 'Sábado' ? 'selected' : ''}>Sábado</option>
            <option value="Domingo" ${diaVal === 'Domingo' ? 'selected' : ''}>Domingo</option>
        </select>
        <input type="time" class="input-field hora-inicio" value="${iniVal}" style="width: 100px;">
        <span>a</span>
        <input type="time" class="input-field hora-fin" value="${finVal}" style="width: 100px;">
        <button type="button" class="btn-delete" style="padding: 5px 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    containerHorarios.appendChild(div);
}

// ... (cargarMateriales sigue igual) ...
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
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
    } catch (e) {
        console.error("Error cargando materiales:", e);
        container.innerHTML = "<p style='color:red'>Error al cargar materiales</p>";
    }
}

// --- MODIFICADO: CARGAR DATOS + HORARIOS ---
window.cargarDatosEdicion = async function (id) {
    const ubi = ubicacionesCache.find(u => u.id_ubicacion_reciclaje == id);
    if (!ubi) {
        console.error("No se encontró la ubicación con ID:", id);
        return;
    }
    resetearFormulario();
    document.getElementById("tituloModal").innerText = "Editar Ubicación";

    document.getElementById("idUbicacion").value = ubi.id_ubicacion_reciclaje;
    document.getElementById("nombrePunto").value = ubi.nombre || "";
    document.getElementById("direccion").value = ubi.direccion || "";

    if (selectParroquia.options.length <= 1) await cargarParroquias();
    if (selectReciclador.options.length <= 1) await cargarRecicladores();

    if (ubi.parroquia) {
        selectParroquia.value = ubi.parroquia.id_parroquia;
    }

    if (ubi.reciclador && ubi.reciclador.cedula) {
        selectReciclador.value = ubi.reciclador.cedula.toString();
    } else {
        selectReciclador.value = "";
    }

    // Materiales
    if (ubi.materialesAceptados && ubi.materialesAceptados.length > 0) {
        ubi.materialesAceptados.forEach(item => {
            if (item.material) {
                const cb = document.getElementById(`mat-${item.material.id_material}`);
                if (cb) cb.checked = true;
            }
        });
    }

    // --- CARGAR HORARIOS ---
    containerHorarios.innerHTML = ""; // Limpiar
    if (ubi.horarios && ubi.horarios.length > 0) {
        ubi.horarios.forEach(h => agregarFilaHorario(h));
    } else {
        // Si editamos y no tiene horarios, poner uno por defecto vacío o estándar
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

function cerrarModal() {
    modalOverlay.style.display = "none";
}

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

// ... (actualizarTextoCoords, modalMapa, etc. siguen igual hasta el GUARDAR) ...
function actualizarTextoCoords(lat, lng) {
    document.getElementById("txtLat").innerText = lat.toFixed(6);
    document.getElementById("txtLng").innerText = lng.toFixed(6);
}
window.abrirModalMapa = function () {
    modalMapa.style.display = "flex";
    setTimeout(() => {
        iniciarMapa();
        map.invalidateSize(); 
        if (coordenadasSeleccionadas) {
            colocarMarcador(coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng);
            map.setView([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], 15);
        } else {
            map.setView([-2.9001, -79.0059], 13);
            if (marker) map.removeLayer(marker); 
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
function iniciarMapa() {
    if (map) return; 
    map = L.map('mapaLeaflet').setView([-2.9001, -79.0059], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    map.on('click', function (e) { colocarMarcador(e.latlng.lat, e.latlng.lng); });
}
function colocarMarcador(lat, lng) {
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
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
    } catch (e) { console.error("Error en el fetch de recicladores:", e); }
}
async function listarUbicaciones() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        ubicacionesCache = data;
        renderizarGrid(data);
    } catch (e) { console.error(e); }
}

// =================================================================
// GUARDAR UBICACIÓN (VALIDADO)
// =================================================================
window.guardarUbicacion = async function () {
    // 1. Obtener valores
    const idInput = document.getElementById("idUbicacion").value;
    const id = idInput ? parseInt(idInput) : null; // Asegurar que sea número o null
    
    const nombre = document.getElementById("nombrePunto").value;
    const direccion = document.getElementById("direccion").value;
    const idParroquia = selectParroquia.value;
    const idReciclador = selectReciclador.value;

    // 2. Validaciones Básicas
    if (!nombre || !coordenadasSeleccionadas || !idParroquia) {
        Swal.fire("Incompleto", "Nombre, Parroquia y Mapa son obligatorios.", "warning");
        return;
    }

    // 3. Procesar Horarios
    const listaHorarios = [];
    document.querySelectorAll(".horario-row").forEach(row => {
        const dia = row.querySelector(".dia-select").value;
        let ini = row.querySelector(".hora-inicio").value;
        let fin = row.querySelector(".hora-fin").value;
        
        if (dia && ini && fin) {
            // Asegurar formato HH:mm:ss para LocalTime en Java
            if(ini.length === 5) ini += ":00";
            if(fin.length === 5) fin += ":00";

            listaHorarios.push({
                dia_semana: dia,
                hora_inicio: ini,
                hora_fin: fin
            });
        }
    });

    if(listaHorarios.length === 0) {
        Swal.fire("Atención", "Agrega al menos un horario de atención.", "warning");
        return;
    }

   const checkboxes = document.querySelectorAll('input[name="materiales"]:checked');
    
    if (checkboxes.length === 0) {
        Swal.fire("Atención", "Debes seleccionar al menos un material aceptado.", "warning");
        return;
    }

    const listaMateriales = Array.from(checkboxes).map(cb => {
        return { 
            material: { 
                id_material: parseInt(cb.value) 
            } 
        };
    });

    // 5. Procesar Reciclador (Opcional)
    let objReciclador = null;
    if (idReciclador && idReciclador !== "") {
        objReciclador = { cedula: parseInt(idReciclador) }; 
    }

    // 6. Construir el objeto principal
    const datosObj = {
        nombre: nombre,
        direccion: direccion,
        latitud: coordenadasSeleccionadas.lat,
        longitud: coordenadasSeleccionadas.lng,
        // Enviamos null en la foto dentro del JSON, el backend ignora esto al editar
        // y solo usa el archivo Multipart si existe.
        foto: null, 
        parroquia: { id_parroquia: parseInt(idParroquia) },
        reciclador: objReciclador,
        materialesAceptados: listaMateriales, // Enviamos el array procesado
        horarios: listaHorarios 
    };

    // --- DEPURACIÓN: MIRA ESTO EN LA CONSOLA DEL NAVEGADOR (F12) ---
    console.log("JSON a enviar:", JSON.stringify(datosObj));
    // ---------------------------------------------------------------

    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosObj));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    // Definir URL y Método
    const metodo = id ? "PUT" : "POST";
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        Swal.fire({ title: "Guardando...", didOpen: () => Swal.showLoading() });

        const res = await fetch(url, {
            method: metodo,
            body: formData 
        });

        if (res.ok) {
            Swal.fire({
                title: "¡Éxito!",
                text: "Ubicación guardada correctamente.",
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
            cerrarModal();
            listarUbicaciones();
        } else {
            const errorText = await res.text();
            console.error("Error backend:", errorText);
            try {
                const errorJson = JSON.parse(errorText);
                Swal.fire("Error", errorJson.mensaje || "Error al guardar", "error");
            } catch {
                Swal.fire("Error", "No se pudo guardar. Revisa la consola.", "error");
            }
        }
    } catch (e) { 
        console.error(e); 
        Swal.fire("Error", "Fallo de conexión.", "error");
    }
};


function renderizarGrid(lista) {
    gridUbicaciones.innerHTML = "";
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
        if (ubi.reciclador) txtReciclador = `<strong>${ubi.reciclador.primer_nombre} ${ubi.reciclador.apellido_paterno}</strong>`;

        const card = document.createElement('div');
        card.className = 'card-ubicacion';
        card.innerHTML = `
            <div class="card-img" style="background-image: url('${imgUrl}')"></div>
            <div class="card-body">
                <div class="card-title">${ubi.nombre}</div>
                <div class="card-sub">${ubi.direccion}</div>
                <div class="card-coords" style="margin-top:8px; font-size:12px;">👤 ${txtReciclador}</div>
                <div class="card-coords">📍 ${ubi.latitud?.toFixed(4)}, ${ubi.longitud?.toFixed(4)} <br> 🏙️ ${ubi.parroquia?.nombre_parroquia || ''}</div>
            </div>
            <div class="card-actions">
                <button class="btn-edit" onclick="cargarDatosEdicion(${ubi.id_ubicacion_reciclaje})">Editar</button>
                <button class="btn-delete" onclick="eliminarUbicacion(${ubi.id_ubicacion_reciclaje})">Eliminar</button>
            </div>
        `;
        gridUbicaciones.appendChild(card);
    });
}

// ... (Funciones de imagen, GPS y borrar siguen igual, las incluyo por si acaso) ...
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
    if (confirm("¿Eliminar?")) { await fetch(`${API_URL}/${id}`, { method: "DELETE" }); listarUbicaciones(); }
};
window.obtenerUbicacionActual = function() {
    if (!navigator.geolocation) { Swal.fire("Error", "GPS no soportado.", "error"); return; }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            if (map) { map.setView([pos.coords.latitude, pos.coords.longitude], 18); colocarMarcador(pos.coords.latitude, pos.coords.longitude); }
        },
        () => Swal.fire("Error", "No se pudo obtener ubicación.", "error")
    );
}