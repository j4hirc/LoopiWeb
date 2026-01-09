const API_BASE = 'https://api-loopi.onrender.com/api';

let map, marker, coordenadas;
let fotoPerfilFile = null;
let evidenciaFile = null;
let materialesSeleccionados = new Set();

const CUENCA_BOUNDS = L.latLngBounds(
    [-2.99, -79.15], 
    [-2.8, -78.85] 
);

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

document.addEventListener("DOMContentLoaded", async () => {
    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
        window.location.href = "../incio_de_sesion/login-registro.html";
        return;
    }
    const usuario = JSON.parse(usuarioStr);

    const yaEsReciclador = usuario.roles.some(r => (r.id_rol || r.rol?.id_rol) === 2);
    if (yaEsReciclador) {
        Swal.fire({
            title: "¡Ya eres Reciclador!",
            text: "Tu perfil ya tiene los permisos necesarios.",
            icon: "info",
            confirmButtonColor: "#3A6958",
            confirmButtonText: "Ir al Inicio",
            allowOutsideClick: false
        }).then(() => window.location.href = "../inicio_usuario_normal.html");
        return;
    }

    verificarEstadoReciclador(usuario.cedula);

    initMap();
    cargarMateriales();
    
    agregarFilaHorario("08:00", "18:00"); 

    setupImageUpload('fotoProfesional', 'previewFoto', 'placeholderFoto', (file) => fotoPerfilFile = file);
    setupImageUpload('evidenciaExperiencia', 'previewEvidencia', 'placeholderEvidencia', (file) => evidenciaFile = file);

    document.getElementById("btnGeo").addEventListener("click", obtenerUbicacionActual);
    document.getElementById("formReciclador").addEventListener("submit", enviarFormulario);
});

function setupImageUpload(inputId, imgId, placeholderId, callback) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', async function() {
        const file = this.files[0];
        if(!file) return;

        if(!file.type.startsWith('image/')) {
            Swal.fire("Archivo inválido", "Solo se permiten imágenes (JPG, PNG).", "error");
            this.value = "";
            return;
        }

        if(file.size > 10 * 1024 * 1024) {
            Swal.fire("Archivo muy pesado", "Intenta con una imagen menor a 10MB.", "warning");
            this.value = "";
            return;
        }

        try {
            document.body.style.cursor = 'wait';
            
            const archivoComprimido = await comprimirImagen(file);

            callback(archivoComprimido);

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

async function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const maxWidth = 1000; 
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
                        reject(new Error("Error al comprimir"));
                        return;
                    }
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
            if(form.aprobado === true) {
                redirigirConMensaje("¡Ya eres Reciclador!", "Tu cuenta ya está activa.", "success", "../inicio_usuario_normal.html");
            } else if (form.aprobado === false) {
                 Swal.fire({
                    title: "Solicitud Rechazada",
                    text: "Motivo: " + (form.observacion_admin || "Sin detalles. Intenta contactar al admin."),
                    icon: "error"
                 });
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
    map = L.map("mapaRegistro", {
        maxBounds: CUENCA_BOUNDS,      
        maxBoundsViscosity: 1.0,       
        minZoom: 12
    }).setView([-2.9001, -79.0059], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    map.on("click", e => actualizarMarcador(e.latlng.lat, e.latlng.lng));
}

function obtenerUbicacionActual() {
    if(!navigator.geolocation) return Swal.fire("Error", "Geolocalización no soportada", "error");
    
    Swal.showLoading();
    navigator.geolocation.getCurrentPosition(pos => {
        Swal.close();
        const { latitude, longitude } = pos.coords;
        
        if (CUENCA_BOUNDS.contains([latitude, longitude])) {
            map.setView([latitude, longitude], 16);
            actualizarMarcador(latitude, longitude);
        } else {
            Swal.fire("Ubicación Fuera de Rango", "Solo se permiten registros dentro de la ciudad de Cuenca.", "warning");
            map.setView([-2.9001, -79.0059], 13);
        }
        
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

function agregarFilaHorario(horaInicioDefecto = "", horaFinDefecto = "") {
    const lista = document.getElementById("containerHorarios");
    
    const selectsExistentes = lista.querySelectorAll(".dia-select");
    const diasUsados = Array.from(selectsExistentes).map(s => s.value);

    const diaSugerido = DIAS_SEMANA.find(d => !diasUsados.includes(d));

    if (!diaSugerido && selectsExistentes.length > 0) {
        Swal.fire("Semana Completa", "Ya has cubierto los 7 días de la semana.", "info");
        return; 
    }

    if (!horaInicioDefecto || !horaFinDefecto) {
        const filas = document.querySelectorAll(".horario-row");
        if (filas.length > 0) {
            const ultimaFila = filas[filas.length - 1];
            horaInicioDefecto = ultimaFila.querySelector(".hora-inicio").value;
            const [h, m] = horaInicioDefecto.split(':').map(Number);
            const finH = (h + 2) % 24;
            horaFinDefecto = `${finH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        } else {
             horaInicioDefecto = "08:00";
             horaFinDefecto = "10:00";
        }
    }

    let optionsHTML = "";
    DIAS_SEMANA.forEach(d => {
        const selected = (d === diaSugerido) ? "selected" : "";
        optionsHTML += `<option value="${d}" ${selected}>${d}</option>`;
    });

    const div = document.createElement("div");
    div.className = "horario-row";
    div.innerHTML = `
        <select class="input-field dia-select">${optionsHTML}</select>
        <input type="time" class="input-field hora-inicio" value="${horaInicioDefecto}">
        <input type="time" class="input-field hora-fin" value="${horaFinDefecto}">
        <i class="fa-solid fa-circle-xmark btn-remove" onclick="this.parentElement.remove()"></i>
    `;
    
    const selectDia = div.querySelector(".dia-select");
    const inpInicio = div.querySelector(".hora-inicio");
    const inpFin = div.querySelector(".hora-fin");

    selectDia.addEventListener("change", function() {
        const nuevoDia = this.value;
        const otrosSelects = document.querySelectorAll(".dia-select");
        let repetido = false;
        
        otrosSelects.forEach(s => {
            if (s !== this && s.value === nuevoDia) repetido = true;
        });

        if (repetido) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: `El ${nuevoDia} ya está en la lista`, timer: 2000, showConfirmButton: false });
            this.value = ""; // Resetear selección
        }
    });

    inpInicio.addEventListener("change", function() {
        if (this.value) {
            const [h, m] = this.value.split(':').map(Number);
            const finH = (h + 2);
            if (finH < 24) {
                inpFin.value = `${finH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            } else {
                inpFin.value = "23:59";
            }
        }
    });

    inpFin.addEventListener("change", function() {
        validarDiferenciaHoras(inpInicio, inpFin);
    });

    lista.appendChild(div);
}


function validarDiferenciaHoras(inputInicio, inputFin) {
    const inicio = inputInicio.value;
    const fin = inputFin.value;

    if (!inicio || !fin) return;

    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);

    const minutosInicio = h1 * 60 + m1;
    const minutosFin = h2 * 60 + m2;
    const diferencia = minutosFin - minutosInicio;

    if (diferencia < 120) { 
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'Horario muy corto',
            text: 'El turno debe durar mínimo 2 horas.',
            showConfirmButton: false,
            timer: 3000
        });
        
        inputFin.style.border = "2px solid #e74c3c";
        inputFin.value = ""; // Borrar valor inválido para obligar a poner bien
    } else {
        inputFin.style.border = "1px solid #ccc"; // Restaurar borde
    }
}

