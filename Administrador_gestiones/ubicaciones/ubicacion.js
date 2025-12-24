const API_URL = 'https://api-loopi.onrender.com/api/ubicacion_reciclajes';
const API_PARROQUIAS = 'https://api-loopi.onrender.com/api/parroquias';
const API_RECICLADORES = 'https://api-loopi.onrender.com/api/usuarios/recicladores';
const API_MATERIALES = 'https://api-loopi.onrender.com/api/materiales';

const gridUbicaciones = document.getElementById("gridUbicaciones");
const searchInput = document.getElementById("buscarUbicacion");
const modalOverlay = document.getElementById("modalOverlay");     
const modalMapa = document.getElementById("modalMapa");           

const inputImagen = document.getElementById("inputImg");
const previewImagen = document.getElementById("previewImg");
const selectParroquia = document.getElementById("parroquia");
const selectReciclador = document.getElementById("selectReciclador");

let ubicacionesCache = [];
let map = null;
let marker;
let coordenadasSeleccionadas = null; 
let coordenadasTemporales = null;    

let fotoNuevaFile = null;

document.addEventListener("DOMContentLoaded", () => {
    cargarParroquias();
    cargarRecicladores();
    cargarMateriales();
    listarUbicaciones();

    inputImagen.addEventListener("change", procesarImagen);

    searchInput.addEventListener("input", (e) => {
        const termino = e.target.value.toLowerCase();
        const filtrados = ubicacionesCache.filter(u =>
            u.nombre.toLowerCase().includes(termino) ||
            u.direccion.toLowerCase().includes(termino)
        );
        renderizarGrid(filtrados);
    });
});

function abrirModal() {
    resetearFormulario();
    document.getElementById("tituloModal").innerText = "Nueva Ubicación";
    modalOverlay.style.display = "flex";
}

