const BASE_URL = 'https://api-loopi.onrender.com';

const API_URL = `${BASE_URL}/api/usuarios`;
const API_PARROQUIAS = `${BASE_URL}/api/parroquias`;
const API_RANGOS = `${BASE_URL}/api/rangos`;

const gridUsuarios = document.getElementById('gridUsuarios');
const searchInput = document.getElementById('buscarUsuario');
const modalOverlay = document.getElementById('modalOverlay');
const tituloModal = document.getElementById('tituloModal');

const inpCedula = document.getElementById('cedula');
const inpNombre1 = document.getElementById('primerNombre');
const inpNombre2 = document.getElementById('segundoNombre');
const inpApellido1 = document.getElementById('apellidoPaterno');
const inpApellido2 = document.getElementById('apellidoMaterno');
const inpFecha = document.getElementById('fechaNacimiento');
const selGenero = document.getElementById('genero');
const inpCorreo = document.getElementById('correo');
const inpPassword = document.getElementById('password');
const selParroquia = document.getElementById('parroquia');
const inpPuntos = document.getElementById('puntos');
const selRango = document.getElementById('rango');
const switchEstado = document.getElementById('estado');

const imgPreview = document.getElementById('previewFoto');
const inpFoto = document.getElementById('fotoInput');

let usuariosCache = [];
let isEditMode = false;

const ROLES_ID_MAP = {
    'ADMINISTRADOR': 1,
    'RECICLADOR': 2,
    'USUARIO_NORMAL': 3
};

const filtroRol = document.getElementById('filtroRol');    
const filtroEstado = document.getElementById('filtroEstado');

document.addEventListener('DOMContentLoaded', () => {
    cargarParroquiasEnSelect();
    cargarRangosEnSelect();
    listarUsuarios();

    searchInput.addEventListener('input', filtrarUsuarios);
    filtroRol.addEventListener('change', filtrarUsuarios);    
    filtroEstado.addEventListener('change', filtrarUsuarios); 
    
    inpFoto.addEventListener('change', cargarImagen);
});

