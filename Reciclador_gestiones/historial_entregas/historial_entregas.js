const API_BASE = 'https://api-loopi.onrender.com/api';

let usuario;
let historial = [];
let estadoFiltro = "TODOS";

document.addEventListener("DOMContentLoaded", () => {
    const userStr = localStorage.getItem("usuario");
    if (!userStr) return (location.href = "../incio_de_sesion/login-registro.html");

    usuario = JSON.parse(userStr);
    
    const esReciclador = usuario.roles.some(r => (r.rol ? r.rol.id_rol : r.id_rol) === 2);
    if (!esReciclador) return (location.href = "../incio_de_sesion/login-registro.html");

    cargarHistorial();

    document.getElementById("buscarHistorial").addEventListener("input", filtrarHistorial);

    document.querySelectorAll(".btn-filtro").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".btn-filtro").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            estadoFiltro = btn.dataset.estado;
            pintarHistorial();
        });
    });
});

async function cargarHistorial() {
    try {
        const res = await fetch(`${API_BASE}/solicitud_recolecciones/reciclador/${usuario.cedula}`);
        if(res.ok) {
            historial = await res.json();
            historial.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
            pintarHistorial();
        }
    } catch(e) { console.error(e); }
}

function pintarHistorial(data = null) {
    const grid = document.getElementById("gridHistorial");
    const tpl = document.getElementById("tplHistorial");
    grid.innerHTML = "";

    // LÓGICA DE FILTRADO CORREGIDA
    let lista = data || historial;

    if (estadoFiltro !== "TODOS") {
        if (estadoFiltro === "CANCELADO") {
            // Si el filtro es CANCELADO, mostramos tanto CANCELADO como RECHAZADO
            lista = lista.filter(e => e.estado === "CANCELADO" || e.estado === "RECHAZADO");
        } else {
            // Para FINALIZADO u otros estados específicos
            lista = lista.filter(e => e.estado === estadoFiltro);
        }
    } else {
        // Si es TODOS, mostramos FINALIZADO, CANCELADO y RECHAZADO (excluyendo pendientes activos si los hubiera)
        lista = lista.filter(e => ["FINALIZADO", "CANCELADO", "RECHAZADO"].includes(e.estado));
    }

    if (lista.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#94A3B8;">
            <i class="fa-regular fa-folder-open fa-3x"></i><p style="margin-top:10px;">No se encontraron registros.</p>
        </div>`;
        return;
    }

    lista.forEach((item) => {
        const clone = tpl.content.cloneNode(true);
        const card = clone.querySelector(".history-card");

        // Determinar si es una transacción exitosa o fallida
        const esExitosa = item.estado === "FINALIZADO";

        card.classList.add(esExitosa ? "status-finalizado" : "status-cancelado");
        
        // Texto del badge según el estado exacto
        let textoEstado = "Completada";
        if (item.estado === "CANCELADO") textoEstado = "Cancelada";
        if (item.estado === "RECHAZADO") textoEstado = "Rechazada";

        clone.querySelector(".status-badge").innerText = textoEstado;

        const fechaObj = new Date(item.fecha_recoleccion_real || item.fecha_creacion);
        const opcionesFecha = { day: 'numeric', month: 'short' };
        clone.querySelector(".date-badge").innerText = `📅 ${fechaObj.toLocaleDateString('es-EC', opcionesFecha)}`;

        clone.querySelector(".txtUsuario").innerText = `${item.solicitante?.primer_nombre} ${item.solicitante?.apellido_paterno}`;
        clone.querySelector(".txtDireccion").innerHTML = `<i class="fa-solid fa-location-dot"></i> ${item.ubicacion?.direccion || "Sin dirección"}`;

        const puntos = item.puntos_ganados || 0;
        const ptsLabel = clone.querySelector(".points-tag");
        ptsLabel.innerText = esExitosa ? `🏆 +${puntos} pts` : "🚫 0 pts";
        ptsLabel.style.color = esExitosa ? "var(--primary)" : "var(--text-gray)";

        clone.querySelector(".btn-ver-detalle").onclick = () => abrirDetalle(item);

        grid.appendChild(clone);
    });
}

function filtrarHistorial(e) {
    const t = e.target.value.toLowerCase();
    const f = historial.filter(h => 
        `${h.solicitante?.primer_nombre} ${h.solicitante?.apellido_paterno}`.toLowerCase().includes(t) ||
        (h.ubicacion?.direccion || "").toLowerCase().includes(t)
    );
    pintarHistorial(f);
}

function abrirDetalle(entrega) {
    const cont = document.getElementById("detalleContenido");
    let totalPuntos = 0;

    let materialesHTML = "";
    if(entrega.detalles && entrega.detalles.length > 0) {
        materialesHTML = entrega.detalles.map(d => {
            // Nota: Aquí asumo que d.material.puntos_ganados es por unidad de peso.
            // Si tu API no trae ese dato en 'material', usa un default o ajusta según tu modelo.
            const ptsUnit = (d.material && d.material.puntos_por_kg) ? d.material.puntos_por_kg : 10; 
            const subtotal = ptsUnit * d.cantidad_kg;
            totalPuntos += subtotal;

            return `
                <div class="material-list-item">
                    <span>${d.material ? d.material.nombre : 'Material'} <small>(${d.cantidad_kg} kg)</small></span>
                    <strong>${subtotal.toFixed(0)} pts</strong>
                </div>
            `;
        }).join("");
    } else {
        materialesHTML = "<p style='text-align:center; color:#999; font-style:italic;'>Sin materiales registrados</p>";
    }

    // Si no está finalizado, los puntos reales son 0 aunque el cálculo teórico diga otra cosa
    if(entrega.estado !== "FINALIZADO") totalPuntos = 0;
    // Si la entrega ya trae el total de puntos ganados desde el backend, usamos ese valor
    if(entrega.puntos_ganados > 0) totalPuntos = entrega.puntos_ganados;

    // Color del estado en el modal
    let colorEstado = '#10B981'; // Verde por defecto
    if (entrega.estado === 'CANCELADO' || entrega.estado === 'RECHAZADO') colorEstado = '#EF4444'; // Rojo

    cont.innerHTML = `
        <div class="receipt-row">
            <span class="receipt-label">Cliente:</span>
            <span class="receipt-value">${entrega.solicitante.primer_nombre} ${entrega.solicitante.apellido_paterno}</span>
        </div>
        <div class="receipt-row">
            <span class="receipt-label">Fecha:</span>
            <span class="receipt-value">${new Date(entrega.fecha_recoleccion_real || entrega.fecha_creacion).toLocaleString()}</span>
        </div>
        <div class="receipt-row">
            <span class="receipt-label">Estado:</span>
            <span class="receipt-value" style="color:${colorEstado}">${entrega.estado}</span>
        </div>
        
        <div class="receipt-divider"></div>
        
        <div style="margin-bottom: 10px; font-weight:600; color:#64748B; font-size:0.9rem;">Detalle de Recolección</div>
        ${materialesHTML}
        
        <div class="receipt-divider"></div>
        
        <div class="total-section">
            <span>TOTAL GANADO</span>
            <span>${totalPuntos} Pts</span>
        </div>
    `;

    document.getElementById("modalDetalle").style.display = "flex";
}

function cerrarModalDetalle() {
    document.getElementById("modalDetalle").style.display = "none";
}