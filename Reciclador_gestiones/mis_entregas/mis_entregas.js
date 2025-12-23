const API_BASE = 'https://api-loopi.onrender.com/api';

let usuario = null;
let entregas = [];
let estadoActual = "PENDIENTE_RECOLECCION";

document.addEventListener("DOMContentLoaded", () => {
    const userStr = localStorage.getItem("usuario");
    if (!userStr) return (location.href = "../incio_de_sesion/login-registro.html");

    usuario = JSON.parse(userStr);

    const esReciclador = usuario.roles.some(r => (r.rol ? r.rol.id_rol : r.id_rol) === 2);
    if (!esReciclador) return (location.href = "../incio_de_sesion/login-registro.html");

    cargarEntregas();

    document.querySelectorAll(".btn-filtro").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".btn-filtro").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            estadoActual = btn.dataset.estado;
            pintarEntregas();
        });
    });
});

async function cargarEntregas() {
    try {
        const res = await fetch(`${API_BASE}/solicitud_recolecciones/reciclador/${usuario.cedula}`);
        if(res.ok) {
            entregas = await res.json();
            pintarEntregas();
        }
    } catch(e) { console.error(e); }
}

function pintarEntregas() {
    const grid = document.getElementById("gridEntregas");
    const tpl = document.getElementById("tplEntrega");
    grid.innerHTML = "";

    const filtradas = entregas.filter((e) => e.estado === estadoActual);

    if(filtradas.length === 0) {
        grid.innerHTML = `<div style="text-align:center; width:100%; grid-column:1/-1; padding:40px; color:#999;">
            <i class="fa-solid fa-box-open fa-3x"></i><p>No hay entregas en este estado.</p>
        </div>`;
        return;
    }

    filtradas.forEach((item) => {
        const clone = tpl.content.cloneNode(true);

        clone.querySelector(".txtUsuario").innerText = `${item.solicitante?.primer_nombre || "Usuario"} ${item.solicitante?.apellido_paterno || ""}`;
        clone.querySelector(".txtDireccion").innerHTML = `<i class="fa-solid fa-map-pin"></i> ${item.ubicacion?.direccion || "Sin dirección"}`;
        
        const fecha = new Date(item.fecha_recoleccion_estimada || item.fecha_creacion).toLocaleDateString("es-EC");
        clone.querySelector(".txtFecha").innerHTML = `<i class="fa-regular fa-clock"></i> ${fecha}`;
        
        const matCount = item.detalles ? item.detalles.length : 0;
        clone.querySelector(".txtMaterialesCount").innerText = `${matCount} materiales`;

        const barra = clone.querySelector(".badge-estado");
        barra.className = `card-status-bar estado-${item.estado.toLowerCase()}`;

        const btnVer = clone.querySelector(".btn-ver");
        const btnAceptar = clone.querySelector(".btn-aceptar");
        const btnRechazar = clone.querySelector(".btn-rechazar");
        const btnCompletar = clone.querySelector(".btn-completar");

        btnAceptar.style.display = "none";
        btnRechazar.style.display = "none";
        btnCompletar.style.display = "none";

        btnVer.onclick = () => abrirDetalle(item);

        if (item.estado === "PENDIENTE_RECOLECCION") {
            btnAceptar.style.display = "flex";
            btnRechazar.style.display = "flex";
            
            btnAceptar.onclick = () => confirmarAccion(item.id_solicitud, "ACEPTAR");
            btnRechazar.onclick = () => confirmarAccion(item.id_solicitud, "RECHAZAR");
        } 
        else if (item.estado === "ACEPTADA") {
            btnCompletar.style.display = "flex";
            btnRechazar.style.display = "flex"; 
            btnRechazar.innerHTML = `<i class="fa-solid fa-ban"></i> Cancelar`;
            
            btnCompletar.onclick = () => confirmarFinalizacion(item);
            btnRechazar.onclick = () => confirmarAccion(item.id_solicitud, "CANCELAR");
        }

        grid.appendChild(clone);
    });
}

async function confirmarAccion(id, tipo) {
    let titulo = "¿Estás seguro?";
    let texto = "";
    let icono = "question";
    let confirmBtn = "Sí";
    let nuevoEstado = "";

    if (tipo === "ACEPTAR") {
        titulo = "Aceptar Solicitud";
        texto = "Te comprometes a recolectar estos materiales.";
        icono = "info";
        confirmBtn = "Sí, recolectar";
        nuevoEstado = "ACEPTADA";
    } else if (tipo === "RECHAZAR" || tipo === "CANCELAR") {
        titulo = tipo === "RECHAZAR" ? "Rechazar Solicitud" : "Cancelar Recolección";
        texto = "Esta acción no se puede deshacer.";
        icono = "warning";
        confirmBtn = "Sí, confirmar";
        nuevoEstado = "RECHAZADO"; 
    }

    const result = await Swal.fire({
        title: titulo,
        text: texto,
        icon: icono,
        showCancelButton: true,
        confirmButtonColor: tipo === "ACEPTAR" ? "#2ecc71" : "#e74c3c",
        cancelButtonText: "Volver",
        confirmButtonText: confirmBtn
    });

    if (result.isConfirmed) {
        actualizarEstado(id, nuevoEstado);
    }
}

