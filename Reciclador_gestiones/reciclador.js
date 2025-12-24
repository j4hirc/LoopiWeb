const API_BASE = 'https://api-loopi.onrender.com/api';

let usuario;
let map;
let recyclingLayer;
let todasLasUbicaciones = [];
let marcadorMiUbicacion = null;
let ubicacionActual = null;

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


  initMapaReciclador();
  cargarPuntosReciclajeReciclador();

  cargarNotificacionesReciclador();
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

    const marker = L.marker([p.latitud, p.longitud], {
      icon: iconReciclador,
    });

    marker.bindPopup(`
      <div style="text-align:center; min-width:170px;">
        <h4>${p.nombre}</h4>
        <p style="font-size:11px;">${p.direccion}</p>
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
        foto: usuario.foto, // Mantener vieja si no se cambia
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