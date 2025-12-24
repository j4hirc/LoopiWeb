const API_URL = 'https://api-loopi.onrender.com/api';

document.addEventListener("DOMContentLoaded", async () => {
    cargarParroquias();
    setupUIEvents();
});

function setupUIEvents() {
    const container = document.querySelector(".container");
    const btnIrRegistro = document.getElementById("btn-ir-registro");
    const btnIrLogin = document.getElementById("btn-ir-login");

    if (btnIrRegistro && btnIrLogin && container) {
        btnIrRegistro.addEventListener("click", () => container.classList.add("active"));
        btnIrLogin.addEventListener("click", () => container.classList.remove("active"));
    }

    document.querySelectorAll(".toggle-pass").forEach((icon) => {
        icon.addEventListener("click", () => {
            const input = icon.previousElementSibling;
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            icon.classList.toggle("fa-eye");
            icon.classList.toggle("fa-eye-slash");
        });
    });

    document.getElementById("file-upload")?.addEventListener("change", function () {
        const file = this.files[0];
        if (!file) return;
        window.avatarImageFile = file; // Guardamos el archivo real
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById("avatar-preview");
            if(img) {
                img.style.display = "block";
                img.src = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    });
}

async function cargarParroquias() {
    const select = document.getElementById("registro-parroquia");
    if (!select) return;
    try {
        const res = await fetch(`${API_URL}/parroquias`);
        if(res.ok) {
            const parroquias = await res.json();
            select.innerHTML = '<option value="" disabled selected>Seleccione</option>';
            parroquias.forEach(p => {
                const id = p.id_parroquia || p.id;
                const nombre = p.nombre_parroquia || p.nombre;
                select.innerHTML += `<option value="${id}">${nombre}</option>`;
            });
        }
    } catch (e) { console.error("Error parroquias:", e); }
}

// LOGIN (Este se queda igual porque login no sube fotos)
document.getElementById("form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!correo || !password) return Swal.fire("Atención", "Campos obligatorios", "warning");

    try {
        Swal.fire({ title: 'Iniciando...', didOpen: () => Swal.showLoading() });
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, password })
        });
        const data = await res.json();

        if (!res.ok) return Swal.fire("Error", data.mensaje || "Error de acceso", "error");

        const resRoles = await fetch(`${API_URL}/usuario_rol/usuario/${data.cedula}`);
        const roles = await resRoles.json();

        if (!roles || roles.length === 0) return Swal.fire("Error", "Usuario sin roles asignados", "warning");

        if (roles.length === 1) {
            redirigirUsuario(extraerRol(roles[0]), data);
        } else {
            window.usuarioTemp = data;
            window.rolesTemp = roles;
            elegirRol(roles);
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "Fallo de conexión con el servidor", "error");
    }
});

