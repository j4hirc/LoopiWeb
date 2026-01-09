const API_BASE = 'https://api-loopi.onrender.com/api';

let map;
let usuarioLogueado;
let listaFavoritos = [];
let notificaciones = [];

let todasLasUbicaciones = [];
let recyclingLayer;
let rewardLayer;

let listaParroquiasCache = [];

let marcadorMiUbicacion = null;
let ubicacionActual = null;

let notificacionesCargadas = false;

let fotoNuevaFile = null;



const CUENCA_BOUNDS = L.latLngBounds(
    [-2.99, -79.15], 
    [-2.8, -78.85] 
);


document.addEventListener("DOMContentLoaded", async () => {
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
  }

  const btnMiUbicacion = document.getElementById("btnMiUbicacion");
  if (btnMiUbicacion) {
    btnMiUbicacion.addEventListener("click", () => {
      obtenerUbicacionActual();
    });
  }

  const btnAbrirPerfil = document.getElementById("btnAbrirPerfil");
  if (btnAbrirPerfil)
    btnAbrirPerfil.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalPerfil();
    });

  const usuarioStr = localStorage.getItem("usuario");
  if (!usuarioStr) {
    window.location.href = "../incio_de_sesion/login-registro.html";
    return;
  }
  usuarioLogueado = JSON.parse(usuarioStr);

  await recargarUsuarioDesdeBackend();
  cargarInfoUsuario();

  // 2. Iniciar Mapa y Capas
  initMap();

  // 3. Cargar Datos
  await cargarNotificaciones();
  await cargarMisFavoritos();
  await cargarFiltrosMateriales();
  await cargarPuntosReciclaje();
  await cargarPuntosRecompensa();
  

 cargarParroquiasEnBackground();

  const inputPerfilFoto = document.getElementById("inputPerfilFoto");
  if (inputPerfilFoto)
    inputPerfilFoto.addEventListener("change", cargarImagenPerfil);

  const modalPerfil = document.getElementById("modalPerfil");
  if (modalPerfil)
    modalPerfil.addEventListener("click", (e) => {
      if (e.target === modalPerfil) cerrarModalPerfil();
    });

  const btnUbicacion = document.getElementById("btnMiUbicacion");
  if (btnUbicacion) btnUbicacion.onclick = obtenerUbicacionActual;

});

async function cargarParroquiasEnBackground() {
    try {
        const res = await fetch(`${API_BASE}/parroquias`);
        if (res.ok) {
            listaParroquiasCache = await res.json();
            const select = document.getElementById('perfilParroquia');
            if(select && select.options.length <= 1) llenarSelectParroquias();
        }
    } catch (e) {
        console.error("Error cargando parroquias en background", e);
    }
}

function llenarSelectParroquias() {
    const select = document.getElementById('perfilParroquia');
    if(!select) return;
    
    const valorActual = select.value;

    select.innerHTML = '<option value="">Seleccione su parroquia</option>';
    
    const fragment = document.createDocumentFragment();
    listaParroquiasCache.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id_parroquia || p.id; 
        option.text = p.nombre_parroquia || p.nombre;
        fragment.appendChild(option);
    });
    select.appendChild(fragment);

    if(valorActual) {
        select.value = valorActual;
    } else if (usuarioLogueado.parroquia) {
        const idParroquia = usuarioLogueado.parroquia.id_parroquia || usuarioLogueado.parroquia.id;
        select.value = idParroquia;
    }
}


function initMap() {
  const lat = -2.9001;
  const lng = -79.0059;

  map = L.map("mapaUsuario", {
        maxBounds: CUENCA_BOUNDS,
        maxBoundsViscosity: 1.0
    }).setView([lat, lng], 13);


  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  recyclingLayer = L.layerGroup().addTo(map);
  rewardLayer = L.layerGroup().addTo(map);
}

