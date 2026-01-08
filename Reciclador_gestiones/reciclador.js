const API_BASE = 'https://api-loopi.onrender.com/api';

let usuario;
let map;
let recyclingLayer;
let todasLasUbicaciones = [];
let marcadorMiUbicacion = null;
let ubicacionActual = null;
let miPuntoData = null;
const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
let fotoNuevaFile = null;

const CUENCA_BOUNDS = L.latLngBounds(
  [-2.99, -79.15], 
  [-2.8, -78.85] 
);

const iconReciclador = L.divIcon({
  className: "custom-div-icon",
  html: `
    <div style="background:#2ecc71; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 6px rgba(0,0,0,.35)">
      <i class="fa-solid fa-truck" style="color:white;"></i>
    </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const iconMiUbicacion = L.divIcon({
  className: "custom-div-icon",
  html: `
    <div style="background:#3498db; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 6px rgba(52,152,219,0.25)">
      <i class="fa-solid fa-location-dot" style="color:white;"></i>
    </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});


function getRolId(rolSel) {
  if (rolSel?.id_rol != null) return Number(rolSel.id_rol);
  if (rolSel?.idRol != null) return Number(rolSel.idRol);
  if (rolSel?.rol?.id_rol != null) return Number(rolSel.rol.id_rol);
  if (rolSel?.rol?.idRol != null) return Number(rolSel.rol.idRol);
  return null;
}


document.addEventListener("DOMContentLoaded", async () => {
  const userStr = localStorage.getItem("usuario");
  if (!userStr) return redirigirLogin();

  usuario = JSON.parse(userStr);

  if (getRolId(usuario.rol_seleccionado) !== 2) return redirigirLogin();

  actualizarSaludoUI();

  await refrescarDatosUsuario();

  document.getElementById("btnAbrirPerfil").onclick = abrirPerfil;
  document.getElementById("btnCerrarSesion").onclick = cerrarSesion;
  
  const inputFoto = document.getElementById("inputPerfilFoto");
  if(inputFoto) inputFoto.addEventListener("change", previsualizarFoto);

  const btnUbicacion = document.getElementById("btnMiUbicacion");
  if (btnUbicacion) btnUbicacion.onclick = obtenerUbicacionActual;

  const inputFotoPunto = document.getElementById("inputFotoPunto");
    if(inputFotoPunto) inputFotoPunto.addEventListener("change", previsualizarFotoPunto);


  initMapaReciclador();
  
  await Promise.all([
      cargarFiltrosMateriales(), // Cargar botones de filtro
      cargarPuntosReciclajeReciclador(), // Cargar puntos
      cargarNotificacionesReciclador()
  ]);

  setInterval(cargarNotificacionesReciclador, 15000);
});

async function refrescarDatosUsuario() {
    try {
        const res = await fetch(`${API_BASE}/usuarios/${usuario.cedula}`);
        if (res.ok) {
            const datosFrescos = await res.json();
            datosFrescos.rol_seleccionado = usuario.rol_seleccionado;
            usuario = datosFrescos;
            localStorage.setItem("usuario", JSON.stringify(usuario));
            actualizarSaludoUI();
        }
    } catch (e) {
        console.error("No se pudo refrescar el usuario", e);
    }
}

function actualizarSaludoUI() {
    let fotoUrl = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    if (usuario.foto && usuario.foto.length > 5) {
        if (usuario.foto.startsWith("http") || usuario.foto.startsWith("data:")) {
            fotoUrl = usuario.foto;
        } else {
            fotoUrl = `data:image/png;base64,${usuario.foto}`;
        }
    }

    document.getElementById("saludoUsuario").innerHTML = `
    <img src="${fotoUrl}" 
         style="width:35px; height:35px; border-radius:50%; object-fit:cover; margin-right:8px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
    <div style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.2;">
        <span style="font-weight:600; font-size:0.9rem;">${usuario.primer_nombre || "Usuario"}</span>
        <small style="opacity:0.8; font-size:0.7em;">Reciclador</small>
    </div>
  `;
}

