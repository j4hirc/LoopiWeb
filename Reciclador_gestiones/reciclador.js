const API_BASE = 'https://api-loopi.onrender.com/api';

let usuario;
let map;
let recyclingLayer;
let todasLasUbicaciones = [];
let marcadorMiUbicacion = null;
let ubicacionActual = null;
let miPuntoData = null;
let fotoNuevaFile = null;
let fotoPuntoFile = null;
let mapaEdicion = null;
let markerEdicion = null;

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

let cacheUbicaciones = null;

async function obtenerUbicaciones() {
    if (cacheUbicaciones) return cacheUbicaciones;

    const res = await fetch(`${API_BASE}/ubicacion_reciclajes`);
    if (!res.ok) throw new Error("Error ubicaciones");

    cacheUbicaciones = await res.json();
    return cacheUbicaciones;
}



document.addEventListener("DOMContentLoaded", async () => {
    const userStr = localStorage.getItem("usuario");
    if (!userStr) return redirigirLogin();

    usuario = JSON.parse(userStr);

    if (getRolId(usuario.rol_seleccionado) !== 2) return redirigirLogin();

    actualizarSaludoUI();
    refrescarDatosUsuario();
    identificarMiPunto();

    document.getElementById("btnAbrirPerfil").onclick = abrirPerfil;
    document.getElementById("btnCerrarSesion").onclick = cerrarSesion;

    const inputFoto = document.getElementById("inputPerfilFoto");
    if (inputFoto) inputFoto.addEventListener("change", previsualizarFoto);

    const btnUbicacion = document.getElementById("btnMiUbicacion");
    if (btnUbicacion) btnUbicacion.onclick = obtenerUbicacionActual;

    initMapaReciclador();

    Promise.all([
        cargarFiltrosMateriales(),
        cargarPuntosReciclajeReciclador()
    ]);

    setTimeout(() => {
        cargarNotificacionesReciclador();
        setInterval(cargarNotificacionesReciclador, 15000);
    }, 3000);
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
        todasLasUbicaciones = await obtenerUbicaciones();
        renderizarPuntosReciclador(todasLasUbicaciones);
    } catch (e) {
        console.error(e);
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
    if (document.getElementById("inputPerfilFoto")) document.getElementById("inputPerfilFoto").value = "";

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
        if (s.detalles) {
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
                        label: function (context) {
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






async function identificarMiPunto() {
    try {
        const todos = await obtenerUbicaciones();
        miPuntoData = todos.find(p =>
            p.reciclador?.cedula == usuario.cedula
        );
    } catch (e) {
        console.error(e);
    }
}


async function abrirModalMiPunto() {
    fotoPuntoFile = null;

    if (mapaEdicion) {
        mapaEdicion.remove();
        mapaEdicion = null;
        markerEdicion = null;
    }

    if (!miPuntoData) {
        await identificarMiPunto();
    }

    if (!miPuntoData) {
        Swal.fire("Sin Punto", "No tienes un punto asignado. Contacta al soporte.", "info");
        return;
    }

    Swal.fire({ title: "Cargando datos...", didOpen: () => Swal.showLoading() });

    try {
        const idUbicacion = miPuntoData.id_ubicacion_reciclaje;


        const [resDetalles, _parroquias, _materiales] = await Promise.all([
            fetch(`${API_BASE}/ubicacion_reciclajes/${idUbicacion}`),
            cargarListadoParroquias(),
            renderizarMaterialesEdicion()
        ]);

        if (resDetalles.ok) {
            miPuntoData = await resDetalles.json();
        }

    } catch (e) {
        console.error("Error cargando datos del modal:", e);
    }

    document.getElementById("txtPuntoNombre").value = miPuntoData.nombre || "";
    document.getElementById("txtPuntoDireccion").value = miPuntoData.direccion || "";
    document.getElementById("txtLatitud").value = miPuntoData.latitud || "";
    document.getElementById("txtLongitud").value = miPuntoData.longitud || "";

    if (miPuntoData.parroquia) {
        const idParroquia = (typeof miPuntoData.parroquia === 'object') ?
            (miPuntoData.parroquia.id_parroquia || miPuntoData.parroquia.id) :
            miPuntoData.parroquia;
        document.getElementById("txtPuntoParroquia").value = idParroquia || "";
    }

    const imgPreview = document.getElementById("previewPuntoFoto");
    if (miPuntoData.foto) {
        imgPreview.src = miPuntoData.foto;
        imgPreview.style.display = "block";
    } else {
        imgPreview.style.display = "none";
    }

    renderizarHorariosEdicion();

    Swal.close();
    document.getElementById("modalMiPunto").style.display = "flex";

    setTimeout(() => {
        initMapaEdicion(miPuntoData.latitud, miPuntoData.longitud);
    }, 400);

    const inputFoto = document.getElementById("filePuntoFoto");
    const nuevoInput = inputFoto.cloneNode(true);
    inputFoto.parentNode.replaceChild(nuevoInput, inputFoto);

    nuevoInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            fotoPuntoFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                imgPreview.src = ev.target.result;
                imgPreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    });
}


function cerrarModalMiPunto() {
    document.getElementById("modalMiPunto").style.display = "none";
    if (mapaEdicion) {
        mapaEdicion.remove();
        mapaEdicion = null;
        markerEdicion = null;
    }
}



function initMapaEdicion(lat, lng) {
    if (!lat || !lng) {
        lat = -2.9001;
        lng = -79.0059;
    }

    const container = document.getElementById("mapaEdicionContainer");
    if (!container) return;

    if (mapaEdicion) {
        mapaEdicion.remove();
        mapaEdicion = null;
        markerEdicion = null;
    }

    mapaEdicion = L.map(container, {
        maxBounds: CUENCA_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: 12
    }).setView([lat, lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(mapaEdicion);

    mapaEdicion.on('click', function (e) {
        colocarMarcadorEdicion(e.latlng.lat, e.latlng.lng);
    });

    colocarMarcadorEdicion(lat, lng);

    setTimeout(() => {
        if (mapaEdicion) {
            mapaEdicion.invalidateSize();
            mapaEdicion.panTo([lat, lng]);
        }
    }, 200);
}


function colocarMarcadorEdicion(lat, lng) {
    if (!mapaEdicion) return;

    if (markerEdicion) {
        markerEdicion.setLatLng([lat, lng]);
    } else {
        markerEdicion = L.marker([lat, lng], { draggable: true }).addTo(mapaEdicion);

        markerEdicion.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            document.getElementById("txtLatitud").value = pos.lat.toFixed(6);
            document.getElementById("txtLongitud").value = pos.lng.toFixed(6);
        });
    }

    document.getElementById("txtLatitud").value = parseFloat(lat).toFixed(6);
    document.getElementById("txtLongitud").value = parseFloat(lng).toFixed(6);
}

async function renderizarMaterialesEdicion() {
    const container = document.getElementById("containerMaterialesCheck");
    container.innerHTML = "Cargando...";

    try {
        const res = await fetch(`${API_BASE}/materiales`);
        const todosMateriales = await res.json();

        container.innerHTML = "";

        const idsMisMateriales = new Set();
        if (miPuntoData.materialesAceptados) {
            miPuntoData.materialesAceptados.forEach(um => {
                if (um.material) idsMisMateriales.add(um.material.id_material);
            });
        }

        todosMateriales.forEach(mat => {
            const checked = idsMisMateriales.has(mat.id_material) ? "checked" : "";
            const div = document.createElement("div");
            div.className = "material-check-item";
            div.innerHTML = `
                <input type="checkbox" id="mat_${mat.id_material}" value="${mat.id_material}" ${checked}>
                <label for="mat_${mat.id_material}">${mat.nombre}</label>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = "Error cargando materiales.";
    }
}

function normalizarDia(texto) {
    if (!texto) return "";
    return texto.toString()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function formatearDiaBonito(diaDb) {
    if (!diaDb) return "";
    const diaLimpio = diaDb.toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const mapa = {
        "lunes": "Lunes",
        "martes": "Martes",
        "miercoles": "Miércoles",
        "jueves": "Jueves",
        "viernes": "Viernes",
        "sabado": "Sábado",
        "domingo": "Domingo"
    };

    return mapa[diaLimpio] || diaDb;
}

function renderizarHorariosEdicion() {
    const lista = document.getElementById("listaHorarios");
    lista.innerHTML = "";

    const horarios = miPuntoData.horarios || [];

    if (horarios.length === 0) {
        agregarFilaHorario();
    } else {
        const ordenDias = {
            "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6, "Domingo": 7
        };

        horarios.sort((a, b) => {
            const da = formatearDiaBonito(a.dia_semana);
            const db = formatearDiaBonito(b.dia_semana);
            return (ordenDias[da] || 99) - (ordenDias[db] || 99);
        });

        horarios.forEach(h => {
            const inicio = h.hora_inicio || h.hora_apertura || "";
            const cierre = h.hora_fin || h.hora_cierre || "";
            agregarFilaHorario(h.dia_semana, inicio, cierre);
        });
    }
}

function agregarFilaHorario(dia = null, inicio = "08:00", fin = "18:00") {
    const lista = document.getElementById("listaHorarios");

    const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    const selectsExistentes = lista.querySelectorAll(".input-dia");
    const diasUsados = Array.from(selectsExistentes).map(s => normalizarDia(s.value));

    let diaSugerido = dia;
    if (!dia) {
        const diaLibre = diasSemana.find(d => !diasUsados.includes(normalizarDia(d)));
        if (!diaLibre) {
            Swal.fire("Semana Completa", "Ya has agregado todos los días de la semana.", "info");
            return; // No agrega nada si ya están los 7
        }
        diaSugerido = diaLibre;
    }

    const div = document.createElement("div");
    div.className = "horario-row";

    const diaNormalizado = normalizarDia(diaSugerido);

    let options = `<option value="">Seleccione día</option>`;

    diasSemana.forEach(d => {
        const opcNormalizada = normalizarDia(d);
        const selected = (opcNormalizada === diaNormalizado) ? "selected" : "";

        options += `<option value="${d}" ${selected}>${d}</option>`;
    });

    const horaIniFmt = (inicio && inicio.length >= 5) ? inicio.substring(0, 5) : "08:00";
    const horaFinFmt = (fin && fin.length >= 5) ? fin.substring(0, 5) : "18:00";

    div.innerHTML = `
        <select class="input-dia">${options}</select>
        <input type="time" class="input-inicio" value="${horaIniFmt}">
        <span>a</span>
        <input type="time" class="input-fin" value="${horaFinFmt}">
        <button class="btn-del-horario" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    lista.appendChild(div);
}

async function guardarCambiosPunto() {
    const filasHorario = document.querySelectorAll(".horario-row");
    if (filasHorario.length === 0) return Swal.fire("Error", "Debe registrar al menos un horario.", "warning");

    const listaHorariosEnvio = [];
    const diasUsados = new Set();
    let errorHorario = null;

    filasHorario.forEach((fila) => {
        const dia = fila.querySelector(".input-dia").value;
        let inicio = fila.querySelector(".input-inicio").value;
        let fin = fila.querySelector(".input-fin").value;

        if (!dia || !inicio || !fin) {
            errorHorario = "Complete todos los campos de horarios.";
            return;
        }
        if (diasUsados.has(dia)) {
            errorHorario = `El día ${dia} está repetido.`;
            return;
        }
        diasUsados.add(dia);

        if (inicio.length === 5) inicio += ":00";
        if (fin.length === 5) fin += ":00";

        listaHorariosEnvio.push({
            dia_semana: dia,
            hora_inicio: inicio,
            hora_fin: fin
        });
    });

    if (errorHorario) return Swal.fire("Error en Horarios", errorHorario, "warning");

    const checks = document.querySelectorAll("#containerMaterialesCheck input[type='checkbox']:checked");
    if (checks.length === 0) return Swal.fire("Atención", "Selecciona al menos un material.", "warning");

    const materialesEnvio = Array.from(checks).map(c => ({
        material: {
            id_material: parseInt(c.value)
        }
    }));

    const nombre = document.getElementById("txtPuntoNombre").value.trim();
    const idParroquia = document.getElementById("txtPuntoParroquia").value;
    const direccion = document.getElementById("txtPuntoDireccion").value.trim();
    const lat = document.getElementById("txtLatitud").value;
    const lng = document.getElementById("txtLongitud").value;

    if (!nombre || !idParroquia || !direccion) return Swal.fire("Campos vacíos", "Faltan datos obligatorios.", "warning");

    const objetoUpdate = {
        id_ubicacion_reciclaje: miPuntoData.id_ubicacion_reciclaje,
        nombre: nombre,
        parroquia: {
            id_parroquia: parseInt(idParroquia)
        },
        direccion: direccion,
        latitud: parseFloat(lat),
        longitud: parseFloat(lng),
        reciclador: {
            cedula: usuario.cedula
        },
        horarios: listaHorariosEnvio,
        materialesAceptados: materialesEnvio
    };

    console.log("Enviando actualización:", objetoUpdate);

    const formData = new FormData();
    formData.append("datos", JSON.stringify(objetoUpdate));

    if (fotoPuntoFile) formData.append("archivo", fotoPuntoFile);

    try {
        Swal.fire({
            title: "Guardando...",
            didOpen: () => Swal.showLoading()
        });
        const res = await fetch(`${API_BASE}/ubicacion_reciclajes/${miPuntoData.id_ubicacion_reciclaje}`, {
            method: "PUT",
            body: formData
        });

        if (res.ok) {
            const dataNueva = await res.json();
            miPuntoData = dataNueva;
            cerrarModalMiPunto();
            Swal.fire("Éxito", "Punto actualizado.", "success");
            cargarPuntosReciclajeReciclador();
        } else {
            const err = await res.text();
            console.error("Error backend:", err);
            Swal.fire("Error al Guardar", "El servidor rechazó los datos: " + err, "error");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Error de Conexión", "No se pudo conectar con el servidor.", "error");
    }
}

function actualizarPosicionMarker(latlng) {
    if (!mapaEdicion) return;

    if (markerEdicion) {
        markerEdicion.setLatLng(latlng);
    } else {
        markerEdicion = L.marker(latlng, {
            draggable: true
        }).addTo(mapaEdicion);

        markerEdicion.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            document.getElementById("txtLatitud").value = pos.lat.toFixed(6);
            document.getElementById("txtLongitud").value = pos.lng.toFixed(6);
        });
    }
    document.getElementById("txtLatitud").value = parseFloat(latlng.lat).toFixed(6);
    document.getElementById("txtLongitud").value = parseFloat(latlng.lng).toFixed(6);
}
async function cargarListadoParroquias() {
    const select = document.getElementById("txtPuntoParroquia");
    select.innerHTML = '<option value="">Cargando...</option>';

    try {
        const res = await fetch(`${API_BASE}/parroquias`);
        if (res.ok) {
            const parroquias = await res.json();
            select.innerHTML = '<option value="">Seleccione Parroquia</option>';
            parroquias.forEach(p => {
                const id = p.id_parroquia || p.id;
                const nombre = p.nombre_parroquia || p.nombre;
                const opt = document.createElement("option");
                opt.value = id;
                opt.text = nombre;
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="">Error cargando</option>';
        }
    } catch (e) {
        console.error("Error:", e);
        select.innerHTML = '<option value="">Error conexión</option>';
    }
}