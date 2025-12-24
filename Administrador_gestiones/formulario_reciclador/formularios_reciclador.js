const API_BASE = 'https://api-loopi.onrender.com/api';

document.addEventListener("DOMContentLoaded", () => {
    cargarFormularios();
});

async function cargarFormularios() {
    try {
        const res = await fetch(`${API_BASE}/formularios_reciclador`);
        const data = await res.json();

        // Filtramos solo los que NO han sido procesados (aprobado es null o false, pero queremos los pendientes)
        // Ojo: Si aprobado es null, está pendiente. Si es false, fue rechazado.
        // Ajusta según tu lógica de negocio. Generalmente: aprobado === null
        const pendientes = data.filter((f) => f.aprobado === null); 

        document.getElementById("count-badge").innerText = pendientes.length;
        renderCards(pendientes);
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo cargar formularios", "error");
    }
}

function renderCards(lista) {
    const container = document.getElementById("cards-container");
    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; width:100%; padding:40px; color:#7f8c8d;">
                <h3>🎉 Todo al día</h3>
                <p>No hay solicitudes pendientes</p>
            </div>`;
        return;
    }

    lista.forEach((f) => {

        // 1. AVATAR (URL o Base64)
        let avatarUrl = `https://ui-avatars.com/api/?name=${f.usuario.primer_nombre}+${f.usuario.apellido_paterno}&background=random&color=fff`;
        if (f.usuario.foto && f.usuario.foto.length > 5) {
            if (f.usuario.foto.startsWith("http") || f.usuario.foto.startsWith("data:")) {
                avatarUrl = f.usuario.foto;
            } else {
                avatarUrl = `data:image/jpeg;base64,${f.usuario.foto}`;
            }
        }

        // 2. DESCARGA FOTO PROFESIONAL
        let botonDescarga = "";
        if (f.foto_perfil_profesional) {
            sessionStorage.setItem(`doc_${f.id_formulario}`, f.foto_perfil_profesional);

            botonDescarga = `
                <button class="btn btn-download" onclick="descargarDocumento(${f.id_formulario})">
                    <i class="fa-solid fa-file-arrow-down"></i> Ver/Descargar Foto
                </button>
            `;
        }

        // 3. HORARIOS
        let horariosHtml = '<p style="font-size:0.85rem; color:#7f8c8d;">No especificado</p>';
        if (f.horarios && f.horarios.length > 0) {
            horariosHtml = `<ul style="font-size:0.85rem; padding-left:20px; margin:5px 0;">`;
            f.horarios.forEach((h) => {
                horariosHtml += `<li><strong>${h.dia_semana}:</strong> ${h.hora_inicio} - ${h.hora_fin}</li>`;
            });
            horariosHtml += `</ul>`;
        }

        // 4. MATERIALES
        let materialesHtml = '<p style="font-size:0.85rem; color:#7f8c8d;">No especificado</p>';
        if (f.materiales && f.materiales.length > 0) {
            materialesHtml = `<div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:5px;">`;
            f.materiales.forEach((fm) => {
                const nombreMat = fm.material ? fm.material.nombre : "Material ??";
                materialesHtml += `
                    <span style="background:#eef2f3; padding:2px 8px; border-radius:12px; font-size:0.75rem; border:1px solid #bdc3c7;">
                        ${nombreMat}
                    </span>`;
            });
            materialesHtml += `</div>`;
        }

        // 5. EVIDENCIA (URL o Base64)
        let imgEvidenciaHtml = `<p style="color:#e74c3c; font-size:0.9rem;">Sin evidencia cargada</p>`;

        if (f.evidencia_experiencia) {
            let srcImagen = f.evidencia_experiencia;
            
            if (!srcImagen.startsWith("http") && !srcImagen.startsWith("data:")) {
                srcImagen = `data:image/jpeg;base64,${f.evidencia_experiencia}`;
            }

            sessionStorage.setItem(`img_evidencia_${f.id_formulario}`, srcImagen);

            imgEvidenciaHtml = `
                <div style="width:100%; height:150px; overflow:hidden; border-radius:8px; cursor:pointer; border:1px solid #ddd;" 
                     onclick="verImagenDesdeMemoria(${f.id_formulario})">
                    <img src="${srcImagen}" style="width:100%; height:100%; object-fit:cover;" alt="Evidencia" onerror="this.src='https://via.placeholder.com/150?text=Error+Imagen'">
                </div>
            `;
        }

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div style="position:relative">
                <span class="status-badge status-pendiente">Pendiente</span>
            </div>

            <div class="card-body">
                <div class="user-header">
                    <img src="${avatarUrl}" class="user-avatar" alt="Foto Perfil" onerror="this.src='https://ui-avatars.com/api/?name=User'">
                    <div>
                        <h3 style="margin:0; color:#2c3e50; font-size:1.1rem;">
                            ${f.usuario.primer_nombre} ${f.usuario.apellido_paterno}
                        </h3>
                        <small style="color:#7f8c8d;">CI: ${f.usuario.cedula}</small>
                    </div>
                </div>

                <small style="color:#7f8c8d; display:block; margin-bottom:10px;">
                    Solicitado: ${f.fecha_solicitud ? f.fecha_solicitud.split("T")[0] : "Hoy"}
                </small>

                <hr style="margin: 10px 0; border:0; border-top:1px solid #eee;">

                <div style="margin-bottom:10px;">
                    <p style="margin:2px 0;"><strong>Sitio:</strong> ${f.nombre_sitio}</p>
                    <p style="margin:2px 0;"><strong>Ubicación:</strong> ${f.ubicacion}</p>
                    <p style="margin:2px 0;"><strong>Años Exp:</strong> ${f.anios_experiencia}</p>
                </div>

                ${botonDescarga}

                <div style="margin-bottom:10px; background:#f9f9f9; padding:8px; border-radius:5px;">
                    <h5 style="margin:0 0 5px 0; color:#34495e;"><i class="fa-regular fa-clock"></i> Horarios</h5>
                    ${horariosHtml}
                </div>

                <div style="margin-bottom:10px;">
                    <h5 style="margin:0 0 5px 0; color:#34495e;"><i class="fa-solid fa-recycle"></i> Materiales</h5>
                    ${materialesHtml}
                </div>

                <h5 style="margin:0 0 5px 0; color:#34495e;">📷 Evidencia</h5>
                ${imgEvidenciaHtml}
            </div>

            <div class="card-actions btn-group">
                <button class="btn btn-reject" onclick="procesar(${f.id_formulario}, false)">Rechazar</button>
                <button class="btn btn-approve" onclick="procesar(${f.id_formulario}, true)">Aprobar</button>
            </div>
        `;

        container.appendChild(card);
    });
}

function verImagenDesdeMemoria(id) {
    const src = sessionStorage.getItem(`img_evidencia_${id}`);
    if (src) {
        const modal = document.getElementById("imageModal");
        const img = document.getElementById("modalImg");
        if (modal && img) {
            img.src = src;
            modal.style.display = "flex";
        }
    } else {
        Swal.fire("Error", "No se pudo cargar la imagen.", "error");
    }
}

// --- DESCARGA MEJORADA PARA URLS Y BASE64 ---
function descargarDocumento(idFormulario) {
    let contenido = sessionStorage.getItem(`doc_${idFormulario}`);

    if (!contenido) {
        Swal.fire("Error", "No se encontró el documento.", "error");
        return;
    }

    // CASO 1: Es una URL de Supabase (http...)
    if (contenido.startsWith("http")) {
        window.open(contenido, '_blank');
        return;
    }

    // CASO 2: Es Base64 (Antiguo)
    if (!contenido.startsWith("data:")) {
        if (contenido.charAt(0) === "J") { 
            contenido = `data:application/pdf;base64,${contenido}`;
        } else {
            contenido = `data:image/jpeg;base64,${contenido}`;
        }
    }

    const link = document.createElement("a");
    link.href = contenido;
    link.download = `documento_solicitud_${idFormulario}`;  
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function procesar(id, aprobar) {
    const accionTexto = aprobar ? "Aprobar" : "Rechazar";
    const colorBtn = aprobar ? "#27ae60" : "#e74c3c";
    const mensajeDefault = aprobar
        ? "Cumple con los requisitos. Aprobado."
        : "Falta información en la evidencia.";

    const { value: mensaje, isConfirmed } = await Swal.fire({
        title: `${accionTexto} Solicitud`,
        input: "textarea",
        inputLabel: "Observación para el usuario",
        inputPlaceholder: "Escribe aquí la razón...",
        inputValue: mensajeDefault,
        showCancelButton: true,
        confirmButtonText: `Sí, ${accionTexto}`,
        confirmButtonColor: colorBtn,
        cancelButtonText: "Cancelar",
        inputValidator: (value) => {
            if (!value) {
                return "¡Debes escribir una observación!";
            }
        },
    });

    if (!isConfirmed) return;

    try {
        Swal.fire({ title: "Procesando...", didOpen: () => Swal.showLoading() });

        let url, method, body;

        if (aprobar) {
            url = `${API_BASE}/formularios_reciclador/aprobar/${id}`;
            method = "PUT";
            body = { observacion_admin: mensaje };
        } else {
            url = `${API_BASE}/formularios_reciclador/${id}`;
            method = "PUT";
            body = {
                aprobado: false,
                observacion_admin: mensaje,
            };
        }

        const response = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (response.ok) {
            Swal.fire("¡Éxito!", `Solicitud procesada correctamente.`, "success");
            cargarFormularios();
        } else {
            const errorText = await response.text();
            console.error("Error del servidor:", errorText);
            Swal.fire("Error", "Hubo un problema al procesar la solicitud.", "error");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "Fallo de conexión con el servidor.", "error");
    }
}

function verImagen(src) {
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("modalImg");
    if (modal && img) {
        img.src = src;
        modal.style.display = "flex";
    }
}