const iconPuntoFijo = L.divIcon({
  className: "custom-div-icon",
  html: `
    <div style='background-color:#2ecc71; width:35px; height:35px; border-radius:50%; border:2px solid white; display:flex; justify-content:center; align-items:center; box-shadow:0 3px 5px rgba(0,0,0,0.3);'>
        <i class='fa-solid fa-recycle' style='color:white; font-size:18px;'></i>
    </div>`,
  iconSize: [35, 35],
  iconAnchor: [17, 17],
  popupAnchor: [0, -20]
});

const iconRecicladorMovil = L.divIcon({
  className: "custom-div-icon",
  html: `
    <div style='background-color:#3498db; width:35px; height:35px; border-radius:50%; border:2px solid white; display:flex; justify-content:center; align-items:center; box-shadow:0 3px 5px rgba(0,0,0,0.3);'>
        <i class='fa-solid fa-user' style='color:white; font-size:16px;'></i>
    </div>`,
  iconSize: [35, 35],
  iconAnchor: [17, 17],
  popupAnchor: [0, -20]
});

const iconRecompensa = L.divIcon({
  className: "custom-div-icon",
  html: "<div style='background-color:#8E44AD; width:30px; height:30px; border-radius:50%; border:2px solid white; display:flex; justify-content:center; align-items:center; box-shadow:0 3px 5px rgba(0,0,0,0.3);'><i class='fa-solid fa-gift' style='color:white;'></i></div>",
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

async function cargarFiltrosMateriales() {
  const contenedor = document.getElementById("contenedorBotonesMateriales");
  if (!contenedor) return;

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

async function cargarPuntosReciclaje() {
  try {
    const res = await fetch(`${API_BASE}/ubicacion_reciclajes`);
    if (res.ok) {
      todasLasUbicaciones = await res.json();
      renderizarMarcadoresReciclaje(todasLasUbicaciones);
    }
  } catch (e) {
    console.error("Error cargando puntos reciclaje", e);
  }
}

window.filtrarMapa = function (idMaterial, btnElement) {
  document
    .querySelectorAll(".btn-filtro")
    .forEach((b) => b.classList.remove("active"));
  btnElement.classList.add("active");

  if (idMaterial === "todos") {
    renderizarMarcadoresReciclaje(todasLasUbicaciones);
  } else {
    const filtradas = todasLasUbicaciones.filter((ubicacion) => {
      if (
        !ubicacion.materialesAceptados ||
        ubicacion.materialesAceptados.length === 0
      )
        return false;
      return ubicacion.materialesAceptados.some(
        (um) => um.material && um.material.id_material === idMaterial
      );
    });
    renderizarMarcadoresReciclaje(filtradas);
  }
};

function renderizarMarcadoresReciclaje(listaPuntos) {
  if (recyclingLayer) recyclingLayer.clearLayers();

  listaPuntos.forEach((p) => {
    if (p.latitud && p.longitud) {
      
      const esReciclador = p.reciclador !== null && p.reciclador !== undefined;

      if (esReciclador && p.reciclador.estado === false) {
          return; 
      }

      const iconoUsar = esReciclador ? iconRecicladorMovil : iconPuntoFijo;
      const etiquetaTipo = esReciclador ? "Reciclador Móvil" : "Punto de Reciclaje";
      const colorTitulo = esReciclador ? "#3498db" : "#2ecc71"; 

      const idUbicacion = p.id_ubicacion_reciclaje || p.id_ubicacion;
      const esFav = verificarSiEsFavoritoBD(idUbicacion);
      
      const claseFav = esFav ? "activo" : "";
      const tituloFav = esFav ? "Quitar de favoritos" : "Guardar en favoritos";

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

      const marker = L.marker([p.latitud, p.longitud], { icon: iconoUsar });

      const popupContent = `
        <div style="text-align:center; min-width:180px;">
            <div style="font-size:10px; font-weight:bold; color:${colorTitulo}; text-transform:uppercase; margin-bottom:2px;">
                ${etiquetaTipo}
            </div>
            <h4 style="margin:0; color:#3A6958; font-size: 1.1rem;">${p.nombre}</h4>
            <p style="font-size:11px; color:#555; margin: 4px 0;">${p.direccion}</p>
            ${materialesHTML}

            <div style="display:flex; align-items:center; justify-content:center; gap: 10px; margin-top:12px;">
                <button onclick="abrirRuta(${p.latitud}, ${p.longitud})"
                  style="
                    background:#2ecc71; color:white; border:none;
                    padding:8px 12px; border-radius:20px; cursor:pointer;
                    font-size:11px; display:flex; align-items:center; gap:5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                  <i class="fa-solid fa-location-arrow"></i> Ir
                </button>

                <div style="display:flex; flex-direction:column; align-items:center;" title="${tituloFav}">
                    <i class="fa-solid fa-heart fav-icon ${claseFav}"
                       onclick="toggleFavoritoBD(event, this, ${idUbicacion})"></i>
                </div>
            </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(recyclingLayer);
    }
  });
}
async function cargarPuntosRecompensa() {
  try {
    const res = await fetch(`${API_BASE}/recompensas`);
    const recompensas = await res.json();

    if (rewardLayer) rewardLayer.clearLayers();

    recompensas.forEach((r) => {
      if (r.latitud && r.longitud) {
        const marker = L.marker([r.latitud, r.longitud], {
          icon: iconRecompensa,
        });
        const popupContent = `
                    <div style="text-align:center;">
                        <h4 style="margin:0; color:#8E44AD;">${r.nombre}</h4>
                        <p style="margin:5px 0; font-size:12px;">${
                          r.direccion || "Ubicación de canje"
                        }</p>
                        <strong style="color:#E67E22;">${
                          r.costoPuntos
                        } Puntos</strong><br>
                        <button onclick="verDetalleRecompensa(${
                          r.id_recompensa
                        })" 
                            style="margin-top:5px; background:#8E44AD; color:white; border:none; border-radius:4px; cursor:pointer; padding:3px 8px; font-size:11px;">
                            Ver más
                        </button>
                    </div>`;
        marker.bindPopup(popupContent);
        marker.addTo(rewardLayer);
      }
    });
  } catch (e) {
    console.error("Error cargando recompensas", e);
  }
}

function obtenerUbicacionActual() {
  if (!navigator.geolocation) {
    return Swal.fire(
      "Error",
      "Tu navegador no soporta geolocalización",
      "error"
    );
  }

  Swal.fire({
    title: "Obteniendo ubicación...",
    text: "Por favor permite el acceso a tu ubicación",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  navigator.geolocation.getCurrentPosition(
    (position) => {
      Swal.close();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      coordenadas = { lat: lat, lng: lng };

      map.setView([lat, lng], 16);

      ubicacionActual = { lat, lng };

      if (marcadorMiUbicacion) {
        map.removeLayer(marcadorMiUbicacion);
      }

      marcadorMiUbicacion = L.marker([lat, lng]).addTo(map);

      // Si existe el elemento txtLat (a veces no existe en esta vista)
      if(document.getElementById("txtLat")) {
          document.getElementById("txtLat").innerText = lat.toFixed(5);
          document.getElementById("txtLng").innerText = lng.toFixed(5);
      }

      const btn = document.getElementById("btnGeo");
      if(btn) {
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Ubicación encontrada';
          setTimeout(() => {
            btn.innerHTML =
              '<i class="fa-solid fa-location-crosshairs"></i> Usar mi ubicación actual';
          }, 3000);
      }
    },
    (error) => {
      Swal.close();
      let msg = "No se pudo obtener la ubicación.";
      if (error.code === 1)
        msg = "Debes permitir el acceso a la ubicación en tu navegador.";
      Swal.fire("Error", msg, "error");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function abrirRuta(latDestino, lngDestino) {
  if (!ubicacionActual) {
    Swal.fire(
      "Ubicación requerida",
      "Primero presiona 'Usar mi ubicación actual'",
      "info"
    );
    return;
  }

  const { lat, lng } = ubicacionActual;

  const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${latDestino},${lngDestino}&travelmode=driving`;
  window.open(url, "_blank");
}


async function recargarUsuarioDesdeBackend() {
  try {
    const cedula = usuarioLogueado.cedula;
    const res = await fetch(`${API_BASE}/usuarios/${cedula}`);
    if (!res.ok) throw new Error("No se pudo obtener usuario");
    const usuarioActualizado = await res.json();

    usuarioLogueado = usuarioActualizado;

    // Guardamos en LocalStorage
    localStorage.setItem("usuario", JSON.stringify(usuarioActualizado));

  } catch (e) {
    console.error("Error actualizando usuario:", e);
  }
}

function cargarInfoUsuario() {
  document.getElementById("nombreUsuarioNav").innerText = usuarioLogueado.primer_nombre;
  document.getElementById("puntosActuales").innerText = usuarioLogueado.puntos_actuales || 0;

  // --- CORRECCIÓN: SOPORTE PARA URL O BASE64 ---
  if (usuarioLogueado.foto && usuarioLogueado.foto.length > 5) {
      let fotoSrc = usuarioLogueado.foto;
      if (!fotoSrc.startsWith("http") && !fotoSrc.startsWith("data:")) {
          fotoSrc = `data:image/png;base64,${usuarioLogueado.foto}`;
      }
      document.getElementById("imgPerfilNav").src = fotoSrc;
  }
  // ---------------------------------------------

  const lblRango = document.getElementById("rangoUsuario");
  const imgRango = document.getElementById("imgRango");

  if (usuarioLogueado.rango) {
    lblRango.innerText = usuarioLogueado.rango.nombre_rango;
    if (
      usuarioLogueado.rango.imagen &&
      usuarioLogueado.rango.imagen.length > 10
    ) {
      let imgClean = usuarioLogueado.rango.imagen;
      if (!imgClean.startsWith("http") && !imgClean.startsWith("data:")) {
        imgClean = `data:image/png;base64,${imgClean}`;
      }
      imgRango.src = imgClean;
      imgRango.style.display = "block";
    } else {
      imgRango.style.display = "none";
      lblRango.innerText = `🌱 ${usuarioLogueado.rango.nombre_rango}`;
    }
  } else {
    lblRango.innerText = "Sin Rango";
    imgRango.style.display = "none";
  }
}

function logout() {
  Swal.fire({
    title: "¿Salir?",
    text: "Se cerrará tu sesión",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Sí, salir",
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem("usuario");
      window.location.href = "../incio_de_sesion/login-registro.html";
    }
  });
}

function verDetalleRecompensa(id) {
  window.location.href = `catalogo/catalogo.html?id=${id}`;
}

function toggleMenu() {
  document.getElementById("userMenu").classList.toggle("active");
}


async function cargarMisFavoritos() {
  try {
    const cedula = usuarioLogueado.cedula;
    const res = await fetch(`${API_BASE}/favoritos/usuario/${cedula}`);
    if (res.ok) listaFavoritos = await res.json();
  } catch (e) {
    console.error(e);
  }
}

function verificarSiEsFavoritoBD(idUbicacion) {
  return listaFavoritos.some(
    (f) => f.ubicacion && f.ubicacion.id_ubicacion_reciclaje === idUbicacion
  );
}

async function toggleFavoritoBD(event, iconElement, idUbicacion) {
  event.stopPropagation();
  const favoritoExistente = listaFavoritos.find(
    (f) => f.ubicacion && f.ubicacion.id_ubicacion_reciclaje === idUbicacion
  );

  try {
    if (favoritoExistente) {
      const res = await fetch(
        `${API_BASE}/favoritos/${favoritoExistente.id_favorito}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        iconElement.classList.remove("activo");
        listaFavoritos = listaFavoritos.filter(
          (f) => f.id_favorito !== favoritoExistente.id_favorito
        );
        Swal.fire({
          icon: "info",
          title: "Eliminado",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 1500,
        });
      }
    } else {
      const payload = {
        usuario: { cedula: usuarioLogueado.cedula },
        ubicacion: { id_ubicacion_reciclaje: idUbicacion },
      };
      const res = await fetch(`${API_BASE}/favoritos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const nuevoFav = await res.json();
        iconElement.classList.add("activo");
        listaFavoritos.push(nuevoFav);
        Swal.fire({
          icon: "success",
          title: "Guardado",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 1500,
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
}


function abrirModalPerfil() {
  const modal = document.getElementById("modalPerfil");
  const prev = document.getElementById("perfilPreview");

  fotoNuevaFile = null;
  if(document.getElementById("inputPerfilFoto")) document.getElementById("inputPerfilFoto").value = "";

  document.getElementById("perfilPrimerNombre").value = usuarioLogueado.primer_nombre || "";
  document.getElementById("perfilSegundoNombre").value = usuarioLogueado.segundo_nombre || "";
  document.getElementById("perfilApellidoPaterno").value = usuarioLogueado.apellido_paterno || "";
  document.getElementById("perfilApellidoMaterno").value = usuarioLogueado.apellido_materno || "";
  document.getElementById("perfilCorreo").value = usuarioLogueado.correo || "";
  document.getElementById("perfilPassword").value = "";

  if(listaParroquiasCache.length > 0) {
      llenarSelectParroquias();
  } else {
      cargarParroquiasEnBackground().then(() => llenarSelectParroquias());
  }

  let fotoSrc = "https://placehold.co/100";
  if (usuarioLogueado.foto && usuarioLogueado.foto.length > 5) {
      if (usuarioLogueado.foto.startsWith("http") || usuarioLogueado.foto.startsWith("data:")) {
          fotoSrc = usuarioLogueado.foto;
      } else {
          fotoSrc = `data:image/png;base64,${usuarioLogueado.foto}`;
      }
  }
  prev.src = fotoSrc;

  modal.style.display = "flex";
}

function cerrarModalPerfil() {
  document.getElementById("modalPerfil").style.display = "none";
}

// --- CARGA DE IMAGEN CON COMPRESIÓN ---
async function cargarImagenPerfil() {
  const input = document.getElementById("inputPerfilFoto");
  const prev = document.getElementById("perfilPreview");
  const file = input.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
      Swal.fire("Error", "Solo imágenes permitidas", "error");
      input.value = "";
      return;
  }

  try {
      // 1. Comprimir
      const archivoComprimido = await comprimirImagen(file);
      
      // 2. Guardar para enviar después
      fotoNuevaFile = archivoComprimido;

      // 3. Previsualizar
      const reader = new FileReader();
      reader.onload = (e) => {
        prev.src = e.target.result;
      };
      reader.readAsDataURL(archivoComprimido);

  } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudo procesar la imagen", "error");
  }
}

// --- FUNCIÓN DE COMPRESIÓN ---
async function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const maxWidth = 500; // Avatar pequeño, 500px es suficiente
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
                        reject(new Error("Error al comprimir imagen"));
                        return;
                    }
                    const archivoComprimido = new File([blob], archivo.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(archivoComprimido);
                }, 'image/jpeg', quality);
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}

// --- GUARDAR PERFIL CON FORMDATA ---
async function guardarPerfil() {
  try {
    const passInput = document.getElementById("perfilPassword").value.trim();
    const idParroquia = document.getElementById("perfilParroquia").value;

    if(!idParroquia) {
        return Swal.fire("Atención", "Selecciona una parroquia", "warning");
    }

    // 1. Objeto JSON
    const datosUsuario = {
      cedula: usuarioLogueado.cedula,
      primer_nombre: document.getElementById("perfilPrimerNombre").value.trim(),
      segundo_nombre: document.getElementById("perfilSegundoNombre").value.trim(),
      apellido_paterno: document.getElementById("perfilApellidoPaterno").value.trim(),
      apellido_materno: document.getElementById("perfilApellidoMaterno").value.trim(),
      correo: document.getElementById("perfilCorreo").value.trim(),
      
      foto: null, // Backend maneja esto si hay archivo nuevo

      estado: true,
      parroquia: { id_parroquia: parseInt(idParroquia) },
      password: passInput !== "" ? passInput : null 
    };

    // 2. FormData
    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosUsuario));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }
 
    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

    // 3. Enviar
    const res = await fetch(`${API_BASE}/usuarios/${usuarioLogueado.cedula}`, {
      method: "PUT",
      body: formData, 
    });

    if (res.ok) {
      const actualizado = await res.json();

      usuarioLogueado = actualizado;
      
      try {
          localStorage.setItem("usuario", JSON.stringify(actualizado));
      } catch(e) {
          console.warn("Storage lleno, ignorando...");
      }

      cargarInfoUsuario(); 

      Swal.fire({
          icon: 'success',
          title: '¡Perfil Actualizado!',
          text: 'Tus datos se han guardado.',
          confirmButtonColor: '#2ecc71',
      }).then(() => {
          cerrarModalPerfil();
      });

    } else {
      const errorText = await res.text();
      console.error("Error Backend:", errorText);
      Swal.fire("Error", "No se pudo actualizar.", "error");
    }
  } catch (e) {
    console.error(e);
    Swal.fire("Error", "Fallo de conexión con el servidor", "error");
  }
}

