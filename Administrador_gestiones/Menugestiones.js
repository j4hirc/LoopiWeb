const API_BASE = 'https://api-loopi.onrender.com/api';

let fotoNuevaFile = null; 

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
        fotoNuevaFile = file;

        const reader = new FileReader();
        reader.onload = function (e) {
          document.getElementById("perfilPreview").src = e.target.result;
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
  document.getElementById("perfilPassword").value = ""; 

  const imgPreview = document.getElementById("perfilPreview");
  
  fotoNuevaFile = null; 
  if (document.getElementById("inputPerfilFoto")) document.getElementById("inputPerfilFoto").value = "";

  let fotoSrc = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  
  if (usuario.foto && usuario.foto.length > 5) {
      if (usuario.foto.startsWith("http") || usuario.foto.startsWith("data:")) {
          fotoSrc = usuario.foto; // Es URL de Supabase o Base64 completo
      } else {
          fotoSrc = `data:image/png;base64,${usuario.foto}`; // Es Base64 antiguo sin cabecera
      }
  }
  imgPreview.src = fotoSrc;
  // ----------------------------------------------
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

  if (!primerNombre || !apellidoPaterno || !correo) {
    return Swal.fire("Error", "Nombre, Apellido y Correo son obligatorios", "error");
  }

  let usuarioActualDB = {};
  try {
      const r = await fetch(`${API_BASE}/usuarios/${usuarioLocal.cedula}`);
      usuarioActualDB = await r.json();
  } catch(e) { console.error(e); }

 const datosUsuario = {
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
    
    foto: usuarioActualDB.foto, 

    password: password ? password : null,
    
    
    parroquia: usuarioActualDB.parroquia ? { id_parroquia: usuarioActualDB.parroquia.id_parroquia || usuarioActualDB.parroquia.id } : null,
    
    rango: usuarioActualDB.rango ? { id_rango: usuarioActualDB.rango.id_rango } : null,

    roles: usuarioActualDB.roles ? usuarioActualDB.roles.map(r => ({
        id_usuario_rol: r.id_usuario_rol,
        rol: { id_rol: r.rol.id_rol } 
    })) : []
  };

  const formData = new FormData();
  formData.append("datos", JSON.stringify(datosUsuario)); 

  if (fotoNuevaFile) {
      formData.append("archivo", fotoNuevaFile);
  }

  try {
    const res = await fetch(`${API_BASE}/usuarios/${usuarioLocal.cedula}`, {
      method: "PUT",
      body: formData, 
    });

    if (res.ok) {
      const usuarioActualizado = await res.json();

      const nuevoStorage = {
          ...usuarioLocal,
          nombre: usuarioActualizado.primer_nombre, 
          apellido: usuarioActualizado.apellido_paterno,
          correo: usuarioActualizado.correo,
          foto: usuarioActualizado.foto // Guardamos la nueva URL
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
      const errorData = await res.json();
      Swal.fire("Error", errorData.mensaje || "No se pudo actualizar.", "error");
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