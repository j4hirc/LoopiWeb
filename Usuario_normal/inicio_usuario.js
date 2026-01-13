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


const GROQ_API_KEY = "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"; 
let infoMateriales = "Cargando materiales...";
let infoRecompensas = "Cargando recompensas...";
let infoRangos = "Cargando rangos...";
let infoPuntosReciclaje = "Cargando puntos cercanos...";
let infoLogros = "Cargando logros...";
let historialChat = [];
let infoMisLogros = "Aún no reviso tus medallas..."; 


const imagenesEllie = [
    "../Imagenes/ELLIE_LOOPI.png",
    "../Imagenes/Ellie2.png",
    "../Imagenes/Ellie3.png",
    "../Imagenes/Ellie4.png",
    "../Imagenes/Ellie5.png",
    "../Imagenes/Ellie6.png",
    "../Imagenes/Ellie7.png",
    "../Imagenes/Ellie8.png"
];

const CUENCA_BOUNDS = L.latLngBounds(
    [-2.99, -79.15], 
    [-2.8, -78.85] 
);


document.addEventListener("DOMContentLoaded", async () => {
  cambiarAvatarEllie();
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


  initMap();

  // 3. Cargar Datos
  await cargarNotificaciones();
  await cargarMisFavoritos();
  await cargarFiltrosMateriales();
  await cargarPuntosReciclaje();
  await cargarPuntosRecompensa();
  
  prepararDatosCompletosIA();

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


function cambiarAvatarEllie() {
    const indexAleatorio = Math.floor(Math.random() * imagenesEllie.length);
    const nuevaImagen = imagenesEllie[indexAleatorio];

    const imgFab = document.getElementById("imgEllieFab");
    const imgHeader = document.getElementById("imgEllieHeader");

    if (imgFab) {
        imgFab.style.opacity = "0"; 
        setTimeout(() => {
            imgFab.src = nuevaImagen;
            imgFab.style.opacity = "1";
        }, 200);
    }
    
    if (imgHeader) {
        imgHeader.src = nuevaImagen;
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

  if (usuarioLogueado.foto && usuarioLogueado.foto.length > 5) {
      let fotoSrc = usuarioLogueado.foto;
      if (!fotoSrc.startsWith("http") && !fotoSrc.startsWith("data:")) {
          fotoSrc = `data:image/png;base64,${usuarioLogueado.foto}`;
      }
      document.getElementById("imgPerfilNav").src = fotoSrc;
  }

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
      const archivoComprimido = await comprimirImagen(file);
      
      fotoNuevaFile = archivoComprimido;

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

async function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        const maxWidth = 500;
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

async function guardarPerfil() {
  try {
    const passInput = document.getElementById("perfilPassword").value.trim();
    const idParroquia = document.getElementById("perfilParroquia").value;

    if(!idParroquia) {
        return Swal.fire("Atención", "Selecciona una parroquia", "warning");
    }

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

    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosUsuario));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }
 
    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

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
      totalRecolecciones = await resCount.json(); 
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





async function prepararDatosCompletosIA() {
    try {
        const cedula = usuarioLogueado.cedula;

        const [resMat, resRec, resRan, resUbi, resLogros, resMisLogros] = await Promise.all([
            fetch(`${API_BASE}/materiales`),
            fetch(`${API_BASE}/recompensas`),
            fetch(`${API_BASE}/rangos`),
            fetch(`${API_BASE}/ubicacion_reciclajes`),
            fetch(`${API_BASE}/logros`),                  // Catálogo completo
            fetch(`${API_BASE}/usuarios/${cedula}/logros`) // Lo que tiene el usuario
        ]);

        if(resMat.ok) {
            const mats = await resMat.json();
            infoMateriales = mats.map(m => `- ${m.nombre}: ${m.puntos_por_kg} pts/kg.`).join('\n');
        }

        if(resRec.ok) {
            const recs = await resRec.json();
            infoRecompensas = recs.map(r => `- ${r.nombre} (Cuesta ${r.costoPuntos} pts)`).join('\n');
        }

        if(resRan.ok) {
            const rangos = await resRan.json();
            infoRangos = rangos.map(r => `- Rango ${r.id_rango}: ${r.nombre_rango}`).join('\n');
        }

        if(resUbi.ok) {
            let ubis = await resUbi.json();
            
            if (usuarioLogueado.parroquia) {
                const idMiParroquia = usuarioLogueado.parroquia.id_parroquia || usuarioLogueado.parroquia.id;
                
                const ubisDeMiParroquia = ubis.filter(u => 
                    u.parroquia && (u.parroquia.id_parroquia === idMiParroquia || u.parroquia.id === idMiParroquia)
                );

                if (ubisDeMiParroquia.length > 0) {
                    ubis = ubisDeMiParroquia;
                } else {
                }
            }

            if (ubis.length > 0) {
                infoPuntosReciclaje = ubis.map(u => {
                    let mats = u.materialesAceptados?.map(m => m.material.nombre).join(", ") || "Todos";
                    let horario = u.horarios?.map(h => `${h.dia} (${h.hora_inicio}-${h.hora_fin})`).join(", ") || "No especificado";
                    return `📍 "${u.nombre}" (${u.direccion}). Acepta: ${mats}. Horario: ${horario}`;
                }).join('\n\n');
            } else {
                infoPuntosReciclaje = "No se encontraron puntos de reciclaje registrados en tu parroquia.";
            }
        }

        if (resLogros.ok) {
            const todos = await resLogros.json();
            
            let misIds = new Set();
            let misNombres = [];
            
            if (resMisLogros.ok) {
                const mios = await resMisLogros.json();
                mios.forEach(l => {
                    misIds.add(l.id_logro);
                    misNombres.push(l.nombre);
                });
            }

            infoLogros = todos.map(l => 
                `- Medalla: "${l.nombre}" (Premio: ${l.puntos_ganados} pts). Misión: ${l.descripcion}`
            ).join('\n');

            if (misNombres.length > 0) {
                infoMisLogros = `🏆 EL USUARIO TIENE ESTOS LOGROS DESBLOQUEADOS: ${misNombres.join(", ")}.`;
            } else {
                infoMisLogros = "El usuario aún NO tiene logros desbloqueados. ¡Motívalo!";
            }
        }

    } catch(e) {
        console.error("Error preparando cerebro IA:", e);
    }
}


window.toggleChat = function() {
    const chat = document.getElementById("chatWindow");
    if (chat.style.display === "flex") {
        chat.style.display = "none";
    } else {
        chat.style.display = "flex";
        setTimeout(() => document.getElementById("chatInput").focus(), 100);
        
        if (historialChat.length === 0) {
            const chatBody = document.getElementById("chatBody");
            
            chatBody.innerHTML = ""; 

            const saludo = `¡Hola ${usuarioLogueado.primer_nombre}! ✨ Qué lindo verte por aquí. Soy **Ellie Loopi**, tu amiga ecológica 🌸. Estoy lista para ayudarte a ganar puntos y cuidar el planeta. ¿En qué te acolito hoy? 💖`;
            
            agregarMensaje(saludo, "bot");
            historialChat.push({ role: "assistant", content: saludo });
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
    historialChat.push({ role: "user", content: texto });

    input.value = "";
    input.disabled = true;

    const loadingId = agregarMensaje("Pensando... 🧠", "bot", true);

    try {
        const respuesta = await consultarGroq();
        
        eliminarMensaje(loadingId);
        agregarMensaje(respuesta, "bot");
        
        historialChat.push({ role: "assistant", content: respuesta });

    } catch (error) {
        console.error("Error Groq:", error);
        eliminarMensaje(loadingId);
        agregarMensaje("Chuta, se me fue el internet ñaño (" + error.message + "). Intenta de nuevo.", "bot");
        historialChat.pop();
    } finally {
        input.disabled = false;
        input.focus();
    }
};

async function consultarGroq() {
    
    const puntosUsuario = usuarioLogueado.puntos_actuales || 0;
    const rangoActual = usuarioLogueado.rango ? usuarioLogueado.rango.nombre_rango : "Reciclador Nuevo";
    
    const MANUAL_LOOPI = `
[MANUAL OFICIAL DE LOOPI - VERSIÓN USUARIO]

1. FUNCIONALIDADES PRINCIPALES:
   - SOLICITUD DE RECOLECCIÓN-Reciclar: Ve al botón "Solicitud" -> Elige ubicación, fecha y material -> Confirma[cite: 259, 260, 261].
   - favorito: Si quiere seleccionar una ubicacion a favoritos, busque en el mapa, y seleccione el punto favorito, y presione el icono de corazon.
   - CANJE DE PREMIOS: Entra a "Canjear" -> Elige el premio -> Canjear -> Escanea el QR en el local para recibir tu recompensa[cite: 351, 352, 354, 355].
   - MAPA: Usa "Explora tu zona" para ver puntos fijos (verde) y Recicladores (azul). Puedes filtrar por tipo de material[cite: 392, 394].
   - SECCION APRENDE- QUE TIENE TIPS DE COMO RECICLAR
   -SECCION MIS CUPONES: DONDE SE VAN A VER TODAS TUS RECOMPENSAS CANJEADAS, (Recuerda ir al local de la recompensa)
   -Historial : seccion donde puedes encontrar tu historial reciclador y estadisticas.

2. SISTEMA DE GAMIFICACIÓN:
   - Puntos: Se ganan por cada Kilogramo entregado y validado[cite: 309].
   - Rangos: Subes de nivel automáticamente al acumular entregas (Bronce: 0-25, Plata: 26-50, Oro: 51-75, Diamante: 76-100, Inmortal: >100)[cite: 310, 317, 319, 321, 323, 326].
   - Logros: Medallas especiales por cumplir entregas específicas[cite: 311].
`;


    const SYSTEM_PROMPT = `
    ERES ELLIE LOOPI: La asistente virtual más dulce, femenina y pilas de la app "Loopi" en Cuenca, Ecuador. 🌸

    TU IDENTIDAD:
    - Eres una chica joven, alegre, detallista y súper cariñosa (tipo mejor amiga).
    - Te encanta que el usuario progrese y celebras sus logros con emoción.
    - Usas una mochila 🎒 para recolectar reciclaje.

    TU MISIÓN:
    - Revisar qué logros tiene el usuario y felicitarlo.
    - Decirle qué logros le faltan para motivarlo.
    - Calcular puntos y ayudar con ubicaciones.

    PERSONALIDAD CUENCANA Y DULCE:
    -Formal y femenina
    - Tono: Muy suave, usas exclamaciones de alegría. Ej: "¡Me encanta verte progresar!".
    - Emojis: 🌸, ✨, 💖, 🏆, 🌿, 🎒.

    --- DATOS DEL USUARIO ---
    - Nombre: ${usuarioLogueado.primer_nombre}
    - Puntos actuales: ${puntosUsuario} ✨
    - Rango Actual: ${rangoActual} 🏅
    
    ${infoMisLogros}  <-- ¡AQUÍ SABE QUÉ MEDALLAS TIENE!

    --- INFORMACIÓN DE LOOPI ---
    ${MANUAL_LOOPI}

    [TODOS LOS LOGROS POSIBLES]
    ${infoLogros}

    [RANGOS]
    ${infoRangos}

    [MATERIALES]
    ${infoMateriales}

    [UBICACIONES]
    ${infoPuntosReciclaje}

    [PREMIOS]
    ${infoRecompensas}

    INSTRUCCIONES DE RAZONAMIENTO:
    1. **LOGROS:** Si el usuario pregunta "¿Cómo voy?" o sobre sus logros, revisa la lista de "EL USUARIO TIENE..." y felicítalo por los que ya tiene. Luego, mira la lista de "TODOS LOS LOGROS" y recomiéndale uno fácil que le falte.
       *Ejemplo:* "¡Qué bestia mi ñaño! 🌸 Ya tienes la medalla 'Reciclador de Vidrio'. ¡Estoy súper orgullosa! 💖 Ahora intenta conseguir la de 'Pilas'..."
    
    2. **RANGO:** Menciona su rango actual (${rangoActual}) para que se sienta importante.

    3. **PUNTOS:** Calcula siempre: Kilos x Puntos Unitarios. Nunca hables de dinero.

    FORMATO: Sé breve, útil y muy amorosa.
    `;
    

    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    const messagesPayload = [
        { role: "system", content: SYSTEM_PROMPT },
        ...historialChat 
    ];

    if (messagesPayload.length > 15) {
        messagesPayload.splice(1, messagesPayload.length - 11);
    }

    const payload = {
        model: "llama-3.3-70b-versatile", 
        messages: messagesPayload,
        temperature: 0.7, 
        max_tokens: 600   
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorDetail = await response.json();
        const msg = errorDetail.error ? errorDetail.error.message : response.statusText;
        throw new Error(msg);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function agregarMensaje(texto, tipo, esLoading = false) {
    const chatBody = document.getElementById("chatBody");
    const div = document.createElement("div");
    div.className = `msg ${tipo}`;
    div.id = esLoading ? "msg-" + Date.now() : "";
    
    if (esLoading) { div.style.fontStyle = "italic"; div.style.opacity = "0.7"; }

    const textoHtml = texto
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>"); 

    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `<p>${textoHtml}</p>${!esLoading ? `<span class="time">${hora}</span>` : ''}`;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return div.id;
}

function eliminarMensaje(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}