const API_URL = 'https://api-loopi.onrender.com/api/solicitud_recolecciones';

document.addEventListener("DOMContentLoaded", () => {
    fetchSolicitudes();
});

async function fetchSolicitudes() {
    try {
        const response = await fetch(`${API_URL}/pendientes`);

        if (!response.ok) throw new Error("Error al conectar con la API");

        const data = await response.json();

        console.log("---- DATA QUE LLEGA DEL BACKEND ----");
        console.log(data);

        const pendientes = data.filter(
            (sol) => sol.estado === "VERIFICACION_ADMIN"
        );

        console.log("---- SOLICITUDES FILTRADAS ----");
        console.log(pendientes);

        renderCards(pendientes);

        const badge = document.getElementById("count-badge");
        if (badge) badge.textContent = pendientes.length;
    } catch (error) {
        console.error("Error:", error);
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
        const fechaStr =
            fechaObj.toLocaleDateString() +
            " " +
            fechaObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        
        // --- LÓGICA DE FOTO EVIDENCIA (SOPORTE NUBE + BASE64) ---
        let fotoUrl = "https://via.placeholder.com/400x200?text=Sin+Foto";
        if (solicitud.fotoEvidencia && solicitud.fotoEvidencia.length > 5) {
            if (solicitud.fotoEvidencia.startsWith("http") || solicitud.fotoEvidencia.startsWith("data:")) {
                fotoUrl = solicitud.fotoEvidencia;
            } else {
                fotoUrl = `data:image/jpeg;base64,${solicitud.fotoEvidencia}`;
            }
        }
        // --------------------------------------------------------

        const ubi = solicitud.ubicacion;
        const esPuntoFijo = !ubi.reciclador;

        let infoUbicacionHTML = "";

        if (esPuntoFijo) {
            infoUbicacionHTML = `
                <div class="location-info" style="background: #e8f6f3; padding: 10px; border-radius: 8px; border-left: 4px solid #1abc9c;">
                    <strong style="color: #16a085; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px;">
                        <i class="fa-solid fa-building-shield"></i> Punto Oficial (Admin)
                    </strong>
                    <div style="margin-top: 5px; font-weight: bold; font-size: 1.1em;">
                        ${ubi.nombre || "Nombre no disponible"}
                    </div>
                    <div style="font-size: 0.9em; color: #555; margin-top: 2px;">
                        <i class="fa-solid fa-map-location-dot"></i> ${ubi.direccion || "Sin dirección registrada"}
                    </div>
                </div>`;
        } else {
            infoUbicacionHTML = `
                <div class="location-info" style="background: #f0faff; padding: 10px; border-radius: 8px; border-left: 4px solid #3498db;">
                    <strong style="color: #2980b9; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px;">
                        <i class="fa-solid fa-user-clock"></i> Reciclador Asignado
                    </strong>
                    <div style="margin-top: 5px; font-weight: bold;">
                        ${ubi.reciclador.primer_nombre} ${ubi.reciclador.apellido_paterno}
                    </div>
                    <div style="font-size: 0.9em; color: #555; margin-top: 2px;">
                        <i class="fa-solid fa-map-pin"></i> ${ubi.direccion || "Ubicación móvil"}
                    </div>
                </div>`;
        }

        let materialesHTML = '<ul style="margin: 10px 0; padding-left: 20px; color: #34495e;">';
        if (solicitud.detalles && solicitud.detalles.length > 0) {
            solicitud.detalles.forEach((d) => {
                materialesHTML += `<li><strong>${d.material.nombre}</strong>: ${d.cantidad_kg} Kg</li>`;
            });
        } else {
            materialesHTML += '<li style="color:#e74c3c">Sin detalles de material</li>';
        }
        materialesHTML += "</ul>";

        // HTML final de la tarjeta
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
                    <small style="color:#7f8c8d">Cédula: ${solicitud.solicitante.cedula} | ID Solicitud: #${solicitud.id_solicitud}</small>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">

                ${infoUbicacionHTML}
                
                <div style="margin-top:15px;">
                    <strong style="color: #2c3e50;">Materiales a validar:</strong>
                    ${materialesHTML}
                    <div style="font-size: 0.85em; color: #95a5a6; text-align: right;">
                        <i class="fa-regular fa-clock"></i> Enviado: ${fechaStr}
                    </div>
                </div>
            </div>

            <div class="card-actions">
                <input type="number" id="puntos-${solicitud.id_solicitud}" class="points-input" placeholder="Puntos a otorgar" min="1">
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
    let puntos = 0;

    if (accion === "APROBADO") {
        puntos = parseInt(inputPuntos.value);
        if (isNaN(puntos) || puntos <= 0) {
            Swal.fire("Error", "Ingresa una cantidad válida de puntos", "warning");
            return;
        }
    }

    // Confirmación
    const confirmResult = await Swal.fire({
        title: accion === "APROBADO" ? "¿Aprobar solicitud y otorgar puntos?" : "¿Rechazar solicitud?",
        text: "Esta acción no se puede deshacer",
        icon: accion === "APROBADO" ? "question" : "warning",
        showCancelButton: true,
        confirmButtonColor: accion === "APROBADO" ? "#2ecc71" : "#e74c3c",
        confirmButtonText: "Sí, continuar",
        cancelButtonText: "Cancelar",
    });

    if (!confirmResult.isConfirmed) return;

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
            "¡Listo!",
            accion === "APROBADO"
                ? `Solicitud aprobada y ${puntos} puntos otorgados`
                : "Solicitud rechazada correctamente",
            "success"
        );

        const card = document.getElementById(`card-${id}`);

        if (card) {
            card.style.transition = "opacity 0.5s";
            card.style.opacity = "0";
            setTimeout(() => card.remove(), 500);

        }

        setTimeout(fetchSolicitudes, 1000);
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