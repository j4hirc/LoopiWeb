const API_BASE = 'https://api-loopi.onrender.com/api';

let map;
let markerUsuario;
let markersLayer;
let allPuntos = []; 

let horariosPuntoSeleccionado = []; 
let routingControl = null; 


let selectedLocationId = null;
let fotoEvidenciaFile = null; 
let detallesList = [];
let materialesGlobales = [];

const CUENCA_BOUNDS = L.latLngBounds(
    [-2.99, -79.15], 
    [-2.8, -78.85] 
);

document.addEventListener("DOMContentLoaded", async () => {

    initMap();
    await cargarMaterialesGlobales(); 
    await cargarDatosIniciales();
  
    setupImageUpload();

    document.getElementById("btnAddMaterial").addEventListener("click", agregarMaterialALista);
    document.getElementById("btnEnviar").addEventListener("click", enviarSolicitud);
  
    document.getElementById("inputFecha").addEventListener("change", function() {
        validarHorarioAtencion(); 
        validarFormulario();      
    });

    document.getElementById("inputCantidad").addEventListener("input", validarFormulario);
});

function initMap() {
    const latCuenca = -2.9001;
    const lngCuenca = -79.0059;

    map = L.map("mapaSeleccion", {
        maxBounds: CUENCA_BOUNDS,
        maxBoundsViscosity: 1.0
    }).setView([latCuenca, lngCuenca], 14);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

   if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            if (CUENCA_BOUNDS.contains([lat, lng])) {
                map.setView([lat, lng], 15);
            } else {
                Swal.fire("Ubicación", "Estás fuera del área de servicio (Cuenca).", "info");
            }
            
            const userIcon = L.divIcon({
                className: 'user-pin',
                html: '<div style="background-color:#e74c3c;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>',
                iconSize: [20, 20]
            });

            markerUsuario = L.marker([lat, lng], {icon: userIcon}).addTo(map).bindPopup("<b>Tu ubicación</b>").openPopup();
        }, () => {
            console.log("Geolocalización denegada");
        });
    }
}

async function cargarMaterialesGlobales() {
    try {
        const res = await fetch(`${API_BASE}/materiales`);
        if (res.ok) materialesGlobales = await res.json();
    } catch(e) { console.error("Error mat globales", e); }
}

