const API_BASE = 'https://api-loopi.onrender.com/api';
const FRONTEND_URL = 'https://canjeo-loopi-ec.netlify.app';

document.addEventListener("DOMContentLoaded", async () => {
    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
        window.location.href = "../incio_de_sesion/login-registro.html";
        return;
    }
    const usuario = JSON.parse(usuarioStr);

    await cargarCupones(usuario.cedula);
});

async function cargarCupones(cedula) {
    const contenedor = document.getElementById("gridCupones");
    const emptyState = document.getElementById("emptyState");

    try {
        const response = await fetch(`${API_BASE}/qr_canjeos/usuario/${cedula}`);
        
        if (!response.ok) throw new Error("Error al cargar cupones");
        
        const cupones = await response.json();

        contenedor.innerHTML = ""; 

        if (cupones.length === 0) {
            contenedor.style.display = "none";
            emptyState.style.display = "block";
            return;
        }

        cupones.forEach(cupon => {
            const card = crearTarjetaCupon(cupon);
            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<p style="color:red; text-align:center; width:100%; padding:20px;">No pudimos conectar con la billetera virtual.</p>`;
    }
}

function crearTarjetaCupon(cupon) {
    const div = document.createElement("div");

    const esUsado = cupon.usado;
    const estadoClass = esUsado ? "usado" : "";
    const textoEstado = esUsado ? "CANJEADO" : "VÁLIDO";
    const colorHeader = esUsado ? "#95a5a6" : "#8E44AD"; 

    const fechaObj = new Date(cupon.fecha_generado);
    const fecha = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    const hora = fechaObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    const rutaValidar = "/"; 
    const urlParaEscanear = `${FRONTEND_URL}${rutaValidar}?codigo=${cupon.token}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlParaEscanear)}`;

    div.className = `cupon-card ${estadoClass}`;
    
    div.innerHTML = `
        <div class="cupon-header" style="background-color: ${colorHeader}">
            <span class="badge-estado">${textoEstado}</span>
            <i class="fa-solid fa-ticket"></i>
        </div>
        
        <div class="cupon-body">
            <span class="auspiciante">
                <i class="fa-solid fa-store"></i> ${cupon.recompensa.auspiciante ? cupon.recompensa.auspiciante.nombre : 'Loopi Oficial'}
            </span>
            
            <h3>${cupon.recompensa.nombre}</h3>
            
            <img src="${qrUrl}" alt="QR Vista Previa" class="mini-qr">
            
            <div class="divider"></div>
            
            <small class="fecha-info">Generado: ${fecha} a las ${hora}</small>

            ${!esUsado ? `
                <button class="btn-ver-qr" onclick="verQrGrande('${urlParaEscanear}', '${cupon.recompensa.nombre}')">
                    <i class="fa-solid fa-qrcode"></i> Ampliar Código
                </button>
            ` : `
                <button class="btn-ver-qr" style="background:#e0e0e0; color:#888; cursor:not-allowed;">
                    <i class="fa-solid fa-check-double"></i> Ya Utilizado
                </button>
            `}
        </div>
    `;

    return div;
}

window.verQrGrande = function(urlCompleta, nombreRecompensa) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlCompleta)}`;
    
    Swal.fire({
        title: nombreRecompensa,
        text: 'Presenta este código al encargado.',
        imageUrl: qrUrl,
        imageWidth: 250,
        imageHeight: 250,
        imageAlt: 'Código QR para escanear',
        showCloseButton: true,
        confirmButtonText: 'Listo, cerrar',
        confirmButtonColor: '#8E44AD',
        background: '#fff',
        backdrop: `rgba(0,0,0,0.8)`,
        footer: '<span style="color:#888; font-size:0.85rem;">Escanea para validar en el sistema</span>'
    });
}