// --- NUEVA FUNCIÓN PARA CARGAR PARROQUIAS ---
async function cargarParroquiasEnPerfil() {
    const select = document.getElementById('perfilParroquia');
    if(!select) return;
    
    try {
        const res = await fetch(`${API_BASE}/parroquias`);
        if (res.ok) {
            const parroquias = await res.json();
            select.innerHTML = '<option value="">Seleccione su parroquia</option>';
            parroquias.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id_parroquia || p.id; 
                option.text = p.nombre_parroquia || p.nombre;
                select.appendChild(option);
            });
        }
    } catch (e) {
        console.error("Error cargando parroquias", e);
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
}


async function cargarNotificaciones() {

  try {
    const res = await fetch(
      `${API_BASE}/notificaciones/usuario/${usuarioLogueado.cedula}`
    );
    if (!res.ok) return;

    notificaciones = await res.json();
    notificacionesCargadas = true; 

    renderNotificaciones();
    actualizarContadorVisual(); 
  } catch (e) {
    console.error("Error cargando notificaciones", e);
  }
}

function actualizarContadorVisual() {
  const badge = document.getElementById("contadorNotificaciones");
  const noLeidas = notificaciones.filter((n) => !n.leido).length;

  if (noLeidas > 0) {
    badge.innerText = noLeidas;
    badge.style.display = "block"; 
  } else {
    badge.style.display = "none";
  }
}