async function cargarDatosIniciales() {
    try {
        const usuarioLocal = localStorage.getItem("usuario");
        let cedulaUsuario = null;
        if (usuarioLocal) {
            cedulaUsuario = JSON.parse(usuarioLocal).cedula;
        }

        const resPuntos = await fetch(`${API_BASE}/ubicacion_reciclajes`);
        if (resPuntos.ok) {
            const puntosRaw = await resPuntos.json();
      
            allPuntos = puntosRaw.filter(p => {
                if (p.reciclador && p.reciclador.cedula === cedulaUsuario) return false; 
                return true; 
            });

            renderizarMarcadores(allPuntos);

            const idPreSeleccionado = localStorage.getItem('preSelectedUbicacionId');
      
            if (idPreSeleccionado) {
                const puntoTarget = allPuntos.find(p => (p.id_ubicacion_reciclaje || p.id) == idPreSeleccionado);
          
                if (puntoTarget) {
                    map.setView([puntoTarget.latitud, puntoTarget.longitud], 16);
              
                    let esReciclador = puntoTarget.reciclador !== null && puntoTarget.reciclador !== undefined;
                    let nombreShow = puntoTarget.nombre || (esReciclador ? `${puntoTarget.reciclador.primer_nombre}` : "Punto");
              
                    seleccionarPuntoDesdePopup(
                        puntoTarget.id_ubicacion_reciclaje || puntoTarget.id, 
                        nombreShow, 
                        esReciclador
                    );
                }
                localStorage.removeItem('preSelectedUbicacionId');
            }
        }

        generarBotonesFiltro(materialesGlobales);

    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

function obtenerMaterialesDelPunto(punto) {
    if (punto.reciclador?.formulario?.aprobado === true && Array.isArray(punto.reciclador.formulario.materiales)) {
        return punto.reciclador.formulario.materiales;
    }
    if (Array.isArray(punto.materialesAceptados)) {
        return punto.materialesAceptados;
    }
    return [];
}

function renderizarMarcadores(listaPuntos) {
    markersLayer.clearLayers();

    listaPuntos.forEach((punto) => {
        if (punto.latitud && punto.longitud) {
      
            let esReciclador = punto.reciclador !== null && punto.reciclador !== undefined;
            if (esReciclador && punto.reciclador.estado === false) return;

            const color = esReciclador ? "#3498db" : "#2ecc71";
            const icono = esReciclador ? "fa-user" : "fa-recycle";
      
            const htmlIcon = `
                <div style="background-color:${color};width:35px;height:35px;border-radius:50%;
                display:flex;justify-content:center;align-items:center;border:3px solid white;
                box-shadow:0 3px 5px rgba(0,0,0,0.3);">
                    <i class="fa-solid ${icono}" style="color:white;font-size:16px;"></i>
                </div>`;

            const customIcon = L.divIcon({
                className: "custom-pin",
                html: htmlIcon,
                iconSize: [35, 35],
                iconAnchor: [17, 17],
                popupAnchor: [0, -20],
            });

            const m = L.marker([punto.latitud, punto.longitud], { icon: customIcon });

            let tipoTexto = esReciclador ? "Reciclador Móvil" : "Punto Fijo";
            let nombreMostrar = punto.nombre || (esReciclador ? `${punto.reciclador.primer_nombre} ${punto.reciclador.apellido_paterno}` : "Punto de Reciclaje");

            const materialesDisponibles = obtenerMaterialesDelPunto(punto);
            let materialesBadges = "";
            if (materialesDisponibles.length > 0) {
                materialesBadges = `<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px;justify-content:center;">`;
                materialesDisponibles.forEach((ma) => {
                    const matObj = ma.material ? ma.material : ma;
                    if (matObj) {
                        materialesBadges += `<span style="font-size:9px;background:#f0f0f0;padding:2px 5px;border-radius:3px;">${matObj.nombre}</span>`;
                    }
                });
                materialesBadges += `</div>`;
            }

            m.bindPopup(`
                <div style="text-align:center;min-width:160px;">
                    <strong style="color:${color}">${tipoTexto}</strong><br>
                    <span style="font-size:14px;font-weight:bold;">${nombreMostrar}</span><br>
                    <small style="color:#7f8c8d">${punto.direccion || ""}</small>
                    ${materialesBadges}
                    <button onclick="seleccionarPuntoDesdePopup('${punto.id_ubicacion_reciclaje || punto.id}', '${nombreMostrar}', ${esReciclador})"
                        style="margin-top:8px;background:#2c3e50;color:white;border:none;padding:6px 12px;border-radius:4px;width:100%;cursor:pointer;">
                        Seleccionar este punto
                    </button>
                </div>
            `);

            m.addTo(markersLayer);
        }
    });
}

window.seleccionarPuntoDesdePopup = function (id, nombre, esReciclador) {
    selectedLocationId = id;
    const infoDiv = document.getElementById("infoPunto");
    const nombreDiv = document.getElementById("nombrePunto");

    let colorHTML = esReciclador ? "#2980b9" : "#27ae60";
    let iconoHTML = esReciclador ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-recycle"></i>';

    const puntoSeleccionado = allPuntos.find(p => (p.id_ubicacion_reciclaje || p.id) == id);

    if (puntoSeleccionado) {
        
        horariosPuntoSeleccionado = puntoSeleccionado.horarios || [];

        const direccion = puntoSeleccionado.direccion || "Sin dirección registrada";
        const parroquia = puntoSeleccionado.parroquia ? puntoSeleccionado.parroquia.nombre_parroquia : "";
        const fotoUrl = puntoSeleccionado.foto ? puntoSeleccionado.foto : null;

        let horariosHTML = '';
        if (horariosPuntoSeleccionado.length > 0) {
            horariosHTML = '<div style="margin-top:8px; background:#f9f9f9; padding:5px; border-radius:4px;">';
            horariosHTML += '<div style="font-size:0.8em; color:#7f8c8d; font-weight:bold; margin-bottom:3px;">Horarios de Atención:</div>';
            
            horariosPuntoSeleccionado.forEach(h => {
                const inicio = h.hora_inicio.substring(0,5);
                const fin = h.hora_fin.substring(0,5);
                horariosHTML += `
                    <div style="font-size:0.8em; color:#34495e; display:flex; justify-content:space-between;">
                        <span>${h.dia_semana}:</span>
                        <span>${inicio} - ${fin}</span>
                    </div>`;
            });
            horariosHTML += '</div>';
        } else {
            horariosHTML = '<div style="font-size:0.8em; color:#e74c3c; margin-top:5px;">⚠️ Sin horarios registrados</div>';
        }

        let fotoHTML = '';
        if (fotoUrl) {
            fotoHTML = `
                <div style="margin-top:10px; width:100%; height:120px; overflow:hidden; border-radius:6px;">
                    <img src="${fotoUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Foto del punto">
                </div>
            `;
        }


        nombreDiv.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:5px;">
                <div style="font-size:1.1em; font-weight:bold; color:${colorHTML}; display:flex; align-items:center; gap:8px;">
                    ${iconoHTML} ${nombre}
                </div>

                <div style="font-size:0.9em; color:#555;">
                    <i class="fa-solid fa-map-pin" style="color:${colorHTML}; margin-right:5px;"></i> ${direccion}
                    ${parroquia ? `<br><small style="color:#999; margin-left:18px;">(${parroquia})</small>` : ''}
                </div>

                ${fotoHTML}

                ${horariosHTML}

                <div id="rutaInfo" style="font-size:0.9em; color:#555; background:#ecf0f1; padding:10px; border-radius:5px; margin-top:10px; border-left:4px solid #f39c12; display:none;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Calculando ruta óptima...
                </div>
            </div>
        `;
        
        infoDiv.style.display = "block";
        infoDiv.style.borderLeft = `5px solid ${colorHTML}`;

        const matsWrappers = obtenerMaterialesDelPunto(puntoSeleccionado);
        const matsLimpios = matsWrappers.map(m => m.material ? m.material : m).filter(m => m != null);
        llenarSelectMateriales(matsLimpios);

        if(matsLimpios.length === 0){
            Swal.fire("Aviso", "Este punto no tiene materiales configurados.", "warning");
        }

        if (markerUsuario) {
            const userLatLng = markerUsuario.getLatLng();
            const destLatLng = L.latLng(puntoSeleccionado.latitud, puntoSeleccionado.longitud);

            if (routingControl) map.removeControl(routingControl);

            routingControl = L.Routing.control({
                waypoints: [userLatLng, destLatLng],
                routeWhileDragging: false,
                draggableWaypoints: false,
                addWaypoints: false,
                show: false,
                lineOptions: { styles: [{color: colorHTML, opacity: 0.7, weight: 6}] },
                createMarker: function() { return null; }
            }).addTo(map);

            routingControl.on('routesfound', function(e) {
                const routes = e.routes;
                const summary = routes[0].summary;
                const distKm = (summary.totalDistance / 1000).toFixed(2);
                const tiempoMin = Math.round(summary.totalTime / 60);

                const divRuta = document.getElementById("rutaInfo");
                divRuta.style.display = "block";
                divRuta.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-route" style="color:#e67e22"></i> <b>${distKm} km</b></span>
                        <span><i class="fa-solid fa-person-walking" style="color:#e67e22"></i> <b>~${tiempoMin} min</b></span>
                    </div>
                `;
            });
            
            routingControl.on('routingerror', function() {
                const divRuta = document.getElementById("rutaInfo");
                divRuta.style.display = "block";
                divRuta.innerHTML = "<small style='color:red;'>No se pudo calcular la ruta.</small>";
            });

        } else {
            const divRuta = document.getElementById("rutaInfo");
            if(divRuta) {
                divRuta.style.display = "block";
                divRuta.innerHTML = "<small>Activa tu GPS para ver la distancia.</small>";
            }
        }
    }

    detallesList = [];
    actualizarListaUI();
    validarHorarioAtencion();
    validarFormulario();
    map.closePopup();
};