document.getElementById("form-registro")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("registro-email").value.trim();
    
    if (!validarEmail(email)) return Swal.fire("Error", "Formato de correo inválido", "error");

    const cedula = document.getElementById("cedula").value.trim();
    const pass1 = document.getElementById("registro-password").value;
    const pass2 = document.getElementById("registro-password-confirm").value;
    const fechaNac = document.getElementById("registro-fecha-nacimiento").value;
    const parroquiaId = document.getElementById("registro-parroquia").value;

    if (!validarCedulaEcuatoriana(cedula)) return Swal.fire("Error", "Cédula inválida", "error");
    if (pass1 !== pass2) return Swal.fire("Error", "Las contraseñas no coinciden", "error");
    if (!esMayorDeEdad(fechaNac)) return Swal.fire("Error", "Debes ser mayor de 12 años", "warning");
    if (!parroquiaId) return Swal.fire("Atención", "Selecciona una parroquia", "warning");

    const usuarioObj = {
        cedula: parseInt(cedula),
        primer_nombre: document.getElementById("registro-nombre1").value.trim(),
        segundo_nombre: document.getElementById("registro-nombre2").value.trim(),
        apellido_paterno: document.getElementById("registro-apellido1").value.trim(),
        apellido_materno: document.getElementById("registro-apellido2").value.trim(),
        correo: email,
        fecha_nacimiento: fechaNac,
        genero: document.getElementById("registro-genero").value,
        password: pass1,
        puntos_actuales: 0,
        estado: false,
        foto: null, 
        parroquia: { id_parroquia: parseInt(parroquiaId) },
        rango: { id_rango: 1 }, 
        roles: [ { rol: { id_rol: 3 } } ]
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(usuarioObj)); // JSON convertido a texto

    if (window.avatarImageFile) {
        formData.append("archivo", window.avatarImageFile);
    }

    try {
        Swal.fire({ 
            title: 'Creando cuenta...', 
            text: 'Enviaremos un código a tu correo.',
            didOpen: () => Swal.showLoading() 
        });

        const res = await fetch(`${API_URL}/usuarios`, {
            method: "POST",
            body: formData, 
        });
        const data = await res.json();

        if (!res.ok) return Swal.fire("Error", data.mensaje || "Error al registrar", "error");

        if (data.necesita_verificacion) {
            
            const { value: codigo } = await Swal.fire({
                title: '📧 Verifica tu correo',
                html: `Hemos enviado un código a <b>${email}</b>.<br>Ingrésalo para activar tu cuenta.`,
                input: 'text',
                inputPlaceholder: 'CÓDIGO (Ej: A1B2C3)',
                confirmButtonText: 'Activar Cuenta',
                confirmButtonColor: '#3A6958',
                allowOutsideClick: false,
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                },
                inputValidator: (value) => {
                    if (!value) return '¡Necesitas escribir el código!'
                }
            });

            if (codigo) {
                Swal.fire({ title: 'Verificando...', didOpen: () => Swal.showLoading() });
                
                const resVerif = await fetch(`${API_URL}/usuarios/verificar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codigo: codigo })
                });
                
                const dataVerif = await resVerif.json();

                if (resVerif.ok) {
                    Swal.fire("¡Cuenta Activada!", "Ahora puedes iniciar sesión.", "success")
                        .then(() => {
                            const btnLogin = document.getElementById("btn-ir-login");
                            if(btnLogin) btnLogin.click();
                            else location.reload();
                        });
                } else {
                    Swal.fire("Código Incorrecto", dataVerif.mensaje, "error");
                }
            }
        } else {
            Swal.fire("¡Éxito!", "Cuenta creada.", "success");
        }

    } catch (e) { 
        console.error(e);
        Swal.fire("Error", "Fallo de conexión", "error"); 
    }
});


window.abrirModalRecuperar = function() {
    Swal.fire({
        title: 'Recuperar Contraseña',
        input: 'email',
        inputLabel: 'Ingresa tu correo registrado',
        inputPlaceholder: 'tu@correo.com',
        showCancelButton: true,
        confirmButtonText: 'Enviar Código',
        confirmButtonColor: '#3A6958',
        showLoaderOnConfirm: true,
        preConfirm: (email) => {
            return fetch(`${API_URL}/recuperar-password/solicitar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo: email })
            })
            .then(response => {
                if (!response.ok) throw new Error(response.statusText)
                return response.json()
            })
            .catch(error => {
                Swal.showValidationMessage(`Falló la solicitud: ${error}`)
            })
        },
        allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Código Enviado',
                text: 'Revisa tu correo para ver el código.',
                icon: 'success'
            }).then(() => {
                pedirNuevoPassword(result.value.correo || result.value);
            });
        }
    })
};

function pedirNuevoPassword(correo) {
    Swal.fire({
        title: 'Cambiar Contraseña',
        html:
            '<input id="swal-token" class="swal2-input" placeholder="Código recibido">' +
            '<input id="swal-pass" type="password" class="swal2-input" placeholder="Nueva contraseña">',
        focusConfirm: false,
        confirmButtonText: 'Cambiar',
        confirmButtonColor: '#3A6958',
        preConfirm: () => {
            const token = document.getElementById('swal-token').value;
            const pass = document.getElementById('swal-pass').value;
            if (!token || !pass) Swal.showValidationMessage('Ingresa ambos campos');
            return { token: token, pass: pass };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            cambiarPasswordBackend(correo, result.value.token, result.value.pass);
        }
    });
}