function initMapaReciclador() {
  map = L.map("mapaReciclador", {
    maxBounds: CUENCA_BOUNDS,
    maxBoundsViscosity: 1.0,
    minZoom: 12,
    maxZoom: 18,
  }).setView([-2.9001, -79.0059], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  recyclingLayer = L.layerGroup().addTo(map);
}

// --- NUEVA FUNCIÓN: CARGAR BOTONES DE FILTRO ---
async function cargarFiltrosMateriales() {
    const contenedor = document.getElementById("contenedorBotonesMateriales");
    if (!contenedor) return;
  
    // Limpiar container pero dejar botón "Todos" si ya existe o crearlo de cero
    contenedor.innerHTML = "";
  
    const btnTodos = document.createElement("button");
    btnTodos.className = "btn-filtro active";
    btnTodos.innerText = "Todos";
    btnTodos.onclick = () => filtrarMapa("todos", btnTodos);
    contenedor.appendChild(btnTodos);
  
    try {
      const res = await fetch(`${API_BASE}/materiales`);
      if (res.ok) {
        const materiales = await res.json();
        materiales.forEach((mat) => {
          const btn = document.createElement("button");
          btn.className = "btn-filtro";
          btn.innerText = mat.nombre;
          btn.onclick = () => filtrarMapa(mat.id_material, btn);
          contenedor.appendChild(btn);
        });
      }
    } catch (e) {
      console.error("Error cargando materiales:", e);
    }
}

window.filtrarMapa = function (idMaterial, btnElement) {
    document.querySelectorAll(".btn-filtro").forEach((b) => b.classList.remove("active"));
    btnElement.classList.add("active");
  
    if (idMaterial === "todos") {
      renderizarPuntosReciclador(todasLasUbicaciones);
    } else {
      const filtradas = todasLasUbicaciones.filter((ubicacion) => {
        if (!ubicacion.materialesAceptados || ubicacion.materialesAceptados.length === 0) return false;
        
        return ubicacion.materialesAceptados.some(
          (um) => um.material && um.material.id_material === idMaterial
        );
      });
      renderizarPuntosReciclador(filtradas);
    }
};

async function cargarPuntosReciclajeReciclador() {
  try {
    const res = await fetch(`${API_BASE}/ubicacion_reciclajes`);
    if (!res.ok) return;

    todasLasUbicaciones = await res.json();
    renderizarPuntosReciclador(todasLasUbicaciones);
  } catch (e) {
    console.error("Error cargando puntos:", e);
  }
}

function renderizarPuntosReciclador(lista) {
  recyclingLayer.clearLayers();

  lista.forEach((p) => {
    if (!p.latitud || !p.longitud) return;

    let materialesHTML = "";
    if (p.materialesAceptados && p.materialesAceptados.length > 0) {
        materialesHTML = `<div style="margin-top:5px; display:flex; flex-wrap:wrap; gap:3px; justify-content:center;">`;
        p.materialesAceptados.forEach((um) => {
            if (um.material) {
                materialesHTML += `<span style="font-size:9px; background:#e8f5e9; color:#2e7d32; padding:2px 5px; border-radius:4px;">${um.material.nombre}</span>`;
            }
        });
        materialesHTML += `</div>`;
    }

    const marker = L.marker([p.latitud, p.longitud], {
      icon: iconReciclador,
    });

    marker.bindPopup(`
      <div style="text-align:center; min-width:170px;">
        <h4>${p.nombre}</h4>
        <p style="font-size:11px;">${p.direccion}</p>
        ${materialesHTML}
        <button onclick="abrirRuta(${p.latitud}, ${p.longitud})"
          style="margin-top:8px;background:#2ecc71;color:white;
          border:none;padding:5px 10px;border-radius:6px;cursor:pointer;">
          Ver ruta
        </button>
      </div>
    `);

    marker.addTo(recyclingLayer);
  });
}


function obtenerUbicacionActual(callback = null) {
  if (!navigator.geolocation) {
    return Swal.fire("Error", "Geolocalización no soportada", "error");
  }

  Swal.fire({
    title: "Obteniendo ubicación...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      Swal.close();
      let lat = pos.coords.latitude;
      let lng = pos.coords.longitude;

      if (!CUENCA_BOUNDS.contains([lat, lng])) {
        Swal.fire("Fuera de Cuenca", "Se centró el mapa dentro del área operativa", "info");
        lat = -2.9001;
        lng = -79.0059;
      }

      ubicacionActual = { lat, lng };

      if (marcadorMiUbicacion) map.removeLayer(marcadorMiUbicacion);

      marcadorMiUbicacion = L.marker([lat, lng], { icon: iconMiUbicacion }).addTo(map);
      marcadorMiUbicacion.bindPopup("📍 Tu ubicación").openPopup();
      map.setView([lat, lng], 15);

      if (typeof callback === 'function') callback();
    },
    () => {
      Swal.close();
      Swal.fire("Error", "No se pudo obtener tu ubicación", "error");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function abrirRuta(latDestino, lngDestino) {
  if (!ubicacionActual) {
    obtenerUbicacionActual(() => abrirRuta(latDestino, lngDestino));
    return;
  }
  const { lat, lng } = ubicacionActual;
  const url = `https://www.google.com/maps/dir/${lat},${lng}/${latDestino},${lngDestino}`;
  window.open(url, "_blank");
}


async function abrirPerfil() {
  Swal.showLoading();
  await refrescarDatosUsuario(); 
  
  Swal.close();
  cargarDatosEnModal();
  document.getElementById("modalPerfil").style.display = "flex";
}

function cargarDatosEnModal() {
  fotoNuevaFile = null;
  if(document.getElementById("inputPerfilFoto")) document.getElementById("inputPerfilFoto").value = "";

  document.getElementById("perfilPrimerNombre").value = usuario.primer_nombre || "";
  document.getElementById("perfilSegundoNombre").value = usuario.segundo_nombre || "";
  document.getElementById("perfilApellidoPaterno").value = usuario.apellido_paterno || "";
  document.getElementById("perfilApellidoMaterno").value = usuario.apellido_materno || "";
  document.getElementById("perfilCorreo").value = usuario.correo || "";
  document.getElementById("perfilPassword").value = ""; 
  
  let fotoSrc = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  if (usuario.foto && usuario.foto.length > 5) {
      if (usuario.foto.startsWith("http") || usuario.foto.startsWith("data:")) {
          fotoSrc = usuario.foto;
      } else {
          fotoSrc = `data:image/png;base64,${usuario.foto}`;
      }
  }
  
  document.getElementById("perfilPreview").src = fotoSrc;
}

function previsualizarFoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  fotoNuevaFile = file;

  
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("perfilPreview").src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

async function guardarPerfil() {
    const pNombre = document.getElementById("perfilPrimerNombre").value.trim();
    const sNombre = document.getElementById("perfilSegundoNombre").value.trim();
    const pApellido = document.getElementById("perfilApellidoPaterno").value.trim();
    const sApellido = document.getElementById("perfilApellidoMaterno").value.trim();
    const correo = document.getElementById("perfilCorreo").value.trim();
    const pass = document.getElementById("perfilPassword").value.trim();

    if (!pNombre || !pApellido || !correo) {
        return Swal.fire("Campos vacíos", "Nombre, Apellido y Correo son obligatorios", "warning");
    }

    const datosUsuario = {
        cedula: usuario.cedula,
        primer_nombre: pNombre,
        segundo_nombre: sNombre,
        apellido_paterno: pApellido,
        apellido_materno: sApellido,
        correo: correo,
        foto: usuario.foto,
        estado: true 
    };

    if (pass) {
        datosUsuario.password = pass; 
    }

    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosUsuario));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    try {
        Swal.fire({ title: "Guardando...", didOpen: () => Swal.showLoading() });

        const res = await fetch(`${API_BASE}/usuarios/${usuario.cedula}`, {
            method: "PUT",
            body: formData
        });

        if (res.ok) {
            const usuarioActualizado = await res.json();
            
            usuarioActualizado.rol_seleccionado = usuario.rol_seleccionado;
            usuario = usuarioActualizado;
            localStorage.setItem("usuario", JSON.stringify(usuario));
            
            actualizarSaludoUI();
            cerrarModalPerfil();
            Swal.fire("¡Listo!", "Perfil actualizado correctamente", "success");
        } else {
            throw new Error("Error al actualizar");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo actualizar el perfil", "error");
    }
}

function cerrarModalPerfil() {
  document.getElementById("modalPerfil").style.display = "none";
}


async function cargarNotificacionesReciclador() {
  try {
    const res = await fetch(`${API_BASE}/solicitud_recolecciones/reciclador/${usuario.cedula}`);
    if (!res.ok) return;

    const data = await res.json();

    const solicitudesActivas = data.filter((s) => {
      const estado = s.estado ? s.estado.toUpperCase() : "";
      return estado === "PENDIENTE_RECOLECCION" || estado === "ACEPTADA"; 
    });

    const cantidad = solicitudesActivas.length;
    const badge = document.getElementById("badgeEntregas");

    if (badge) {
      if (cantidad > 0) {
        badge.innerText = cantidad;
        badge.style.display = "flex";
        badge.classList.add("urgente");
      } else {
        badge.style.display = "none";
        badge.classList.remove("urgente");
      }
    }
  } catch (e) {
    console.error("Error notificaciones:", e);
  }
}

function cerrarSesion() {
  Swal.fire({
    title: "¿Cerrar sesión?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "No"
  }).then((r) => {
    if (r.isConfirmed) {
      localStorage.removeItem("usuario");
      redirigirLogin();
    }
  });
}

function redirigirLogin() {
  location.href = "../incio_de_sesion/login-registro.html";
}

let chartInstance = null;

async function abrirEstadisticas() {
    Swal.fire({ title: "Cargando datos...", didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch(`${API_BASE}/solicitud_recolecciones`);
        if (!res.ok) throw new Error("Error al cargar datos");
        
        const todas = await res.json();
        
        const misEntregas = todas.filter(s => 
            s.reciclador && s.reciclador.cedula === usuario.cedula && 
            s.estado === 'FINALIZADO'
        );

        calcularYMostrarStats(misEntregas);
        
        Swal.close();
        document.getElementById("modalEstadisticas").style.display = "flex";

    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudieron cargar tus estadísticas", "error");
    }
}

function calcularYMostrarStats(entregas) {
    let totalKg = 0;
    const materialesCount = {};

    entregas.forEach(s => {
        if(s.detalles) {
            s.detalles.forEach(d => {
                totalKg += d.cantidad_kg;
                const matName = d.material ? d.material.nombre : "Otros";
                materialesCount[matName] = (materialesCount[matName] || 0) + d.cantidad_kg;
            });
        }
    });

    document.getElementById("statKilos").innerText = totalKg.toFixed(1);
    document.getElementById("statEntregas").innerText = entregas.length;

    const ctx = document.getElementById('chartMisMateriales').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy(); // Destruir anterior para no sobreponer
    }

    const labels = Object.keys(materialesCount);
    const data = Object.values(materialesCount);

    chartInstance = new Chart(ctx, {
        type: 'doughnut', // Gráfica de dona
        data: {
            labels: labels.length ? labels : ['Sin datos'],
            datasets: [{
                data: data.length ? data : [1],
                backgroundColor: labels.length 
                    ? ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'] 
                    : ['#e0e0e0'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            if (context.parsed !== null) label += context.parsed + ' Kg';
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function cerrarModalEstadisticas() {
    document.getElementById("modalEstadisticas").style.display = "none";
}





async function abrirModalMiPunto() {
    Swal.fire({ title: "Cargando información...", didOpen: () => Swal.showLoading() });

    try {
        await cargarParroquiasEnSelect("parroquiaPunto");
        await cargarMaterialesCheck();

        const res = await fetch(`${API_BASE}/ubicacion_reciclajes`);
        if (res.ok) {
            const todas = await res.json();
            miPuntoData = todas.find(u => u.reciclador && u.reciclador.cedula === usuario.cedula);
        }

        llenarFormularioPunto();

        Swal.close();
        document.getElementById("modalMiPunto").style.display = "flex";

        setTimeout(() => initMapaEdicion(), 300);

    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo cargar la información del punto", "error");
    }
}

function cerrarModalMiPunto() {
    document.getElementById("modalMiPunto").style.display = "none";
}


function llenarFormularioPunto() {
    const ubi = miPuntoData;

    document.getElementById("idPunto").value = ubi ? ubi.id_ubicacion_reciclaje : "";
    document.getElementById("nombrePunto").value = ubi ? ubi.nombre : "";
    document.getElementById("direccionPunto").value = ubi ? ubi.direccion : "";
    
    if (ubi && ubi.parroquia) {
        document.getElementById("parroquiaPunto").value = ubi.parroquia.id_parroquia;
    }

    let fotoSrc = "https://via.placeholder.com/400x150?text=Sube+una+foto";
    if (ubi && ubi.foto && ubi.foto.length > 5) {
        if (ubi.foto.startsWith("http") || ubi.foto.startsWith("data:")) {
            fotoSrc = ubi.foto;
        } else {
            fotoSrc = `data:image/jpeg;base64,${ubi.foto}`;
        }
    }
    document.getElementById("previewPunto").src = fotoSrc;
    fotoPuntoFile = null;
    document.getElementById("inputFotoPunto").value = "";

    const checkboxes = document.querySelectorAll('input[name="materialesPunto"]');
    checkboxes.forEach(cb => cb.checked = false);
    if (ubi && ubi.materialesAceptados) {
        ubi.materialesAceptados.forEach(m => {
            if(m.material) {
                const check = document.getElementById(`chk-mat-${m.material.id_material}`);
                if(check) check.checked = true;
            }
        });
    }

    const containerHor = document.getElementById("containerHorarios");
    containerHor.innerHTML = "";
    if (ubi && ubi.horarios && ubi.horarios.length > 0) {
        const orden = { "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6, "Domingo": 7 };
        ubi.horarios.sort((a,b) => orden[a.dia_semana] - orden[b.dia_semana]);
        
        ubi.horarios.forEach(h => agregarFilaHorario(h));
    } else {
        agregarFilaHorario(null, "08:00", "17:00"); // Uno por defecto
    }

    if (ubi) {
        actualizarCoordsTexto(ubi.latitud, ubi.longitud);
    } else {
        actualizarCoordsTexto(-2.9001, -79.0059); // Default Cuenca
    }
}

async function cargarMaterialesCheck() {
    const container = document.getElementById("containerMaterialesCheck");
    try {
        const res = await fetch(`${API_BASE}/materiales`);
        const mats = await res.json();
        container.innerHTML = "";
        mats.forEach(m => {
            const div = document.createElement("div");
            div.innerHTML = `
                <input type="checkbox" id="chk-mat-${m.id_material}" name="materialesPunto" value="${m.id_material}">
                <label for="chk-mat-${m.id_material}" style="font-size:0.85rem; margin-left:4px;">${m.nombre}</label>
            `;
            container.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

function agregarFilaHorario(data = null, iniDef="08:00", finDef="17:00") {
    const diasUsados = Array.from(document.querySelectorAll(".select-dia")).map(s => s.value);
    
    let diaSugerido = DIAS_SEMANA.find(d => !diasUsados.includes(d));
    
    if (!data && !diaSugerido) {
        Swal.fire("Horario Completo", "Ya cubriste todos los días.", "info");
        return;
    }

    const diaVal = data ? data.dia_semana : diaSugerido;
    const iniVal = data ? data.hora_inicio : iniDef;
    const finVal = data ? data.hora_fin : finDef;

    let options = "";
    DIAS_SEMANA.forEach(d => {
        options += `<option value="${d}" ${d === diaVal ? 'selected' : ''}>${d}</option>`;
    });

    const div = document.createElement("div");
    div.className = "horario-row";
    div.style.cssText = "display:flex; gap:5px; align-items:center;";
    div.innerHTML = `
        <select class="perfil-input select-dia" style="flex:1;">${options}</select>
        <input type="time" class="perfil-input input-hora-ini" value="${iniVal}" style="width:80px;">
        <span>-</span>
        <input type="time" class="perfil-input input-hora-fin" value="${finVal}" style="width:80px;">
        <button onclick="this.parentElement.remove()" style="background:#ffcdd2; border:none; border-radius:4px; cursor:pointer; padding:5px 8px; color:#c62828;">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    document.getElementById("containerHorarios").appendChild(div);
}

function initMapaEdicion() {
    let lat = -2.9001, lng = -79.0059;
    if (miPuntoData && miPuntoData.latitud) {
        lat = miPuntoData.latitud;
        lng = miPuntoData.longitud;
    }

    if (!mapEdicion) {
        mapEdicion = L.map('mapaEdicion').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapEdicion);
        
        mapEdicion.on('click', function(e) {
            colocarMarcadorEdicion(e.latlng.lat, e.latlng.lng);
        });
    } else {
        mapEdicion.invalidateSize();
        mapEdicion.setView([lat, lng], 15);
    }
    
    colocarMarcadorEdicion(lat, lng);
}

function colocarMarcadorEdicion(lat, lng) {
    if (markerEdicion) mapEdicion.removeLayer(markerEdicion);
    markerEdicion = L.marker([lat, lng], { draggable: true }).addTo(mapEdicion);
    actualizarCoordsTexto(lat, lng);

    markerEdicion.on('dragend', function(event) {
        var position = markerEdicion.getLatLng();
        actualizarCoordsTexto(position.lat, position.lng);
    });
}

function actualizarCoordsTexto(lat, lng) {
    document.getElementById("txtLatPunto").innerText = lat.toFixed(6);
    document.getElementById("txtLngPunto").innerText = lng.toFixed(6);
}

function obtenerUbicacionActualGPS() {
    if (!navigator.geolocation) return Swal.fire("Error", "GPS no soportado", "error");
    
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        if(mapEdicion) {
            mapEdicion.setView([latitude, longitude], 16);
            colocarMarcadorEdicion(latitude, longitude);
        }
    }, () => Swal.fire("Error", "No se pudo obtener ubicación", "error"));
}

function previsualizarFotoPunto(e) {
    const file = e.target.files[0];
    if (file) {
        fotoPuntoFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => document.getElementById("previewPunto").src = ev.target.result;
        reader.readAsDataURL(file);
    }
}

async function guardarMiPunto() {
    const btn = document.getElementById("btnGuardarPunto");
    const idPunto = document.getElementById("idPunto").value;
    const nombre = document.getElementById("nombrePunto").value.trim();
    const idParroquia = document.getElementById("parroquiaPunto").value;
    const direccion = document.getElementById("direccionPunto").value.trim();

    if (!nombre || !idParroquia || !direccion) {
        return Swal.fire("Falta información", "Nombre, Parroquia y Dirección son obligatorios.", "warning");
    }

    const filasHor = document.querySelectorAll(".horario-row");
    if(filasHor.length === 0) return Swal.fire("Horario", "Agrega al menos un horario.", "warning");
    
    const horarios = [];
    const diasVistos = new Set();
    let errorHor = null;

    filasHor.forEach(row => {
        const dia = row.querySelector(".select-dia").value;
        let ini = row.querySelector(".input-hora-ini").value;
        let fin = row.querySelector(".input-hora-fin").value;

        if(diasVistos.has(dia)) errorHor = `Día ${dia} repetido.`;
        diasVistos.add(dia);

        if(!ini || !fin) errorHor = "Completa las horas.";
        if(ini >= fin) errorHor = "La hora de fin debe ser mayor a la de inicio.";

        if(ini.length === 5) ini += ":00";
        if(fin.length === 5) fin += ":00";
        horarios.push({ dia_semana: dia, hora_inicio: ini, hora_fin: fin });
    });

    if(errorHor) return Swal.fire("Error Horario", errorHor, "error");

    const checks = document.querySelectorAll('input[name="materialesPunto"]:checked');
    if(checks.length === 0) return Swal.fire("Materiales", "Selecciona al menos un material.", "warning");

    const materiales = Array.from(checks).map(c => ({ material: { id_material: parseInt(c.value) } }));

    const datosObj = {
        nombre: nombre,
        direccion: direccion,
        latitud: parseFloat(document.getElementById("txtLatPunto").innerText),
        longitud: parseFloat(document.getElementById("txtLngPunto").innerText),
        parroquia: { id_parroquia: parseInt(idParroquia) },
        reciclador: { cedula: usuario.cedula }, 
        horarios: horarios,
        materialesAceptados: materiales,
        foto: miPuntoData ? miPuntoData.foto : null
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosObj));
    if (fotoPuntoFile) formData.append("archivo", fotoPuntoFile);

    const url = idPunto ? `${API_BASE}/ubicacion_reciclajes/${idPunto}` : `${API_BASE}/ubicacion_reciclajes`;
    const method = idPunto ? "PUT" : "POST";

    try {
        btn.disabled = true; btn.innerText = "Guardando...";
        Swal.showLoading();

        const res = await fetch(url, { method: method, body: formData });
        
        if (res.ok) {
            Swal.fire("¡Éxito!", "Tu punto ha sido actualizado correctamente.", "success");
            cerrarModalMiPunto();
            await cargarPuntosReciclajeReciclador();
        } else {
            const txt = await res.text();
            Swal.fire("Error", "No se pudo guardar: " + txt, "error");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "Fallo de conexión.", "error");
    } finally {
        btn.disabled = false; btn.innerText = "Guardar Cambios";
    }
}

async function cargarParroquiasEnSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const res = await fetch(`${API_BASE}/parroquias`);
        const data = await res.json();
        select.innerHTML = '<option value="">Seleccione...</option>';
        data.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id_parroquia;
            opt.textContent = p.nombre_parroquia;
            select.appendChild(opt);
        });
    } catch(e) { console.error(e); }
}