function llenarSelectMateriales(materiales) {
    const select = document.getElementById("selectMaterial");
    if (!materiales || materiales.length === 0) {
        select.innerHTML = '<option value="">-- Sin materiales --</option>';
        return;
    }
    select.innerHTML = '<option value="">-- Selecciona Material --</option>';
    materiales.forEach((mat) => {
        const opt = document.createElement("option");
        opt.value = mat.id_material || mat.id;
        opt.text = mat.nombre;
        select.appendChild(opt);
    });
}

function generarBotonesFiltro(materiales) {
    const contenedor = document.getElementById("filtroMaterialesMap");
    contenedor.innerHTML = `<button class="btn-filtro active" onclick="filtrarPuntosMapa('todos', this)">Todos</button>`;
  
    materiales.forEach((mat) => {
        const btn = document.createElement("button");
        btn.className = "btn-filtro";
        btn.textContent = mat.nombre;
        btn.onclick = function () { filtrarPuntosMapa(mat.id_material || mat.id, this); };
        contenedor.appendChild(btn);
    });
}

window.filtrarPuntosMapa = function (idMaterial, btnElement) {
    document.querySelectorAll(".btn-filtro").forEach((b) => b.classList.remove("active"));
    btnElement.classList.add("active");

    if (idMaterial === "todos") {
        renderizarMarcadores(allPuntos);
        return;
    }

    const filtrados = allPuntos.filter((punto) => {
        const mats = obtenerMaterialesDelPunto(punto);
        return mats.some((m) => {
            const mId = m.material ? (m.material.id_material || m.material.id) : (m.id_material || m.id);
            return mId == idMaterial;
        });
    });

    renderizarMarcadores(filtrados);
};

