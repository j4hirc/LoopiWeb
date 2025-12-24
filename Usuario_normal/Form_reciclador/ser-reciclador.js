const API_BASE = 'https://api-loopi.onrender.com/api';

let map, marker, coordenadas;
// CAMBIO: Ya no guardamos strings Base64, sino objetos File
let fotoPerfilFile = null;
let evidenciaFile = null;
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

    // Configuración de inputs de imagen con compresión
    setupImageUpload('fotoProfesional', 'previewFoto', 'placeholderFoto', (file) => fotoPerfilFile = file);
    setupImageUpload('evidenciaExperiencia', 'previewEvidencia', 'placeholderEvidencia', (file) => evidenciaFile = file);

    document.getElementById("btnGeo").addEventListener("click", obtenerUbicacionActual);
    document.getElementById("formReciclador").addEventListener("submit", enviarFormulario);
});

// --- FUNCIÓN DE CARGA Y COMPRESIÓN DE IMÁGENES ---
function setupImageUpload(inputId, imgId, placeholderId, callback) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', async function() {
        const file = this.files[0];
        if(!file) return;

        // 1. Validar Tipo
        if(!file.type.startsWith('image/')) {
            Swal.fire("Archivo inválido", "Solo se permiten imágenes (JPG, PNG).", "error");
            this.value = "";
            return;
        }

        // 2. Validar tamaño inicial (opcional, igual vamos a comprimir)
        // Si es mayor a 10MB avisamos, sino comprimimos
        if(file.size > 10 * 1024 * 1024) {
            Swal.fire("Archivo muy pesado", "Intenta con una imagen menor a 10MB.", "warning");
            this.value = "";
            return;
        }

        try {
            // 3. Comprimir Imagen
            // Mostramos un loading o cambiamos cursor
            document.body.style.cursor = 'wait';
            
            const archivoComprimido = await comprimirImagen(file);

            // 4. Guardar archivo comprimido en variable global (callback)
            callback(archivoComprimido);

            // 5. Generar vista previa
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById(imgId);
                const placeholder = document.getElementById(placeholderId);
                
                preview.src = e.target.result;
                preview.style.display = 'block'; 
                preview.classList.remove('preview-hidden');
                preview.classList.add('preview-image');
                
                if(placeholder) placeholder.style.display = 'none'; 
                document.body.style.cursor = 'default';
            };
            reader.readAsDataURL(archivoComprimido);

        } catch (error) {
            console.error(error);
            Swal.fire("Error", "No se pudo procesar la imagen", "error");
            document.body.style.cursor = 'default';
        }
    });
}

// --- LÓGICA DE COMPRESIÓN (Menor a 2MB garantizado) ---
async function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const maxWidth = 1000; // Un buen tamaño para documentos
        const quality = 0.7;   // Calidad suficiente para leer texto

        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Redimensionar si es muy grande
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
                        reject(new Error("Error al comprimir"));
                        return;
                    }
                    // Crear archivo nuevo
                    const archivoFinal = new File([blob], archivo.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    
                    console.log(`Compresión: ${(archivo.size/1024).toFixed(2)}KB -> ${(archivoFinal.size/1024).toFixed(2)}KB`);
                    resolve(archivoFinal);
                }, 'image/jpeg', quality);
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}

async function verificarEstadoReciclador(cedula) {
    try {
        const res = await fetch(`${API_BASE}/formularios_reciclador/usuario/${cedula}`);
        if(res.ok) {
            const form = await res.json();
            // Si existe formulario, verificamos estado
            if(form.aprobado === true) {
                redirigirConMensaje("¡Ya eres Reciclador!", "Tu cuenta ya está activa.", "success", "../inicio_usuario_normal.html");
            } else if (form.aprobado === false) {
                 // Si fue rechazado, permitimos ver el mensaje pero quizás no reenviar inmediatamente sin editar (opcional)
                 // Por ahora lo tratamos como proceso pendiente o rechazado
                 Swal.fire({
                    title: "Solicitud Rechazada",
                    text: "Motivo: " + (form.observacion_admin || "Sin detalles"),
                    icon: "error"
                 });
                 // Aquí podrías dejar que edite sobre el mismo formulario (PUT) o crear uno nuevo si borraste el anterior.
            } else {
                redirigirConMensaje("Solicitud en proceso", "Ya enviaste una solicitud. Espera la respuesta.", "info", "../inicio_usuario_normal.html");
            }
        }
    } catch(e) { 
        console.log("Usuario nuevo, puede postular."); 
    }
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
            
            // Soporte URL y Base64
            let img = "https://cdn-icons-png.flaticon.com/512/9638/9638363.png"; 
            if(m.imagen && m.imagen.length > 5) {
                if(m.imagen.startsWith("http") || m.imagen.startsWith("data:")) {
                    img = m.imagen;
                } else {
                    img = `data:image/png;base64,${m.imagen}`;
                }
            }

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

    if(!fotoPerfilFile) return Swal.fire("Falta Foto", "Sube tu foto de perfil profesional.", "warning");
    if(!evidenciaFile) return Swal.fire("Falta Evidencia", "Sube tu certificado o evidencia.", "warning");
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

    const datosObj = {
        usuario: { cedula: usuario.cedula },
        anios_experiencia: parseInt(document.getElementById("aniosExperiencia").value) || 0,
        nombre_sitio: document.getElementById("nombreSitio").value.trim(),
        ubicacion: document.getElementById("direccionTexto").value.trim(),
        latitud: coordenadas.lat,
        longitud: coordenadas.lng,
        foto_perfil_profesional: null, 
        evidencia_experiencia: null,
        horarios: horarios,
        materiales: Array.from(materialesSeleccionados).map(id => ({ material: { id_material: id } })),
        aprobado: null,
        observacion_admin: "Pendiente"
    };

    // 2. Crear FormData
    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosObj));
    formData.append("fotoPerfil", fotoPerfilFile);
    formData.append("evidencia", evidenciaFile);

    try {
        Swal.fire({ title: "Enviando...", didOpen: () => Swal.showLoading() });
        
        const res = await fetch(`${API_BASE}/formularios_reciclador`, {
            method: "POST",
            body: formData
        });

        if(res.ok) {
            Swal.fire("¡Enviado!", "Tu solicitud será revisada por un administrador.", "success")
                .then(() => window.location.href = "../inicio_usuario_normal.html");
        } else {
            const errText = await res.text();
            console.error("Backend Error:", errText);
            throw new Error("Error en el servidor");
        }
    } catch(e) {
        console.error(e);
        Swal.fire("Error", "No se pudo enviar la solicitud. Intenta luego.", "error");
    }
}