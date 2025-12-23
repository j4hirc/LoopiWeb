const API_BASE = 'https://api-loopi.onrender.com/api';

let map, marker, coordenadas;
let fotoBase64 = null;
let evidenciaBase64 = null;
let materialesSeleccionados = new Set();

document.addEventListener("DOMContentLoaded", async () => {
    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
        window.location.href = "../incio_de_sesion/login-registro.html";
        return;
    }
    const usuario = JSON.parse(usuarioStr);

    verificarEstadoReciclador(usuario.cedula);

    initMap();
    cargarMateriales();
    agregarFilaHorario(); // Una fila por defecto

    setupImageUpload('fotoProfesional', 'previewFoto', 'placeholderFoto', res => fotoBase64 = res);
    setupImageUpload('evidenciaExperiencia', 'previewEvidencia', 'placeholderEvidencia', res => evidenciaBase64 = res);

    document.getElementById("btnGeo").addEventListener("click", obtenerUbicacionActual);
    document.getElementById("formReciclador").addEventListener("submit", enviarFormulario);
});

function setupImageUpload(inputId, imgId, placeholderId, callback) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', function() {
        const file = this.files[0];
        if(!file) return;

        if(!file.type.startsWith('image/')) {
            Swal.fire("Archivo inválido", "Solo se permiten imágenes (JPG, PNG).", "error");
            this.value = "";
            return;
        }

        if(file.size > 5 * 1024 * 1024) {
            Swal.fire("Archivo muy pesado", "La imagen no debe superar los 5MB.", "warning");
            this.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(imgId);
            const placeholder = document.getElementById(placeholderId);
            
            preview.src = e.target.result;
            preview.style.display = 'block'; 
            preview.classList.remove('preview-hidden');
            preview.classList.add('preview-image');
            
            if(placeholder) placeholder.style.display = 'none'; 

            const base64Clean = e.target.result.split(',')[1];
            callback(base64Clean);
        };
        reader.readAsDataURL(file);
    });
}

async function verificarEstadoReciclador(cedula) {
    try {
        const res = await fetch(`${API_BASE}/formularios_reciclador/usuario/${cedula}`);
        if(res.ok) {
            const form = await res.json();
            if(form.aprobado === true) {
                redirigirConMensaje("¡Ya eres Reciclador!", "Tu cuenta ya está activa.", "success", "../inicio_usuario_normal.html");
            } else {
                redirigirConMensaje("Solicitud en proceso", "Ya enviaste una solicitud. Espera la respuesta.", "info", "../inicio_usuario_normal.html");
            }
        }
    } catch(e) { console.log("Usuario nuevo, puede postular."); }
}

function redirigirConMensaje(titulo, texto, icono, url) {
    Swal.fire({ title: titulo, text: texto, icon: icono, confirmButtonColor: "#3A6958", allowOutsideClick: false })
    .then(() => window.location.href = url);
}

function initMap() {
    map = L.map("mapaRegistro").setView([-2.9001, -79.0059], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    map.on("click", e => actualizarMarcador(e.latlng.lat, e.latlng.lng));
}

function obtenerUbicacionActual() {
    if(!navigator.geolocation) return Swal.fire("Error", "Geolocalización no soportada", "error");
    Swal.showLoading();
    navigator.geolocation.getCurrentPosition(pos => {
        Swal.close();
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 16);
        actualizarMarcador(latitude, longitude);
    }, () => Swal.fire("Error", "No se pudo obtener ubicación", "error"));
}

function actualizarMarcador(lat, lng) {
    if(marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
    coordenadas = { lat, lng };
    document.getElementById("txtLat").innerText = lat.toFixed(5);
    document.getElementById("txtLng").innerText = lng.toFixed(5);
}

async function cargarMateriales() {
    try {
        const res = await fetch(`${API_BASE}/materiales`);
        if(!res.ok) return;
        const list = await res.json();
        const grid = document.getElementById("materialesGrid");
        grid.innerHTML = "";

        list.forEach(m => {
            const div = document.createElement("div");
            div.className = "material-option";
            let img = "https://cdn-icons-png.flaticon.com/512/9638/9638363.png"; 
            if(m.imagen && m.imagen.startsWith("data:image")) img = m.imagen;

            div.innerHTML = `<img src="${img}"><span>${m.nombre}</span>`;
            div.onclick = () => {
                if(materialesSeleccionados.has(m.id_material)) {
                    materialesSeleccionados.delete(m.id_material);
                    div.classList.remove("selected");
                } else {
                    materialesSeleccionados.add(m.id_material);
                    div.classList.add("selected");
                }
            };
            grid.appendChild(div);
        });
    } catch(e) { console.error(e); }
}

function agregarFilaHorario() {
    const div = document.createElement("div");
    div.className = "horario-row";
    div.innerHTML = `
        <select class="input-field dia-select">
            <option value="Lunes">Lunes</option><option value="Martes">Martes</option><option value="Miércoles">Miércoles</option>
            <option value="Jueves">Jueves</option><option value="Viernes">Viernes</option><option value="Sábado">Sábado</option><option value="Domingo">Domingo</option>
        </select>
        <input type="time" class="input-field hora-inicio">
        <input type="time" class="input-field hora-fin">
        <i class="fa-solid fa-circle-xmark btn-remove" onclick="this.parentElement.remove()"></i>
    `;
    document.getElementById("containerHorarios").appendChild(div);
}

async function enviarFormulario(e) {
    e.preventDefault();
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if(!fotoBase64) return Swal.fire("Falta Foto", "Sube tu foto de perfil.", "warning");
    if(!evidenciaBase64) return Swal.fire("Falta Evidencia", "Sube tu certificado o evidencia.", "warning");
    if(materialesSeleccionados.size === 0) return Swal.fire("Materiales", "Selecciona al menos un material.", "warning");
    if(!coordenadas) return Swal.fire("Ubicación", "Marca tu ubicación en el mapa.", "warning");

    const horarios = [];
    document.querySelectorAll(".horario-row").forEach(row => {
        const d = row.querySelector(".dia-select").value;
        const i = row.querySelector(".hora-inicio").value;
        const f = row.querySelector(".hora-fin").value;
        if(d && i && f) horarios.push({ dia_semana: d, hora_inicio: i+":00", hora_fin: f+":00" });
    });

    if(horarios.length === 0) return Swal.fire("Horario", "Define tu horario de trabajo.", "warning");

    const payload = {
        usuario: { cedula: usuario.cedula },
        anios_experiencia: parseInt(document.getElementById("aniosExperiencia").value) || 0,
        nombre_sitio: document.getElementById("nombreSitio").value.trim(),
        ubicacion: document.getElementById("direccionTexto").value.trim(),
        latitud: coordenadas.lat,
        longitud: coordenadas.lng,
        foto_perfil_profesional: fotoBase64,
        evidencia_experiencia: evidenciaBase64,
        horarios: horarios,
        materiales: Array.from(materialesSeleccionados).map(id => ({ material: { id_material: id } })),
        aprobado: null,
        observacion_admin: "Pendiente"
    };

    try {
        Swal.fire({ title: "Enviando...", didOpen: () => Swal.showLoading() });
        const res = await fetch(`${API_BASE}/formularios_reciclador`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            Swal.fire("¡Enviado!", "Tu solicitud será revisada por un administrador.", "success")
                .then(() => window.location.href = "../inicio_usuario_normal.html");
        } else {
            throw new Error("Error backend");
        }
    } catch(e) {
        Swal.fire("Error", "No se pudo enviar la solicitud. Intenta luego.", "error");
    }
}