async function actualizarContadorNotificaciones() {
  try {
    const badge = document.getElementById("contadorNotificaciones");
    const res = await fetch(
      `${API_BASE}/notificaciones/contar/${usuarioLogueado.cedula}`
    );
    if (!res.ok) return;
    const total = await res.json();
    if (total > 0) {
      badge.innerText = total;
      badge.style.display = "block";
    } else {
      badge.style.display = "none";
    }
  } catch (e) {
    console.error(e);
  }
}

function renderNotificaciones() {
  const contenedor = document.getElementById("listaNotificaciones");
  if (!notificaciones.length) {
    contenedor.innerHTML = `<p class="noti-vacia">No tienes notificaciones</p>`;
    return;
  }
  contenedor.innerHTML = "";
  notificaciones.forEach((n) => {
    const div = document.createElement("div");
    div.className = `noti-item ${n.leido ? "" : "no-leida"}`;
    div.innerHTML = `<div class="noti-titulo">${n.titulo}</div><div class="noti-mensaje">${n.mensaje}</div>`;
    div.onclick = () => abrirNotificacion(n);
    contenedor.appendChild(div);
  });
}

function abrirNotificacion(n) {
  if (!n.entidad_referencia || !n.id_referencia) return;
  switch (n.entidad_referencia) {
    case "SOLICITUD":
    case "SOLICITUD_RECOLECCION":
      break;
    case "CANJEO":
      window.location.href = `cupones/mis_cupones.html`;
      break;
    case "LOGRO":
      abrirModalRangos();
      break;
    default:
      console.warn("Tipo no manejado:", n.entidad_referencia);
  }
}