function agregarMaterialALista() {
    const select = document.getElementById("selectMaterial");
    const inputCant = document.getElementById("inputCantidad");

    const idMat = select.value;
    const peso = parseFloat(inputCant.value);

    if (!selectedLocationId) {
        return Swal.fire("Espera", "Primero selecciona un punto en el mapa.", "warning");
    }
    if (!idMat) {
        return Swal.fire("Campo vacío", "Selecciona qué material vas a entregar.", "warning");
    }
    if (!peso || peso <= 0) {
        return Swal.fire("Peso inválido", "Ingresa una cantidad mayor a 0 Kg.", "warning");
    }

    const nombreMat = select.options[select.selectedIndex].text;

    const existente = detallesList.find(d => d.material.id_material == idMat);

    if (existente) {
        existente.cantidad_kg += peso;
        Swal.fire({
            toast: true, position: 'top-end', icon: 'info', 
            title: `Se sumaron ${peso}Kg a ${nombreMat}`, showConfirmButton: false, timer: 2000
        });
    } else {
        detallesList.push({
            material: { id_material: idMat, nombre: nombreMat },
            cantidad_kg: peso
        });
    }

    actualizarListaUI();
    inputCant.value = ""; 
    select.focus(); 
    validarFormulario();
}

function actualizarListaUI() {
    const ul = document.getElementById("listaMaterialesUI");
    ul.innerHTML = "";

    if (detallesList.length === 0) {
        ul.innerHTML = '<li style="justify-content:center; color:#9ca3af; background:transparent; border:none;">Aquí aparecerán tus materiales...</li>';
        return;
    }

    detallesList.forEach((item, index) => {
        const li = document.createElement("li");
      
        li.innerHTML = `
            <div style="display:flex; align-items:center;">
                <i class="fa-solid fa-box-open" style="color:#66bb6a; margin-right:10px;"></i>
                <div>
                    <b>${item.material.nombre}</b>
                    <span class="tag-peso">${item.cantidad_kg} Kg</span>
                </div>
            </div>
            <button onclick="borrarItem(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:5px;">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        `;
        ul.appendChild(li);
    });
}

window.borrarItem = function (index) {
    detallesList.splice(index, 1);
    actualizarListaUI();
    validarFormulario();
};

function setupImageUpload() {
    const input = document.getElementById("inputFoto");
    const preview = document.getElementById("imgPreview");
    const uploadText = document.getElementById("uploadText");

    if (!input) return;

    input.addEventListener("change", async function () {
        const file = this.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                Swal.fire("Error", "Solo se permiten imágenes", "error");
                this.value = "";
                return;
            }

            try {
                const archivoComprimido = await comprimirImagen(file);
              
                fotoEvidenciaFile = archivoComprimido;

                const reader = new FileReader();
                reader.onload = function (e) {
                    preview.src = e.target.result;
                    preview.style.display = "block";
                    if (uploadText) uploadText.style.display = "none";
                    validarFormulario();
                };
                reader.readAsDataURL(archivoComprimido);

            } catch (error) {
                console.error(error);
                Swal.fire("Error", "No se pudo procesar la imagen", "error");
            }
        }
    });
}