async function cargarParroquiasEnSelect() {
    try {
        const res = await fetch(API_PARROQUIAS);
        const data = await res.json();
        selParroquia.innerHTML = '<option value="">Seleccione una parroquia</option>';
        data.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_parroquia;
            opt.textContent = p.nombre_parroquia;
            selParroquia.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function cargarRangosEnSelect() {
    try {
        const res = await fetch(API_RANGOS);
        const data = await res.json();
        selRango.innerHTML = '<option value="">Seleccione un rango</option>';
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id_rango;
            opt.textContent = r.nombre_rango;
            selRango.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function listarUsuarios() {
    try {
        const res = await fetch(API_URL);
        usuariosCache = await res.json();
        renderizarGrid(usuariosCache);
    } catch (e) { console.error(e); }
}

async function guardarUsuario() {
    // VALIDACIONES SWEETALERT
    if (!inpCedula.value || !inpNombre1.value || !inpApellido1.value || !inpCorreo.value) {
        return Swal.fire('Faltan datos', 'Por favor completa los campos obligatorios.', 'warning');
    }
    if (!isEditMode && !inpPassword.value) {
        return Swal.fire('Contraseña requerida', 'Debes asignar una contraseña para usuarios nuevos.', 'warning');
    }

    const cedula = parseInt(inpCedula.value);
    const correo = inpCorreo.value.trim().toLowerCase();

    if (!isEditMode) {
        const cedulaExiste = usuariosCache.some(u => u.cedula === cedula);
        if (cedulaExiste) return Swal.fire('Duplicado', 'Ya existe un usuario con esa CÉDULA.', 'error');
    }

    const correoExiste = usuariosCache.some(u => {
        const mismoCorreo = u.correo.toLowerCase() === correo;
        if (isEditMode) return mismoCorreo && u.cedula !== cedula;
        return mismoCorreo;
    });

    if (correoExiste) return Swal.fire('Duplicado', 'Ese CORREO ya está registrado.', 'error');

    // 1. Preparar Roles
    const rolesSeleccionados = [];
    document.querySelectorAll('.rol-checkbox:checked').forEach(chk => {
        const nombreUpper = chk.value.toUpperCase();
        const idRol = ROLES_ID_MAP[nombreUpper] || null; 
        rolesSeleccionados.push({
            rol: { id_rol: idRol, nombre: chk.value }
        });
    });

    // 2. Preparar Objeto JSON
    const dataObj = {
        cedula: cedula,
        primer_nombre: inpNombre1.value,
        segundo_nombre: inpNombre2.value,
        apellido_paterno: inpApellido1.value,
        apellido_materno: inpApellido2.value,
        genero: selGenero.value,
        fecha_nacimiento: inpFecha.value,
        correo: correo,
        foto: null, 
        estado: switchEstado.checked,
        puntos_actuales: parseInt(inpPuntos.value) || 0,
        parroquia: selParroquia.value ? { id_parroquia: parseInt(selParroquia.value) } : null,
        rango: selRango.value ? { id_rango: parseInt(selRango.value) } : null,
        roles: rolesSeleccionados
    };

    if (inpPassword.value) dataObj.password = inpPassword.value;

    const formData = new FormData();
    formData.append("datos", JSON.stringify(dataObj));

    if (inpFoto.files[0]) {
        formData.append("archivo", inpFoto.files[0]);
    }

    const url = isEditMode ? `${API_URL}/${dataObj.cedula}` : API_URL;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
        const btnGuardar = document.querySelector('.btn-guardar');
        const txtOriginal = btnGuardar.innerText;
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Guardando...";

        const res = await fetch(url, {
            method: method,
            body: formData 
        });
        
        const respuesta = await res.json();

        if (res.ok) {
            if (!isEditMode && respuesta.necesita_verificacion) {
                const { value: codigo } = await Swal.fire({
                    title: 'Verificación Requerida',
                    html: `Se ha enviado un código a <b>${correo}</b>.<br>Ingrésalo para activar este usuario ahora.`,
                    input: 'text',
                    inputPlaceholder: 'CÓDIGO (Ej: A1B2C3)',
                    showCancelButton: true,
                    cancelButtonText: 'Activar luego',
                    confirmButtonText: 'Verificar y Activar',
                    confirmButtonColor: '#3A6958',
                    allowOutsideClick: false
                });

                if (codigo) {
                    const resVerif = await fetch(`${BASE_URL}/api/usuarios/verificar`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ codigo: codigo })
                    });

                    if(resVerif.ok) {
                        Swal.fire("¡Activado!", "El usuario ha sido creado y activado.", "success");
                    } else {
                        const errVerif = await resVerif.json();
                        Swal.fire("Error en código", errVerif.mensaje + "<br>El usuario quedó creado pero INACTIVO.", "warning");
                    }
                } else {
                    Swal.fire("Usuario Creado", "El usuario se creó como INACTIVO. Deberá verificar su correo.", "info");
                }
            } else {
                Swal.fire({
                    title: '¡Éxito!',
                    text: isEditMode ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            cerrarModal();
            listarUsuarios();
        } else {
            Swal.fire("Error del servidor", respuesta.mensaje || "No se pudo guardar", "error");
        }

        btnGuardar.disabled = false;
        btnGuardar.innerText = txtOriginal;

    } catch (e) { 
        console.error(e);
        Swal.fire("Error", "Error de conexión con el servidor", "error"); 
    }
}

async function eliminarUsuario(id) {
    Swal.fire({
        title: '¿Estás seguro?',
        text: "No podrás revertir esta acción.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                listarUsuarios();
                Swal.fire('Eliminado', 'El usuario ha sido eliminado.', 'success');
            } catch(e) { 
                console.error(e); 
                Swal.fire('Error', 'No se pudo eliminar el usuario.', 'error');
            }
        }
    });
}

function cargarEdicion(cedula) {
    const user = usuariosCache.find(u => u.cedula === cedula);
    if (!user) return;

    isEditMode = true;
    tituloModal.textContent = "Editar Usuario";

    inpCedula.value = user.cedula; 
    inpCedula.disabled = true; 
    
    inpNombre1.value = user.primer_nombre; inpNombre2.value = user.segundo_nombre;
    inpApellido1.value = user.apellido_paterno; inpApellido2.value = user.apellido_materno;
    inpFecha.value = user.fecha_nacimiento ? user.fecha_nacimiento.split('T')[0] : "";
    selGenero.value = user.genero; inpCorreo.value = user.correo;
    inpPuntos.value = user.puntos_actuales; switchEstado.checked = user.estado;
    inpPassword.value = ""; 

    // Visualizar foto
    let imgUrl = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    if (user.foto && user.foto.length > 5) {
        if (user.foto.startsWith('http') || user.foto.startsWith('data:')) {
            imgUrl = user.foto;
        } else {
            imgUrl = `data:image/png;base64,${user.foto}`; 
        }
    }
    imgPreview.src = imgUrl;

    selParroquia.value = user.parroquia ? (user.parroquia.id_parroquia || user.parroquia.id) : "";
    selRango.value = user.rango ? (user.rango.id_rango || user.rango.id) : "";

    const checkboxes = document.querySelectorAll('.rol-checkbox');
    checkboxes.forEach(c => c.checked = false);

    if (user.roles && Array.isArray(user.roles)) {
        checkboxes.forEach(chk => {
            const nombreCheckbox = chk.value.toUpperCase();
            const idEsperado = ROLES_ID_MAP[nombreCheckbox];

            const tieneRol = user.roles.some(ur => {
                if (!ur.rol) return false;
                if (idEsperado && (ur.rol.id_rol == idEsperado || ur.rol.id == idEsperado)) return true;
                if (ur.rol.nombre && ur.rol.nombre.toUpperCase() === nombreCheckbox) return true;
                return false;
            });

            if (tieneRol) chk.checked = true;
        });
    }

    abrirModal();
}

function renderizarGrid(lista) {
    gridUsuarios.innerHTML = '';
    if (!lista.length) { 
        gridUsuarios.innerHTML = '<p style="text-align:center;width:100%; color:#888;">No hay usuarios registrados.</p>'; 
        return; 
    }

    lista.forEach(u => {
        let img = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        if (u.foto && u.foto.length > 5) {
             if (u.foto.startsWith('http') || u.foto.startsWith('data:')) {
                 img = u.foto;
             } else {
                 img = `data:image/png;base64,${u.foto}`;
             }
        }
        
        const rolesTxt = (u.roles && u.roles.length) 
            ? u.roles.map(r => r.rol ? r.rol.nombre : '').join(', ') 
            : 'Sin rol';

        const estadoClass = u.estado ? 'activo' : 'inactivo';
        const estadoTexto = u.estado ? 'Activo' : 'Inactivo';
        const colorEstado = u.estado ? '#2ecc71' : '#e74c3c';

        const div = document.createElement('div');
        div.className = 'card-usuario';
        div.innerHTML = `
            <img src="${img}" class="img-user-card" 
                 style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 10px;"
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
            <h3 style="text-align:center;">${u.primer_nombre} ${u.apellido_paterno}</h3>
            <p style="text-align:center;font-size:0.9rem;color:#666;"><i class="fa-solid fa-envelope"></i> ${u.correo}</p>
            <div class="usuario-info" style="margin-top:10px;">
                <span><i class="fa-solid fa-map-pin"></i> ${u.parroquia ? (u.parroquia.nombre_parroquia || u.parroquia.nombre) : 'Sin Parroquia'}</span>
                <span><i class="fa-solid fa-medal"></i> ${u.rango ? (u.rango.nombre_rango || u.rango.nombre) : 'Sin Rango'}</span>
            </div>
            <div style="font-size:12px; color:#555; margin-top:5px; text-align:center;"><strong>Roles:</strong> ${rolesTxt}</div>
            <div style="text-align:center;margin-top:5px;color:${colorEstado};font-weight:600;">● ${estadoTexto}</div>
            <div class="usuario-botones" style="display:flex;gap:10px;justify-content:center;margin-top:15px;">
                <button class="btn-editar" onclick="cargarEdicion(${u.cedula})" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-eliminar" onclick="eliminarUsuario(${u.cedula})" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        gridUsuarios.appendChild(div);
    });
}

function filtrarUsuarios() {
    const texto = searchInput.value.toLowerCase();
    const rolSeleccionado = filtroRol.value;
    const estadoSeleccionado = filtroEstado.value;

    const filtrados = usuariosCache.filter(u => {
        const coincideTexto = 
            u.primer_nombre.toLowerCase().includes(texto) || 
            u.apellido_paterno.toLowerCase().includes(texto) ||
            u.cedula.toString().includes(texto) ||
            u.correo.toLowerCase().includes(texto);

        let coincideRol = true;
        if (rolSeleccionado !== "todos") {
            coincideRol = u.roles.some(ur => {
                const nombreRol = ur.rol ? ur.rol.nombre.toUpperCase() : "";
                return nombreRol === rolSeleccionado || nombreRol.includes(rolSeleccionado);
            });
        }

        let coincideEstado = true;
        if (estadoSeleccionado !== "todos") {
            const esActivo = u.estado === true;
            if (estadoSeleccionado === "activo" && !esActivo) coincideEstado = false;
            if (estadoSeleccionado === "inactivo" && esActivo) coincideEstado = false;
        }

        return coincideTexto && coincideRol && coincideEstado;
    });

    renderizarGrid(filtrados);
}

function abrirModalNuevo() { 
    isEditMode = false; 
    tituloModal.textContent = "Nuevo Usuario"; 
    formReset(); 
    abrirModal(); 
}
function abrirModal() { modalOverlay.style.display = 'flex'; }
function cerrarModal() { modalOverlay.style.display = 'none'; }

function formReset() {
    inpCedula.value = ""; 
    inpCedula.disabled = false; 
    inpNombre1.value = ""; inpNombre2.value = "";
    inpApellido1.value = ""; inpApellido2.value = ""; inpFecha.value = ""; selGenero.value = "";
    inpCorreo.value = ""; inpPassword.value = ""; selParroquia.value = ""; selRango.value = "";
    inpPuntos.value = ""; switchEstado.checked = true; 
    imgPreview.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
    inpFoto.value = ""; 
    document.querySelectorAll('.rol-checkbox').forEach(c => c.checked = false);
}

function cargarImagen() {
    const f = inpFoto.files[0];
    if(f) { 
        if(!f.type.startsWith('image/')) {
            Swal.fire('Error', 'Solo se permiten imágenes', 'error');
            inpFoto.value = "";
            return;
        }
        const r = new FileReader(); 
        r.onload = e => imgPreview.src = e.target.result; 
        r.readAsDataURL(f); 
    }
}