async function cargarMateriales() {
    const container = document.getElementById("containerMateriales");
    try {
        const res = await fetch(API_MATERIALES);
        const materiales = await res.json();
        
        container.innerHTML = ""; 

        materiales.forEach(mat => {
            const div = document.createElement("div");
            div.className = "material-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "materiales";
            checkbox.value = mat.id_material;
            checkbox.id = `mat-${mat.id_material}`;

            const label = document.createElement("label");
            label.htmlFor = `mat-${mat.id_material}`;
            label.innerText = mat.nombre;

            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
    } catch (e) {
        console.error("Error cargando materiales:", e);
        container.innerHTML = "<p style='color:red'>Error al cargar materiales</p>";
    }
}

window.cargarDatosEdicion = async function (id) {
    const ubi = ubicacionesCache.find(u => u.id_ubicacion_reciclaje == id);
    if (!ubi) {
        console.error("No se encontró la ubicación con ID:", id);
        return;
    }
    resetearFormulario();
    document.getElementById("tituloModal").innerText = "Editar Ubicación";

    document.getElementById("idUbicacion").value = ubi.id_ubicacion_reciclaje;
    document.getElementById("nombrePunto").value = ubi.nombre || "";
    document.getElementById("direccion").value = ubi.direccion || "";

    if (selectParroquia.options.length <= 1) await cargarParroquias();
    if (selectReciclador.options.length <= 1) await cargarRecicladores();

    if (ubi.parroquia) {
        selectParroquia.value = ubi.parroquia.id_parroquia;
    }

    if (ubi.reciclador && ubi.reciclador.cedula) {
        selectReciclador.value = ubi.reciclador.cedula.toString();
    } else {
        selectReciclador.value = "";
    }

    if (ubi.materialesAceptados && ubi.materialesAceptados.length > 0) {
        ubi.materialesAceptados.forEach(item => {
            if (item.material) {
                const cb = document.getElementById(`mat-${item.material.id_material}`);
                if (cb) cb.checked = true;
            }
        });
    }

    if (ubi.latitud && ubi.longitud) {
        coordenadasSeleccionadas = { lat: ubi.latitud, lng: ubi.longitud };
        actualizarTextoCoords(ubi.latitud, ubi.longitud);
    }

    if (ubi.foto && ubi.foto.length > 5) {
        let fotoSrc = ubi.foto;
        if (!fotoSrc.startsWith("http") && !fotoSrc.startsWith("data:")) {
             fotoSrc = `data:image/png;base64,${ubi.foto}`;
        }
        previewImagen.style.backgroundImage = `url(${fotoSrc})`;
    }

    modalOverlay.style.display = "flex";
};

function cerrarModal() {
    modalOverlay.style.display = "none";
}

function resetearFormulario() {
    document.getElementById("idUbicacion").value = "";
    document.getElementById("nombrePunto").value = "";
    document.getElementById("direccion").value = "";
    selectParroquia.value = "";
    selectReciclador.value = "";
    
    fotoNuevaFile = null;
    inputImagen.value = "";
    previewImagen.style.backgroundImage = "none";
    
    const checkboxes = document.querySelectorAll('input[name="materiales"]');
    checkboxes.forEach(cb => cb.checked = false);

    coordenadasSeleccionadas = null;
    coordenadasTemporales = null;
    actualizarTextoCoords(0.0, 0.0);
}

function actualizarTextoCoords(lat, lng) {
    document.getElementById("txtLat").innerText = lat.toFixed(6);
    document.getElementById("txtLng").innerText = lng.toFixed(6);
}


window.abrirModalMapa = function () {
    modalMapa.style.display = "flex";

    setTimeout(() => {
        iniciarMapa();
        map.invalidateSize(); 

        if (coordenadasSeleccionadas) {
            colocarMarcador(coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng);
            map.setView([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], 15);
        } else {
            map.setView([-2.9001, -79.0059], 13);
            if (marker) map.removeLayer(marker); 
        }
    }, 300);
}

window.cerrarModalMapa = function () {
    modalMapa.style.display = "none";
}

window.confirmarCoordenadas = function () {
    if (coordenadasTemporales) {
        coordenadasSeleccionadas = coordenadasTemporales;
        actualizarTextoCoords(coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng);
        cerrarModalMapa();
    } else {
        alert("Por favor, haz clic en el mapa para marcar un punto.");
    }
}

function iniciarMapa() {
    if (map) return; 

    map = L.map('mapaLeaflet').setView([-2.9001, -79.0059], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', function (e) {
        colocarMarcador(e.latlng.lat, e.latlng.lng);
    });
}

function colocarMarcador(lat, lng) {
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
    coordenadasTemporales = { lat: lat, lng: lng };
}


async function cargarParroquias() {
    try {
        const res = await fetch(API_PARROQUIAS);
        const data = await res.json();
        selectParroquia.innerHTML = '<option value="">Seleccione...</option>';
        data.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id_parroquia;
            opt.textContent = p.nombre_parroquia;
            selectParroquia.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function cargarRecicladores() {
    try {
        const res = await fetch(API_RECICLADORES);
        const data = await res.json();
        
        selectReciclador.innerHTML = '<option value="">Ninguno (Sin asignar)</option>';

        if (Array.isArray(data)) {
            data.forEach(r => {
                const opt = document.createElement("option");
                opt.value = r.cedula.toString(); 
                opt.textContent = `${r.primer_nombre} ${r.apellido_paterno}`;
                selectReciclador.appendChild(opt);
            });
        } 
    } catch (e) { 
        console.error("Error en el fetch de recicladores:", e); 
    }
}


async function listarUbicaciones() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        ubicacionesCache = data;
        renderizarGrid(data);
    } catch (e) { console.error(e); }
}

window.guardarUbicacion = async function () {
    const id = document.getElementById("idUbicacion").value;
    const nombre = document.getElementById("nombrePunto").value;
    const direccion = document.getElementById("direccion").value;
    const idParroquia = selectParroquia.value;
    const idReciclador = selectReciclador.value;

    if (!nombre || !coordenadasSeleccionadas || !idParroquia) {
        alert("Faltan datos (Nombre, Parroquia o Mapa)");
        return;
    }

    let objReciclador = null;
    if (idReciclador && idReciclador !== "") {
        objReciclador = { cedula: parseInt(idReciclador) }; 
    }

    const checkboxes = document.querySelectorAll('input[name="materiales"]:checked');
    const listaMateriales = Array.from(checkboxes).map(cb => {
        return {
            material: { id_material: parseInt(cb.value) }
        };
    });

    const datosObj = {
        nombre: nombre,
        direccion: direccion,
        latitud: coordenadasSeleccionadas.lat,
        longitud: coordenadasSeleccionadas.lng,
        foto: null, 
        parroquia: { id_parroquia: parseInt(idParroquia) },
        reciclador: objReciclador,
        materialesAceptados: listaMateriales 
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(datosObj));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const metodo = id ? "PUT" : "POST";
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        // Enviar sin Content-Type manual
        const res = await fetch(url, {
            method: metodo,
            body: formData 
        });

        if (res.ok) {
            cerrarModal();
            listarUbicaciones();
            alert(`Ubicación guardada correctamente.`);
        } else {
            const errorText = await res.text();
            console.error("Error backend:", errorText);
            alert("Error al guardar. Revisa la consola.");
        }
    } catch (e) { console.error(e); }
};


