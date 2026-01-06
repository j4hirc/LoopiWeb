const API_URL = 'https://api-loopi.onrender.com/api/solicitud_recolecciones';

document.addEventListener("DOMContentLoaded", () => {
    fetchSolicitudes();
});

async function fetchSolicitudes() {
    try {
        const response = await fetch(`${API_URL}/pendientes`);

        if (!response.ok) throw new Error("Error al conectar con la API");

        const data = await response.json();

        const pendientes = data.filter(
            (sol) => sol.estado === "VERIFICACION_ADMIN" && !sol.reciclador
        );

        renderCards(pendientes);

        const badge = document.getElementById("count-badge");
        if (badge) badge.textContent = pendientes.length;
    } catch (error) {
        console.error("Error:", error);
        document.getElementById("cards-container").innerHTML = 
            `<div style="text-align:center; padding:30px; color:red;">Error al cargar datos.</div>`;
    }
}

function renderCards(solicitudes) {
    const container = document.getElementById("cards-container");
    container.innerHTML = "";

    if (solicitudes.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px; color: #7f8c8d;">
                <i class="fa-solid fa-clipboard-check fa-4x" style="color: #2ecc71; margin-bottom:15px;"></i>
                <h3>¡Todo limpio!</h3>
                <p>No hay entregas pendientes de validación.</p>
            </div>`;
        return;
    }

    solicitudes.forEach((solicitud) => {
        const card = document.createElement("div");
        card.className = "card";
        card.id = `card-${solicitud.id_solicitud}`;

        const fechaObj = new Date(solicitud.fecha_creacion);
        const fechaStr = fechaObj.toLocaleDateString() + " " + 
                         fechaObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        
        let fotoUrl = "https://via.placeholder.com/400x200?text=Sin+Foto";
        if (solicitud.fotoEvidencia && solicitud.fotoEvidencia.length > 5) {
            if (solicitud.fotoEvidencia.startsWith("http") || solicitud.fotoEvidencia.startsWith("data:")) {
                fotoUrl = solicitud.fotoEvidencia;
            } else {
                fotoUrl = `data:image/jpeg;base64,${solicitud.fotoEvidencia}`;
            }
        }

        const ubi = solicitud.ubicacion;
        
        let materialesHTML = '<ul style="margin: 10px 0; padding-left: 20px; color: #34495e;">';
        let puntosCalculados = 0;

        if (solicitud.detalles && solicitud.detalles.length > 0) {
            solicitud.detalles.forEach((d) => {
                const nombreMat = d.material ? d.material.nombre : "Material";
                // Obtenemos los puntos base del material (si no existe, asumimos 0)
                const puntosBase = d.material && d.material.puntos_por_kg ? d.material.puntos_por_kg : 0;
                // Calculamos subtotal
                const subtotalPuntos = Math.round(d.cantidad_kg * puntosBase);
                
                puntosCalculados += subtotalPuntos;

                materialesHTML += `
                    <li>
                        <strong>${nombreMat}</strong>: ${d.cantidad_kg} Kg 
                        <span style="color:#27ae60; font-size:0.85em;">(${subtotalPuntos} pts)</span>
                    </li>`;
            });
        } else {
            materialesHTML += '<li style="color:#e74c3c">Sin detalles de material</li>';
        }
        materialesHTML += "</ul>";

        card.innerHTML = `
            <div class="card-image-container">
                <img src="${fotoUrl}" class="evidence-img" onclick="showImage(this.src)" alt="Evidencia" onerror="this.src='https://via.placeholder.com/400x200?text=Error+Carga'">
                <span class="status-badge">Pendiente</span>
            </div>
            
            <div class="card-body">
                <div class="user-info">
                    <h3 style="margin: 0 0 5px 0; color: #2c3e50;">
                        <i class="fa-solid fa-user"></i> ${solicitud.solicitante.primer_nombre} ${solicitud.solicitante.apellido_paterno}
                    </h3>
                    <small style="color:#7f8c8d">Cédula: ${solicitud.solicitante.cedula}</small>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">

                <div class="location-info" style="background: #e8f6f3; padding: 10px; border-radius: 8px; border-left: 4px solid #1abc9c;">
                    <strong style="color: #16a085; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px;">
                        <i class="fa-solid fa-building-shield"></i> Punto Fijo
                    </strong>
                    <div style="margin-top: 5px; font-weight: bold;">
                        ${ubi.nombre || "Nombre no disponible"}
                    </div>
                    <div style="font-size: 0.9em; color: #555; margin-top: 2px;">
                        <i class="fa-solid fa-map-location-dot"></i> ${ubi.direccion || "Sin dirección"}
                    </div>
                </div>
                
                <div style="margin-top:15px;">
                    <strong style="color: #2c3e50;">Materiales reportados:</strong>
                    ${materialesHTML}
                    <div style="font-size: 0.85em; color: #95a5a6; text-align: right;">
                        <i class="fa-regular fa-clock"></i> ${fechaStr}
                    </div>
                </div>
            </div>

            <div class="card-actions">
                <div>
                    <label style="font-size:0.85rem; font-weight:bold; color:#555;">Total Puntos a Asignar:</label>
                    <input type="number" 
                           id="puntos-${solicitud.id_solicitud}" 
                           class="points-input" 
                           value="${puntosCalculados}" 
                           readonly 
                           style="background-color: #f9f9f9; color: #27ae60; font-weight: bold;">
                </div>

                <div class="btn-group">
                    <button class="btn btn-reject" onclick="procesarSolicitud(${solicitud.id_solicitud}, 'RECHAZADO')">
                        <i class="fa-solid fa-xmark"></i> Rechazar
                    </button>
                    <button class="btn btn-approve" onclick="procesarSolicitud(${solicitud.id_solicitud}, 'APROBADO')">
                        <i class="fa-solid fa-check"></i> Aprobar
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function procesarSolicitud(id, accion) {
    const inputPuntos = document.getElementById(`puntos-${id}`);
    let puntos = parseInt(inputPuntos.value);

    if (accion === "APROBADO" && (isNaN(puntos) || puntos <= 0)) {
        Swal.fire("Advertencia", "El cálculo de puntos dio 0. Revisa los materiales.", "warning");
        return;
    }

    const confirmResult = await Swal.fire({
        title: accion === "APROBADO" ? "Confirmar Aprobación" : "Confirmar Rechazo",
        html: accion === "APROBADO" 
            ? `Se sumarán <b>${puntos} puntos</b> al usuario.` 
            : "La solicitud será marcada como rechazada.",
        icon: accion === "APROBADO" ? "question" : "warning",
        showCancelButton: true,
        confirmButtonColor: accion === "APROBADO" ? "#2ecc71" : "#e74c3c",
        confirmButtonText: "Sí, procesar",
        cancelButtonText: "Cancelar",
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

    const payload = {
        estado: accion === "APROBADO" ? "FINALIZADO" : "RECHAZADO",
        puntos_ganados: accion === "APROBADO" ? puntos : 0,
        fecha_recoleccion_real: new Date().toISOString(),
    };

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        Swal.fire(
            "¡Procesado!",
            `La solicitud ha sido ${accion === "APROBADO" ? "aprobada" : "rechazada"} con éxito.`,
            "success"
        );

        const card = document.getElementById(`card-${id}`);
        if (card) {
            card.style.transition = "all 0.5s ease";
            card.style.transform = "translateX(100px)";
            card.style.opacity = "0";
            setTimeout(() => {
                card.remove();
                const badge = document.getElementById("count-badge");
                if(badge) {
                    let count = parseInt(badge.textContent) || 0;
                    badge.textContent = Math.max(0, count - 1);
                }
                if(document.querySelectorAll('.card').length === 0) fetchSolicitudes();
            }, 500);
        }

    } catch (error) {
        console.error(error);
        Swal.fire("Error", error.message || "Fallo de conexión", "error");
    }
}

function showImage(src) {
    const modalImg = document.getElementById("modalImg");
    const modal = document.getElementById("imageModal");
    if (modalImg && modal) {
        modalImg.src = src;
        modal.style.display = "flex";
    }
}