async function confirmarFinalizacion(entrega) {
    let puntosTotales = 0;
    let resumenHtml = '<ul style="text-align:left; font-size:0.9rem;">';
    
    if(entrega.detalles) {
        entrega.detalles.forEach(d => {
            const valor = d.material.puntos_ganados || 10; 
            const sub = valor * d.cantidad_kg;
            puntosTotales += sub;
            resumenHtml += `<li>${d.material.nombre}: ${d.cantidad_kg}kg (${sub} pts)</li>`;
        });
    }
    resumenHtml += '</ul>';

    const result = await Swal.fire({
        title: 'Finalizar Entrega',
        html: `
            <p>Se otorgarán <b>${puntosTotales} puntos</b> al usuario.</p>
            ${resumenHtml}
            <p style="font-size:0.8rem; color:#666;">¿Confirmas que recibiste todo?</p>
        `,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Sí, finalizar y dar puntos',
        confirmButtonColor: '#3498db'
    });

    if (result.isConfirmed) {
        finalizarEntregaBackend(entrega.id_solicitud, puntosTotales);
    }
}

async function actualizarEstado(id, estado) {
    try {
        Swal.showLoading();
        await fetch(`${API_BASE}/solicitud_recolecciones/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: estado }),
        });
        Swal.fire("Actualizado", "El estado ha cambiado.", "success");
        cargarEntregas();
    } catch (e) {
        Swal.fire("Error", "No se pudo actualizar.", "error");
    }
}

async function finalizarEntregaBackend(id, puntos) {
    try {
        Swal.showLoading();
        const res = await fetch(`${API_BASE}/solicitud_recolecciones/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                estado: "FINALIZADO",
                puntos_ganados: puntos,
                fecha_recoleccion_real: new Date().toISOString(),
            }),
        });

        if(res.ok) {
            Swal.fire("¡Misión Cumplida!", "Has completado la recolección.", "success");
            cerrarModalDetalle();
            cargarEntregas();
        } else {
            throw new Error();
        }
    } catch(e) {
        Swal.fire("Error", "No se pudo finalizar.", "error");
    }
}

// --- MODAL DETALLE (CORREGIDO PARA CORREO) ---
function abrirDetalle(entrega) {
    const cont = document.getElementById("detalleContenido");
    
    let evidenciaHtml = "";
    if(entrega.fotoEvidencia) {
        let src = entrega.fotoEvidencia.startsWith("data:") ? entrega.fotoEvidencia : `data:image/jpeg;base64,${entrega.fotoEvidencia}`;
        evidenciaHtml = `<p><strong>Evidencia:</strong></p><img src="${src}" class="detalle-foto">`;
    }

    let matsHtml = "";
    if(entrega.detalles) {
        entrega.detalles.forEach(d => {
            matsHtml += `
                <div class="material-item">
                    <span><i class="fa-solid fa-box"></i> ${d.material.nombre}</span>
                    <strong>${d.cantidad_kg} Kg</strong>
                </div>
            `;
        });
    }

    // CORREO DEL SOLICITANTE
    const correoUsuario = entrega.solicitante.correo || "usuario@loopi.com";

    cont.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
            <div style="background:#eee; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                <i class="fa-solid fa-user fa-lg"></i>
            </div>
            <div>
                <h4 style="margin:0;">${entrega.solicitante.primer_nombre} ${entrega.solicitante.apellido_paterno}</h4>
                
                <a href="mailto:${correoUsuario}" style="color:#3498db; text-decoration:none; font-size:0.9rem; display:flex; align-items:center; gap:5px;">
                    <i class="fa-solid fa-envelope"></i> ${correoUsuario}
                </a>
            </div>
        </div>

        <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px;">
            <p style="margin:0 0 5px;"><strong>Dirección:</strong> ${entrega.ubicacion.direccion}</p>
            <p style="margin:0;"><strong>Fecha Estimada:</strong> ${new Date(entrega.fecha_recoleccion_estimada).toLocaleString()}</p>
        </div>

        <h4 style="border-bottom:1px solid #eee; padding-bottom:5px;">Materiales</h4>
        ${matsHtml || "<p>Sin detalles</p>"}

        ${evidenciaHtml}
    `;

    document.getElementById("modalDetalle").style.display = "flex";
}

function cerrarModalDetalle() {
    document.getElementById("modalDetalle").style.display = "none";
}