async function enviarFormulario(e) {
    e.preventDefault();
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    const nombreSitio = document.getElementById("nombreSitio").value.trim();
    const direccionTexto = document.getElementById("direccionTexto").value.trim();
    const aniosExp = document.getElementById("aniosExperiencia").value;

    if(!nombreSitio) return Swal.fire("Campo Vacío", "Ingresa el nombre de tu Base / Sitio.", "warning");
    if(!direccionTexto) return Swal.fire("Campo Vacío", "Ingresa la dirección escrita.", "warning");
    if(!fotoPerfilFile) return Swal.fire("Falta Foto", "Sube tu foto de perfil profesional.", "warning");
    if(!evidenciaFile) return Swal.fire("Falta Evidencia", "Sube tu certificado o evidencia.", "warning");
    if(materialesSeleccionados.size === 0) return Swal.fire("Materiales", "Selecciona al menos un material.", "warning");
    if(!coordenadas) return Swal.fire("Ubicación", "Marca tu ubicación en el mapa (dentro de Cuenca).", "warning");

    const horarios = [];
    let errorHorario = null;
    const diasUsados = new Set();

    const filas = document.querySelectorAll(".horario-row");
    for (const row of filas) {
        const d = row.querySelector(".dia-select").value;
        const i = row.querySelector(".hora-inicio").value;
        const f = row.querySelector(".hora-fin").value;
        
        if(!i || !f) {
            errorHorario = "Completa todas las horas de inicio y fin.";
            break;
        }

        const [h1, m1] = i.split(':').map(Number);
        const [h2, m2] = f.split(':').map(Number);
        if ((h2*60 + m2) - (h1*60 + m1) < 120) {
            errorHorario = `El horario del ${d} debe durar al menos 2 horas.`;
            break;
        }

        if(diasUsados.has(d)) {
            errorHorario = `El día ${d} está repetido.`;
            break;
        }
        diasUsados.add(d);

        horarios.push({ dia_semana: d, hora_inicio: i+":00", hora_fin: f+":00" });
    }

    if(errorHorario) return Swal.fire("Error en Horario", errorHorario, "error");

    if(horarios.length < 1) { 
        return Swal.fire("Horario Vacío", "Registra al menos un horario de atención.", "warning");
    }

    const datosObj = {
        usuario: { cedula: usuario.cedula },
        anios_experiencia: parseInt(aniosExp) || 0,
        nombre_sitio: nombreSitio,
        ubicacion: direccionTexto,
        latitud: coordenadas.lat,
        longitud: coordenadas.lng,
        foto_perfil_profesional: null, 
        evidencia_experiencia: null,
        horarios: horarios,
        materiales: Array.from(materialesSeleccionados).map(id => ({ material: { id_material: id } })),
        aprobado: null,
        observacion_admin: "Pendiente"
    };

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