async function marcarNotificacionesLeidas() {
  notificaciones.forEach((n) => (n.leido = true));
  renderNotificaciones(); 

  try {
    await fetch(
      `${API_BASE}/notificaciones/marcar-leidas/${usuarioLogueado.cedula}`,
      {
        method: "PUT",
      }
    );
  } catch (e) {
    console.error("Error marcando leídas", e);
  }
}

function toggleNotificaciones() {
  const panel = document.getElementById("panelNotificaciones");
  const esVisible = panel.classList.contains("active");

  if (esVisible) {
    panel.classList.remove("active");
  } else {
    panel.classList.add("active");

    const badge = document.getElementById("contadorNotificaciones");
    if (badge.style.display !== "none") {
      badge.style.display = "none"; 
      marcarNotificacionesLeidas();
    }
  }
}

async function abrirModalRangos() {
  const modal = document.getElementById("modalRangos");
  modal.style.display = "flex";

  const container = document.getElementById("listaRangosContainer");
  const barra = document.getElementById("barraProgresoGlobal");
  const texto = document.getElementById("textoProgreso");

  container.innerHTML =
    '<p style="text-align:center; padding:20px;">Calculando datos...</p>';

  try {
    const resRangos = await fetch(`${API_BASE}/rangos`);
    if (!resRangos.ok) throw new Error("Error obteniendo rangos");
    let rangos = await resRangos.json();

    rangos.sort((a, b) => a.id_rango - b.id_rango);

    const cedula = usuarioLogueado.cedula;
    const resCount = await fetch(
      `${API_BASE}/solicitud_recolecciones/contar/${cedula}`
    );
    let totalRecolecciones = 0;

    if (resCount.ok) {
      totalRecolecciones = await resCount.json(); // Número entero (ej: 12, 27, 30)
    }

    renderizarCaminoRangos(rangos, totalRecolecciones);

    const recoleccionesEnNivelActual = totalRecolecciones % 25;
    const porcentaje = (recoleccionesEnNivelActual / 25) * 100;
    const faltan = 25 - recoleccionesEnNivelActual;

    if (barra) barra.style.width = `${porcentaje}%`;

    if (texto) {
      texto.innerHTML = `
                Total entregas: <b>${totalRecolecciones}</b> <br>
                Faltan <b>${faltan}</b> para el siguiente rango.
            `;
    }
  } catch (e) {
    console.error(e);
    container.innerHTML =
      '<p style="text-align:center; color:red;">Error al cargar datos</p>';
  }
}

