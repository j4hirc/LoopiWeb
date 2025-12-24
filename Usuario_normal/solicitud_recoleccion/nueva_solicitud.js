const API_BASE = 'https://api-loopi.onrender.com/api';

let map;
let markerUsuario;
let markersLayer;
let allPuntos = []; 

let selectedLocationId = null;
let fotoEvidenciaFile = null; // Archivo real
let detallesList = [];
let materialesGlobales = [];

document.addEventListener("DOMContentLoaded", async () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
  document.getElementById("inputFecha").value = now.toISOString().slice(0, 16);

  initMap();
  await cargarMaterialesGlobales(); 
  await cargarDatosIniciales();
  
  // Configurar subida con compresión
  setupImageUpload();

  document.getElementById("btnAddMaterial").addEventListener("click", agregarMaterialALista);
  document.getElementById("btnEnviar").addEventListener("click", enviarSolicitud);
  
  document.getElementById("inputFecha").addEventListener("change", validarFormulario);
  document.getElementById("inputCantidad").addEventListener("input", validarFormulario);
});

function initMap() {
  const latCuenca = -2.9001;
  const lngCuenca = -79.0059;

  map = L.map("mapaSeleccion").setView([latCuenca, lngCuenca], 14);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          map.setView([lat, lng], 15);
          markerUsuario = L.marker([lat, lng]).addTo(map).bindPopup("Estás aquí").openPopup();
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

  nombreDiv.innerHTML = `<span style="color:${colorHTML}; font-weight:bold; font-size:1.1em;">${iconoHTML} ${nombre}</span>`;
  infoDiv.style.display = "block";
  infoDiv.style.borderLeft = `5px solid ${colorHTML}`;

  const puntoSeleccionado = allPuntos.find(p => (p.id_ubicacion_reciclaje || p.id) == id);

  if (puntoSeleccionado) {
      const matsWrappers = obtenerMaterialesDelPunto(puntoSeleccionado);
      const matsLimpios = matsWrappers.map(m => m.material ? m.material : m).filter(m => m != null);
      
      llenarSelectMateriales(matsLimpios);
      
      if(matsLimpios.length > 0){
          Swal.fire({
              toast: true, position: "top-end", icon: "success",
              title: "Materiales actualizados", showConfirmButton: false, timer: 1500
          });
      } else {
          Swal.fire("Aviso", "Este punto no tiene materiales configurados.", "warning");
      }
  }

  detallesList = [];
  actualizarListaUI();
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

// --- CONFIGURACIÓN DE SUBIDA DE IMAGEN (COMPRESIÓN) ---
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
            // 1. Comprimir
            const archivoComprimido = await comprimirImagen(file);
            
            // 2. Guardar en variable global
            fotoEvidenciaFile = archivoComprimido;

            // 3. Previsualizar
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

// --- FUNCIÓN DE COMPRESIÓN ---
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

// --- ENVÍO CON FORMDATA ---
async function enviarSolicitud() {
  const usuarioLocal = localStorage.getItem("usuario");
  if (!usuarioLocal) {
    return Swal.fire("Error", "Sesión expirada. Inicia sesión de nuevo.", "error");
  }
  const usuarioObj = JSON.parse(usuarioLocal);

  // Fecha segura: Agregamos segundos para evitar error de LocalDateTime
  const fechaInput = document.getElementById("inputFecha").value;
  const fechaSegura = fechaInput.length === 16 ? fechaInput + ":00" : fechaInput;

  // 1. Objeto JSON
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

    // 3. Enviar
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