function renderizarGrid(lista) {
    gridUbicaciones.innerHTML = "";
    lista.forEach(ubi => {
        let imgUrl = 'https://placehold.co/300x150?text=Sin+Imagen';
        if (ubi.foto && ubi.foto.length > 5) {
            if (ubi.foto.startsWith("http") || ubi.foto.startsWith("data:")) {
                imgUrl = ubi.foto;
            } else {
                imgUrl = `data:image/jpeg;base64,${ubi.foto}`;
            }
        }

        let txtReciclador = '<span style="color:#999">Sin Asignar</span>';
        if (ubi.reciclador) txtReciclador = `<strong>${ubi.reciclador.primer_nombre} ${ubi.reciclador.apellido_paterno}</strong>`;

        const card = document.createElement('div');
        card.className = 'card-ubicacion';
        card.innerHTML = `
            <div class="card-img" style="background-image: url('${imgUrl}')"></div>
            <div class="card-body">
                <div class="card-title">${ubi.nombre}</div>
                <div class="card-sub">${ubi.direccion}</div>
                <div class="card-coords" style="margin-top:8px; font-size:12px;">👤 ${txtReciclador}</div>
                <div class="card-coords">📍 ${ubi.latitud?.toFixed(4)}, ${ubi.longitud?.toFixed(4)} <br> 🏙️ ${ubi.parroquia?.nombre_parroquia || ''}</div>
            </div>
            <div class="card-actions">
                <button class="btn-edit" onclick="cargarDatosEdicion(${ubi.id_ubicacion_reciclaje})">Editar</button>
                <button class="btn-delete" onclick="eliminarUbicacion(${ubi.id_ubicacion_reciclaje})">Eliminar</button>
            </div>
        `;
        gridUbicaciones.appendChild(card);
    });
}

function procesarImagen(e) {
    const file = e.target.files[0];
    if (file) {
        fotoNuevaFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            previewImagen.style.backgroundImage = `url(${ev.target.result})`;
        };
        reader.readAsDataURL(file);
    }
}

window.eliminarUbicacion = async function (id) {
    if (confirm("¿Eliminar?")) {
        await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        listarUbicaciones();
    }
};

window.obtenerUbicacionActual = function() {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta la geolocalización.");
        return;
    }

    const btn = document.querySelector(".btn-gps");
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Buscando...";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            if (map) {
                map.setView([lat, lng], 18); 
                colocarMarcador(lat, lng);
            }

            btn.innerText = textoOriginal;
            btn.disabled = false;
        },
        (error) => {
            console.error(error);
            let mensaje = "No se pudo obtener la ubicación.";
            if(error.code === 1) mensaje = "Permiso de ubicación denegado.";
            if(error.code === 2) mensaje = "Ubicación no disponible (GPS apagado).";
            if(error.code === 3) mensaje = "Se agotó el tiempo de espera.";
            
            alert(mensaje);
            btn.innerText = textoOriginal;
            btn.disabled = false;
        },
        {
            enableHighAccuracy: true, 
            timeout: 10000,
            maximumAge: 0
        }
    );
}