async function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const maxWidth = 800; // Redimensionar si pasa de 800px
        const quality = 0.7;  // Bajar calidad al 70%

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


function validarHorarioAtencion() {
    const inputFecha = document.getElementById("inputFecha");
    const fechaValor = inputFecha.value;

    if (!selectedLocationId || !fechaValor || !horariosPuntoSeleccionado || horariosPuntoSeleccionado.length === 0) {
        return true; 
    }

    const fechaObj = new Date(fechaValor);
    const ahora = new Date();

    if (fechaObj < ahora) {
        Swal.fire({
            icon: 'error',
            title: 'Fecha Inválida',
            text: 'No puedes programar una recolección en el pasado.',
            confirmButtonColor: '#e74c3c'
        });
        inputFecha.value = ""; 
        return false;
    }

    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diaInput = diasSemana[fechaObj.getDay()];

    const normalizar = (texto) => {
        return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
    };

    const horarioDelDia = horariosPuntoSeleccionado.find(h => 
        normalizar(h.dia_semana) === normalizar(diaInput)
    );

    if (!horarioDelDia) {
        Swal.fire({
            icon: 'warning',
            title: 'Punto Cerrado',
            text: `Este punto no atiende los ${diaInput}s. Intenta otro día.`,
            confirmButtonColor: '#f39c12'
        });
        inputFecha.value = ""; 
        return false;
    }

    const horaInput = fechaValor.split("T")[1].substring(0, 5); // "14:30"
    const horaAbre = horarioDelDia.hora_inicio.substring(0, 5);
    const horaCierra = horarioDelDia.hora_fin.substring(0, 5);

    if (horaInput >= horaAbre && horaInput <= horaCierra) {
        return true; 
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Fuera de Horario',
            text: `El horario de atención es de ${horaAbre} a ${horaCierra}.`,
            confirmButtonColor: '#f39c12'
        });
        inputFecha.value = ""; 
        return false;
    }
}

function validarFormulario() {
    const btn = document.getElementById("btnEnviar");
    const fecha = document.getElementById("inputFecha").value;

    const condiciones = 
        selectedLocationId && 
        fotoEvidenciaFile && 
        fecha && 
        detallesList.length > 0;

    if (condiciones) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
        btn.innerHTML = 'Confirmar Entrega <i class="fa-solid fa-paper-plane"></i>';
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
        btn.innerHTML = 'Completa los datos...';
    }
}

async function enviarSolicitud() {
    const usuarioLocal = localStorage.getItem("usuario");
    if (!usuarioLocal) {
        return Swal.fire("Error", "Sesión expirada. Inicia sesión de nuevo.", "error");
    }
    const usuarioObj = JSON.parse(usuarioLocal);

    const fechaInput = document.getElementById("inputFecha").value;
    const fechaSegura = fechaInput.length === 16 ? fechaInput + ":00" : fechaInput;

    const datosObj = {
        solicitante: { cedula: usuarioObj.cedula },
        ubicacion: { id_ubicacion_reciclaje: selectedLocationId },
        fotoEvidencia: null, // Backend lo maneja por separado
        estado: "VERIFICACION_ADMIN", 
        fecha_recoleccion_estimada: fechaSegura, // FORMATO CORREGIDO
        detalles: detallesList.map(d => ({
            material: { id_material: d.material.id_material },
            cantidad_kg: d.cantidad_kg
        }))
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosObj));
  
    if (fotoEvidenciaFile) {
        formData.append("archivo", fotoEvidenciaFile);
    } else {
        return Swal.fire("Falta foto", "Debes subir una foto de evidencia", "warning");
    }

    try {
        Swal.fire({ 
            title: "Procesando...", 
            text: "Guardando tu solicitud",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading() 
        });

        const response = await fetch(`${API_BASE}/solicitud_recolecciones`, {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            Swal.fire({
                icon: "success",
                title: "¡Excelente!",
                text: "Tu entrega ha sido registrada. Espera la validación.",
                confirmButtonColor: "#2ecc71"
            }).then(() => {
                window.location.href = "../inicio_usuario_normal.html";
            });
        } else {
            const txt = await response.text();
            console.error(txt);
            Swal.fire("Error", "No se pudo guardar la solicitud.", "error");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Conexión fallida", "Revisa tu internet e intenta de nuevo.", "error");
    }
}