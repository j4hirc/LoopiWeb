const API_BASE = 'https://api-loopi.onrender.com/api';

let listaParroquias = [];

document.addEventListener("DOMContentLoaded", async () => {
    await cargarParroquias(); 
    cargarFormularios();
});


async function cargarParroquias() {
    try {
        const res = await fetch(`${API_BASE}/parroquias`);
        if (res.ok) {
            listaParroquias = await res.json();
        }
    } catch (e) {
        console.error("Error cargando parroquias", e);
    }
}

async function cargarFormularios() {
    try {
        const res = await fetch(`${API_BASE}/formularios_reciclador`);
        const data = await res.json();


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
        // --- FOTO ---
        let avatarUrl = `https://ui-avatars.com/api/?name=${f.usuario.primer_nombre}+${f.usuario.apellido_paterno}&background=random&color=fff`;
        if (f.usuario.foto && f.usuario.foto.length > 5) {
            if (f.usuario.foto.startsWith("http") || f.usuario.foto.startsWith("data:")) {
                avatarUrl = f.usuario.foto;
            } else {
                avatarUrl = `data:image/jpeg;base64,${f.usuario.foto}`;
            }
        }

        // --- DESCARGA ---
        let botonDescarga = "";
        if (f.foto_perfil_profesional) {
            sessionStorage.setItem(`doc_${f.id_formulario}`, f.foto_perfil_profesional);
            botonDescarga = `
                <button class="btn btn-download" onclick="descargarDocumento(${f.id_formulario})">
                    <i class="fa-solid fa-file-arrow-down"></i> Ver/Descargar Foto
                </button>
            `;
        }

        let horariosHtml = '<p style="font-size:0.85rem; color:#7f8c8d;">No especificado</p>';
        if (f.horarios && f.horarios.length > 0) {
            horariosHtml = `<ul style="font-size:0.85rem; padding-left:20px; margin:5px 0;">`;
            f.horarios.forEach((h) => {
                horariosHtml += `<li><strong>${h.dia_semana}:</strong> ${h.hora_inicio} - ${h.hora_fin}</li>`;
            });
            horariosHtml += `</ul>`;
        }

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

        let idParroquia = null;
        let nombreParroquia = "No definida (Se pedirá al aprobar)";
        
        if (f.usuario && f.usuario.parroquia) {
            if (typeof f.usuario.parroquia === 'object') {
                idParroquia = f.usuario.parroquia.id_parroquia || f.usuario.parroquia.id;
                nombreParroquia = f.usuario.parroquia.nombre_parroquia || f.usuario.parroquia.nombre;
            } else {
                idParroquia = f.usuario.parroquia;
                const pEncontrada = listaParroquias.find(p => (p.id_parroquia || p.id) == idParroquia);
                if(pEncontrada) nombreParroquia = pEncontrada.nombre_parroquia || pEncontrada.nombre;
            }
        }

        const paramParroquia = idParroquia ? idParroquia : 'null';

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
                    <p style="margin:2px 0; color:${idParroquia ? '#2c3e50' : '#e67e22'}">
                        <strong>Parroquia:</strong> ${nombreParroquia}
                    </p>
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
                <button class="btn btn-reject" onclick="procesar(${f.id_formulario}, false, null)">Rechazar</button>
                <button class="btn btn-approve" onclick="procesar(${f.id_formulario}, true, ${paramParroquia})">Aprobar</button>
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

function descargarDocumento(idFormulario) {
    let contenido = sessionStorage.getItem(`doc_${idFormulario}`);

    if (!contenido) {
        Swal.fire("Error", "No se encontró el documento.", "error");
        return;
    }

    if (contenido.startsWith("http")) {
        window.open(contenido, '_blank');
        return;
    }

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

async function procesar(id, aprobar, idParroquia) {
    const accionTexto = aprobar ? "Aprobar" : "Rechazar";
    const colorBtn = aprobar ? "#27ae60" : "#e74c3c";
    const mensajeDefault = aprobar ? "Cumple con los requisitos. Aprobado." : "Falta información en la evidencia.";

    let parroquiaSeleccionada = idParroquia;

    if (aprobar && !idParroquia) {
        let optionsHtml = `<option value="" disabled selected>Seleccione una parroquia</option>`;
        listaParroquias.forEach(p => {
            const pid = p.id_parroquia || p.id;
            const pnom = p.nombre_parroquia || p.nombre;
            optionsHtml += `<option value="${pid}">${pnom}</option>`;
        });

        const { value: pSeleccionada } = await Swal.fire({
            title: "¡Falta Parroquia!",
            html: `
                <p>El usuario no tiene parroquia asignada.</p>
                <p>Por favor, selecciona la ubicación del punto:</p>
                <select id="swal-parroquia" class="swal2-input">
                    ${optionsHtml}
                </select>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Continuar",
            preConfirm: () => {
                return document.getElementById('swal-parroquia').value;
            }
        });

        if (!pSeleccionada) return; // Cancelado o no seleccionó
        parroquiaSeleccionada = parseInt(pSeleccionada);
    }

    const { value: mensaje, isConfirmed } = await Swal.fire({
        title: `${accionTexto} Solicitud`,
        input: "textarea",
        inputLabel: "Observación",
        inputValue: mensajeDefault,
        showCancelButton: true,
        confirmButtonText: `Sí, ${accionTexto}`,
        confirmButtonColor: colorBtn,
        cancelButtonText: "Cancelar",
        inputValidator: (value) => {
            if (!value) return "¡Escribe una observación!";
        },
    });

    if (!isConfirmed) return;

    try {
        Swal.fire({ title: "Procesando...", didOpen: () => Swal.showLoading() });

        let url, method, body;

        if (aprobar) {
            url = `${API_BASE}/formularios_reciclador/aprobar/${id}`;
            method = "PUT";
            body = { 
                observacion_admin: mensaje,
                parroquia: { id_parroquia: parroquiaSeleccionada }
            };
        } else {
            url = `${API_BASE}/formularios_reciclador/${id}`;
            method = "PUT";
            body = {
                aprobado: false,
                observacion_admin: mensaje,
            };
        }

        console.log("Enviando body:", body);

        const response = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (response.ok) {
            Swal.fire("¡Éxito!", `Solicitud procesada.`, "success");
            cargarFormularios();
        } else {
            const errorText = await response.text();
            console.error("Error del servidor:", errorText);
            Swal.fire("Error", "Problema al procesar: " + errorText, "error");
        }
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "Fallo de conexión.", "error");
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