function cerrarModalRangos() {
  document.getElementById("modalRangos").style.display = "none";
}

function renderizarCaminoRangos(rangos, totalReal) {
  const container = document.getElementById("listaRangosContainer");
  container.innerHTML = "";

  const idRangoCalculado = Math.floor(totalReal / 25) + 1;

  rangos.forEach((rango) => {
    let claseEstado = "";
    let iconoEstado = '<i class="fa-solid fa-lock"></i>'; // Futuro

    if (rango.id_rango < idRangoCalculado) {
      claseEstado = "passed"; // Pasado
      iconoEstado = '<i class="fa-solid fa-check-circle"></i>';
    } else if (rango.id_rango === idRangoCalculado) {
      claseEstado = "current"; // Actual
      iconoEstado = '<i class="fa-solid fa-star"></i>';
    }

    let imgSrc = "https://via.placeholder.com/50?text=?";
    if (rango.imagen && rango.imagen.length > 20) {
      let imgClean = rango.imagen;
      if (!imgClean.startsWith("http") && !imgClean.startsWith("data:")) {
        imgClean = `data:image/png;base64,${imgClean}`;
      }
      imgSrc = imgClean;
    }

    const recoleccionesMeta = rango.id_rango * 25;

    const card = document.createElement("div");
    card.className = `rango-card ${claseEstado}`;
    card.innerHTML = `
            <img src="${imgSrc}" class="rango-img" alt="${rango.nombre_rango}">
            <div class="rango-info">
                <h4>${rango.nombre_rango}</h4>
                <p>Se alcanza a las ${recoleccionesMeta} entregas</p>
            </div>
            <div class="status-icon">
                ${iconoEstado}
            </div>
        `;
    container.appendChild(card);
  });
}



