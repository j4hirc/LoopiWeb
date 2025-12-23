const API_BASE = 'https://api-loopi.onrender.com/api';

document.addEventListener("DOMContentLoaded", () => {
  const usuarioStr = localStorage.getItem("usuario");
  if (!usuarioStr) {
    window.location.href = "../incio_de_sesion/login-registro.html";
    return;
  }
  const usuario = JSON.parse(usuarioStr);

  const saludo = document.getElementById("saludoUsuario");
  if (saludo) {
    const nombreMostrar = usuario.nombre || usuario.primer_nombre || "Admin";
    const rolMostrar = usuario.rol_seleccionado ? usuario.rol_seleccionado.nombre : "Usuario";
    saludo.innerHTML = `<i class="fa-solid fa-circle-user"></i> <span>${nombreMostrar}</span> <small>(${rolMostrar})</small>`;
  }

  const btnLogout = document.getElementById("btnCerrarSesion");
  if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, salir",
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.removeItem("usuario");
          window.location.href = "../incio_de_sesion/login-registro.html";
        }
      });
    });
  }

  const btnPerfil = document.getElementById("btnAbrirPerfil");
  const modalPerfil = document.getElementById("modalPerfil");
  
  if (btnPerfil) {
    btnPerfil.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
          const res = await fetch(`${API_BASE}/usuarios/${usuario.cedula}`);
          if(res.ok) {
              const usuarioFull = await res.json();
              cargarDatosEnModal(usuarioFull);
              modalPerfil.style.display = "flex";
          } else {
              Swal.fire("Error", "No se pudo cargar el perfil", "error");
          }
      } catch(error) { console.error(error); }
    });
  }

  const inputFoto = document.getElementById("inputPerfilFoto");
  if (inputFoto) {
    inputFoto.addEventListener("change", function () {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          document.getElementById("perfilPreview").src = e.target.result;
          document.getElementById("perfilFotoBase64").value = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  cargarNotificacionesAdmin();
  setInterval(cargarNotificacionesAdmin, 15000);
});

function cargarDatosEnModal(usuario) {
  document.getElementById("perfilPrimerNombre").value = usuario.primer_nombre || "";
  document.getElementById("perfilSegundoNombre").value = usuario.segundo_nombre || "";
  document.getElementById("perfilApellidoPaterno").value = usuario.apellido_paterno || "";
  document.getElementById("perfilApellidoMaterno").value = usuario.apellido_materno || "";
  document.getElementById("perfilCorreo").value = usuario.correo || "";
  document.getElementById("perfilPassword").value = ""; // Siempre vacío al abrir

  const imgPreview = document.getElementById("perfilPreview");
  const hiddenBase64 = document.getElementById("perfilFotoBase64");

  if (usuario.foto && usuario.foto.length > 20) {
    let fotoSrc = usuario.foto.startsWith("data:") ? usuario.foto : `data:image/png;base64,${usuario.foto}`;
    imgPreview.src = fotoSrc;
    hiddenBase64.value = fotoSrc;
  } else {
    imgPreview.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    hiddenBase64.value = "";
  }
}

function cerrarModalPerfil() {
  document.getElementById("modalPerfil").style.display = "none";
}

async function guardarPerfil() {
  const usuarioLocal = JSON.parse(localStorage.getItem("usuario"));

  const primerNombre = document.getElementById("perfilPrimerNombre").value;
  const segundoNombre = document.getElementById("perfilSegundoNombre").value;
  const apellidoPaterno = document.getElementById("perfilApellidoPaterno").value;
  const apellidoMaterno = document.getElementById("perfilApellidoMaterno").value;
  const correo = document.getElementById("perfilCorreo").value;
  const password = document.getElementById("perfilPassword").value;
  const foto = document.getElementById("perfilFotoBase64").value;

  if (!primerNombre || !apellidoPaterno || !correo) {
    return Swal.fire("Error", "Nombre, Apellido y Correo son obligatorios", "error");
  }

  let usuarioActualDB = {};
  try {
      const r = await fetch(`${API_BASE}/usuarios/${usuarioLocal.cedula}`);
      usuarioActualDB = await r.json();
  } catch(e) { console.error(e); }

  const payload = {
    cedula: usuarioActualDB.cedula,
    fecha_nacimiento: usuarioActualDB.fecha_nacimiento,
    genero: usuarioActualDB.genero,
    estado: usuarioActualDB.estado,
    puntos_actuales: usuarioActualDB.puntos_actuales,
    
    primer_nombre: primerNombre,
    segundo_nombre: segundoNombre,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    correo: correo,
    foto: foto,


    password: password ? password : null,


    roles: null, 
    parroquia: usuarioActualDB.parroquia ? { id_parroquia: usuarioActualDB.parroquia.id_parroquia } : null,
    rango: usuarioActualDB.rango ? { id_rango: usuarioActualDB.rango.id_rango } : null
  };

  try {
    const res = await fetch(`${API_BASE}/usuarios/${usuarioLocal.cedula}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const usuarioActualizado = await res.json();

      const nuevoStorage = {
          ...usuarioLocal,
          nombre: usuarioActualizado.primer_nombre, 
          apellido: usuarioActualizado.apellido_paterno,
          correo: usuarioActualizado.correo,
      };
      
      localStorage.setItem("usuario", JSON.stringify(nuevoStorage));

      Swal.fire({
        icon: "success",
        title: "Perfil Actualizado",
        showConfirmButton: false,
        timer: 1500,
      }).then(() => {
        window.location.reload();
      });
    } else {
      const errorText = await res.text(); // Ver qué dice el backend
      console.error("Error Backend:", errorText);
      Swal.fire("Error", "No se pudo actualizar. Revisa la consola.", "error");
    }
  } catch (e) {
    console.error(e);
    Swal.fire("Error", "Error de conexión", "error");
  }
}

async function cargarNotificacionesAdmin() {
  try {
    const resRec = await fetch(`${API_BASE}/formularios_reciclador`);
    if (resRec.ok) {
      const data = await resRec.json();
      const pendientes = data.filter((f) => f.aprobado === null);
      actualizarBadge("badgeReciclador", pendientes.length);
    }

    const resEnt = await fetch(`${API_BASE}/solicitud_recolecciones/pendientes`);
    if (resEnt.ok) {
      const data = await resEnt.json();
      actualizarBadge("badgeEntregas", data.length);
    }
  } catch (e) { console.error("Error updates:", e); }
}

function actualizarBadge(id, cantidad) {
  const badge = document.getElementById(id);
  if (!badge) return;
  if (cantidad > 0) {
    badge.innerText = cantidad;
    badge.style.display = "flex";
    badge.classList.add("urgente");
  } else {
    badge.style.display = "none";
    badge.classList.remove("urgente");
  }
}