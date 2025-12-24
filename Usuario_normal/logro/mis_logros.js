const API_BASE = 'https://api-loopi.onrender.com/api';

document.addEventListener("DOMContentLoaded", () => {
    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
        window.location.href = "../incio_de_sesion/login-registro.html";
        return;
    }
    const usuario = JSON.parse(usuarioStr);
    cargarTableroLogros(usuario.cedula);
});

async function cargarTableroLogros(cedula) {
    const contenedor = document.getElementById("gridLogros");
    contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: #94A3B8;">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i><p style="margin-top:10px;">Puliento trofeos...</p>
    </div>`;

    try {
        const [resTodos, resMios] = await Promise.all([
            fetch(`${API_BASE}/logros`),
            fetch(`${API_BASE}/usuarios/${cedula}/logros`)
        ]);

        if (!resTodos.ok) throw new Error("Error API");
        
        const todosLosLogros = await resTodos.json();
        const misLogros = resMios.ok ? await resMios.json() : [];
        
        const misLogrosIds = new Set(misLogros.map(l => l.id_logro));

        contenedor.innerHTML = "";
        
        todosLosLogros.sort((a, b) => {
            const tengoA = misLogrosIds.has(a.id_logro);
            const tengoB = misLogrosIds.has(b.id_logro);
            if (tengoA && !tengoB) return -1; 
            if (!tengoA && tengoB) return 1;  
            return (a.puntos_ganados || 0) - (b.puntos_ganados || 0);
        });

        todosLosLogros.forEach(logro => {
            const loTengo = misLogrosIds.has(logro.id_logro);
            contenedor.appendChild(crearTarjeta(logro, loTengo));
        });

        actualizarProgreso(misLogros.length, todosLosLogros.length);

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#ef4444; padding: 30px;">
            <i class="fa-solid fa-triangle-exclamation fa-2x"></i><p>No se pudieron cargar los logros.</p>
        </div>`;
    }
}

function crearTarjeta(logro, desbloqueado) {
    const div = document.createElement("div");
    div.className = `logro-card ${desbloqueado ? 'unlocked' : 'locked'}`;

    let imgUrl = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png'; // Default

    if (logro.imagen_logro && logro.imagen_logro.length > 5) {
        if (logro.imagen_logro.startsWith('http') || logro.imagen_logro.startsWith('data:')) {
            imgUrl = logro.imagen_logro;
        } else {
            imgUrl = `data:image/png;base64,${logro.imagen_logro}`;
        }
    }


    const iconOverlay = `<div class="status-overlay">
        <i class="fa-solid ${desbloqueado ? 'fa-check' : 'fa-lock'}"></i>
    </div>`;

    const badgeHtml = desbloqueado 
        ? `<div class="badge-puntos"><i class="fa-solid fa-star"></i> Completado</div>`
        : `<div class="badge-puntos"><i class="fa-solid fa-bullseye"></i> Meta: ${logro.puntos_ganados || 0} Pts</div>`;

    div.innerHTML = `
        ${iconOverlay}
        <div class="img-container">
            <img src="${imgUrl}" alt="Logro" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1828/1828884.png'">
        </div>
        <h3>${logro.nombre}</h3>
        <p>${logro.descripcion || 'Sigue reciclando para descubrir este logro.'}</p>
        ${badgeHtml}
    `;

    return div;
}

function actualizarProgreso(obtenidos, total) {
    if(total === 0) return;
    const porcentaje = Math.round((obtenidos / total) * 100);
    
    const barra = document.getElementById("barraProgreso");
    if(barra) barra.style.width = `${porcentaje}%`;
    
    const texto = document.getElementById("textoProgreso");
    if(texto) texto.innerText = `${porcentaje}% Completado`;
}