const GEMINI_API_KEY = "AIzaSyDwesq_y6S0L7SdNCuXjdwOZlrDeS6_puU";

const LOOPI_DATA = `
ERES LOOPIBOT: Un asistente virtual experto en reciclaje para la app "Loopi" en Cuenca, Ecuador.
TU ESTILO: Amable, ecuatoriano ("ñaño", "chévere"), respuestas cortas.
INFO APP:
- Rangos: Semilla, Brote, Árbol Joven, Bosque.
- Puntos: Ganas por kg reciclado.
- Materiales: Plástico PET, Cartón, Vidrio, Papel, Pilas.
- Recompensas: Cupones en Supermaxi, KFC, Farmacias.
- Reciclaje: Lavar, secar y aplastar.
`;


window.toggleChat = function() {
    const chat = document.getElementById("chatWindow");
    if (chat.style.display === "flex") {
        chat.style.display = "none";
    } else {
        chat.style.display = "flex";
        setTimeout(() => document.getElementById("chatInput").focus(), 100);
        
        const body = document.getElementById("chatBody");
        if (body.children.length === 0) {
            agregarMensaje("¡Hola ñaño! 👋 Soy LoopiBot. Pregúntame sobre reciclaje.", "bot");
        }
    }
};

window.checkEnter = function(e) {
    if (e.key === "Enter") window.enviarMensaje();
};

