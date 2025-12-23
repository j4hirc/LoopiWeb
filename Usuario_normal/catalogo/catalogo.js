const API_BASE = 'https://api-loopi.onrender.com/api';

let usuarioLogueado = null;
let listaRecompensas = [];

document.addEventListener("DOMContentLoaded", async () => {

    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
        window.location.href = "../../incio_de_sesion/login-registro.html";
        return;
    }
    usuarioLogueado = JSON.parse(usuarioStr);

    const spanPuntos = document.getElementById("misPuntos");
    if (spanPuntos) spanPuntos.innerText = usuarioLogueado.puntos_actuales || 0;

    await actualizarDatosUsuario();

    await cargarPremios();

    const urlParams = new URLSearchParams(window.location.search);
    const idPreseleccionado = urlParams.get('id');

    if (idPreseleccionado) {
        const recompensaEspecífica = listaRecompensas.filter(r => r.id_recompensa == idPreseleccionado);

        if (recompensaEspecífica.length > 0) {
            renderizarPremios(recompensaEspecífica);

            const buscador = document.getElementById("buscador");
            if (buscador) buscador.value = recompensaEspecífica[0].nombre;

            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
            });
            Toast.fire({ icon: 'info', title: 'Mostrando recompensa seleccionada' });
        }
    }

    const inputBuscador = document.getElementById("buscador");
    if (inputBuscador) {
        inputBuscador.addEventListener("input", (e) => {
            const termino = e.target.value.toLowerCase();
            if (termino === "") {
                renderizarPremios(listaRecompensas);
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.pushState({ path: newUrl }, '', newUrl);
            } else {
                const filtrados = listaRecompensas.filter(r =>
                    r.nombre.toLowerCase().includes(termino) ||
                    (r.auspiciante && r.auspiciante.nombre.toLowerCase().includes(termino))
                );
                renderizarPremios(filtrados);
            }
        });
    }
});

async function cargarPremios() {
    try {
        const res = await fetch(`${API_BASE}/recompensas`);
        if (!res.ok) throw new Error("Error API");
        listaRecompensas = await res.json();
        renderizarPremios(listaRecompensas);
    } catch (e) {
        console.error(e);
        const grid = document.getElementById("gridPremios");
        if (grid) grid.innerHTML = "<p>Error cargando catálogo :(</p>";
    }
}

function renderizarPremios(lista) {
    const grid = document.getElementById("gridPremios");
    if (!grid) return;

    grid.innerHTML = "";

    if (lista.length === 0) {
        grid.innerHTML = "<p style='text-align:center; width:100%; grid-column: 1 / -1;'>No se encontraron recompensas.</p>";
        return;
    }

    const misPuntos = usuarioLogueado.puntos_actuales || 0;

    lista.forEach(r => {
        const puedeCanjear = misPuntos >= r.costoPuntos;

        let imgUrl = "https://cdn-icons-png.flaticon.com/512/3209/3209955.png";
        if (r.imagen && r.imagen.length > 20) {
            imgUrl = r.imagen.startsWith("data:") ? r.imagen : `data:image/png;base64,${r.imagen}`;
        }

        const nombreAusp = r.auspiciante ? r.auspiciante.nombre : "Loopi";

        const card = document.createElement("div");
        card.className = "premio-card";
        card.innerHTML = `
            <div class="premio-img-box">
                <span class="auspiciante-tag"><i class="fa-solid fa-store"></i> ${nombreAusp}</span>
                <img src="${imgUrl}" class="premio-img" alt="${r.nombre}">
            </div>
            <div class="premio-body">
                <h3 class="premio-titulo">${r.nombre}</h3>
                <p class="premio-desc">${r.descripcion || "Sin descripción disponible."}</p>
                
                <div class="premio-footer">
                    <div class="costo-puntos">
                        <i class="fa-solid fa-coins"></i> ${r.costoPuntos}
                    </div>
                    <button class="btn-canjear" 
                        onclick="confirmarCanje(${r.id_recompensa}, '${r.nombre}', ${r.costoPuntos})"
                        ${puedeCanjear ? '' : 'disabled style="opacity:0.6; cursor:not-allowed;" title="Te faltan puntos"'}>
                        ${puedeCanjear ? 'Canjear' : 'Insuficiente'}
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.confirmarCanje = function (idRecompensa, nombre, costo) {
    Swal.fire({
        title: '¿Canjear Recompensa?',
        html: `Vas a canjear <b>${nombre}</b> por <b style="color:#E67E22;">${costo} puntos</b>.<br>Se descontarán de tu saldo.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3A6958',
        confirmButtonText: 'Sí, ¡lo quiero!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            procesarCanje(idRecompensa, costo);
        }
    });
};

async function procesarCanje(idRecompensa, costo) {

    const payload = {
        usuario: { cedula: usuarioLogueado.cedula },
        recompensa: { id_recompensa: idRecompensa }
    };

    try {
        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });


        const response = await fetch(`${API_BASE}/qr_canjeos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            return Swal.fire('Error', data.mensaje || 'No se pudo realizar el canje', 'error');
        }


        usuarioLogueado.puntos_actuales -= costo;


        const usuarioParaGuardar = { ...usuarioLogueado };
        usuarioParaGuardar.foto = null; // Quitamos la foto para no reventar la memoria
        localStorage.setItem("usuario", JSON.stringify(usuarioParaGuardar));


        const spanPuntos = document.getElementById("misPuntos");
        if (spanPuntos) spanPuntos.innerText = usuarioLogueado.puntos_actuales;


        const qrContainer = document.createElement('div');
        qrContainer.id = "qrcode";
        qrContainer.style.margin = "0 auto";

        const urlValidacion = `https://canjeo-loopi-ec.netlify.app/?codigo=${data.token}`;

        new QRCode(qrContainer, {
            text: urlValidacion, // Ahora el QR es un enlace web
            width: 150,
            height: 150,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        Swal.fire({
            title: '¡Canje Exitoso!',
            html: `
                <p>Presenta este código al auspiciante para reclamar tu <b>${data.recompensa.nombre}</b>.</p>
                <div style="display:flex; justify-content:center; margin: 20px 0;" id="swal-qr-container"></div>
                <p style="font-size: 12px; color: #555;">Código: <strong>${data.token}</strong></p>
                <small style="color: #999;">Al escanear, se abrirá la página de validación.</small>
            `,
            icon: 'success',
            confirmButtonColor: '#3A6958',
            didOpen: () => {
                document.getElementById('swal-qr-container').appendChild(qrContainer);
            }
        }).then(() => {
            cargarPremios();
        });

    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'Error de conexión con el servidor', 'error');
    }
}

async function actualizarDatosUsuario() {
    try {
        const res = await fetch(`${API_BASE}/usuarios/${usuarioLogueado.cedula}`);
        
        if (res.ok) {
            const usuarioFresco = await res.json();

            usuarioLogueado = usuarioFresco;
            

            const spanPuntos = document.getElementById("misPuntos");
            if(spanPuntos) spanPuntos.innerText = usuarioLogueado.puntos_actuales || 0;


            const usuarioParaGuardar = { ...usuarioLogueado }; 
            usuarioParaGuardar.foto = null; 
            
            try {
                localStorage.setItem("usuario", JSON.stringify(usuarioParaGuardar));
            } catch (errStorage) {
                console.warn("Memoria llena:", errStorage);
            }
            
            const grid = document.getElementById("gridPremios");
            if(grid && grid.innerHTML !== "") {
                renderizarPremios(listaRecompensas);
            }
        }
    } catch (e) {
        console.error("No se pudieron actualizar los puntos:", e);
    }
}