async function cambiarPasswordBackend(correo, token, nuevaPass) {
    try {
        const res = await fetch(`${API_URL}/recuperar-password/validar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, nuevaPassword: nuevaPass })
        });
        const data = await res.json();
        if(res.ok) Swal.fire("Éxito", "Contraseña actualizada", "success");
        else Swal.fire("Error", data.mensaje, "error");
    } catch(e) { Swal.fire("Error", "No se pudo actualizar", "error"); }
}

function extraerRol(r) {
    if (r.rol && r.rol.id_rol) return r.rol;
    if (r.id_rol) return r;
    return null;
}

function redirigirUsuario(rolObj, usuario) {
    localStorage.removeItem("usuario");

    const rolesLigeros = (usuario.roles || []).map(r => {
        const info = r.rol || r;
        return { 
            id_rol: info.id_rol, 
            nombre: info.nombre 
        };
    });

    const usuarioSesion = {
        cedula: usuario.cedula,
        primer_nombre: usuario.primer_nombre, 
        apellido: usuario.apellido_paterno,
        correo: usuario.correo,
        id_parroquia: usuario.parroquia ? (usuario.parroquia.id_parroquia || usuario.parroquia.id) : null,
        
        // Foto: Si ya viene el link de Supabase, lo guardamos.
        foto: usuario.foto, 
        
        rol_seleccionado: { 
            id_rol: rolObj.id_rol, 
            nombre: rolObj.nombre 
        },
        roles: rolesLigeros
    };

    try {
        localStorage.setItem("usuario", JSON.stringify(usuarioSesion));

        Swal.fire({
            icon: "success", 
            title: "Bienvenido", 
            text: `Ingresando como ${rolObj.nombre}...`,
            showConfirmButton: false, 
            timer: 1500
        }).then(() => {
            if (rolObj.id_rol == 1) window.location.href = "../Administrador_gestiones/menu-gestiones.html";
            else if (rolObj.id_rol == 2) window.location.href = "../Reciclador_gestiones/reciclador.html";
            else window.location.href = "../Usuario_normal/inicio_usuario_normal.html";
        });

    } catch (e) {
        console.error("QuotaExceededError:", e);
        localStorage.clear(); 
        Swal.fire("Aviso", "Memoria llena. Se ha limpiado el caché. Intenta ingresar de nuevo.", "warning");
    }
}

function elegirRol(roles) {
    const rolesFinales = roles.map(r => extraerRol(r)).filter(r => r !== null);
    Swal.fire({
        title: 'Selecciona tu perfil',
        html: `<div style="display: flex; flex-direction: column; gap: 10px;">
                ${rolesFinales.map(r => 
                    `<div onclick="window.seleccionarRol(${r.id_rol})" 
                          style="padding: 15px; border: 2px solid #ddd; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 15px; transition: 0.3s;">
                        <i class="fa-solid fa-user-tag" style="font-size: 24px; color: #4CAF50;"></i>
                        <span style="font-size: 18px; font-weight: bold; color: #333;">${r.nombre}</span>
                    </div>`).join("")}
               </div>`,
        showConfirmButton: false,
        allowOutsideClick: false
    });
}

window.seleccionarRol = function(idRol) {
    const rolObj = window.rolesTemp.map(r => extraerRol(r)).find(r => r.id_rol == idRol);
    if(rolObj) { Swal.close(); redirigirUsuario(rolObj, window.usuarioTemp); }
};

function validarCedulaEcuatoriana(cedula) {
    if (cedula.length !== 10) return false;
    const digitoRegion = parseInt(cedula.substring(0, 2));
    if (digitoRegion < 1 || digitoRegion > 24) return false;
    const ultimoDigito = parseInt(cedula.substring(9, 10));
    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let valor = parseInt(cedula.charAt(i)) * (i % 2 === 0 ? 2 : 1);
        if (valor > 9) valor -= 9;
        suma += valor;
    }
    const digitoValidador = (Math.ceil(suma / 10) * 10) - suma;
    return (digitoValidador === 10 ? 0 : digitoValidador) === ultimoDigito;
}

function esMayorDeEdad(fecha) {
    const hoy = new Date();
    const cumple = new Date(fecha);
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
    return edad >= 12;
}

function validarEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}