window.enviarMensaje = async function() {
    const input = document.getElementById("chatInput");
    const texto = input.value.trim();

    if (!texto) return;

    agregarMensaje(texto, "user");
    input.value = "";
    input.disabled = true;

    const loadingId = agregarMensaje("Pensando... 🤔", "bot", true);

    try {
        const respuestaIA = await consultarGeminiRobusto(texto);
        eliminarMensaje(loadingId);
        agregarMensaje(respuestaIA, "bot");
    } catch (error) {
        console.error("Error IA:", error);
        eliminarMensaje(loadingId);
        // Si falla, mensaje amigable
        agregarMensaje("Chuta ñaño, no pude conectar. Asegúrate de haber habilitado la API en Google Cloud.", "bot");
    } finally {
        input.disabled = false;
        input.focus();
    }
};

async function consultarGeminiRobusto(pregunta) {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{ 
            parts: [{ 
                text: LOOPI_DATA + "\n\nUsuario: " + pregunta 
            }] 
        }]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("ERROR GOOGLE DETALLADO:", errorData);
        throw new Error(`Google Error: ${errorData.error.message || response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    }
    
    return "Lo siento, no pude procesar eso. Intenta de nuevo.";
}

function agregarMensaje(texto, tipo, esLoading = false) {
    const chatBody = document.getElementById("chatBody");
    const div = document.createElement("div");
    div.className = `msg ${tipo}`;
    const id = "msg-" + Date.now();
    
    if (esLoading) {
        div.id = id;
        div.style.fontStyle = "italic";
        div.style.opacity = "0.7";
    }

    const textoFormat = texto.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `<p>${textoFormat}</p>${!esLoading ? `<span class="time">${hora}</span>` : ''}`;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return id;
}

function eliminarMensaje(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}