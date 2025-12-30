const API_BASE = 'https://api-loopi.onrender.com/api';

let datosCrudos = [];
let usuariosTotal = 0; 
let chartMatInstance = null;
let chartTopInstance = null;
let chartTendenciaInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
    await cargarTodo();

    // --- CORRECCIÓN 1: USAR LOS IDs CORRECTOS DEL HTML ---
    const ids = ['filtroInicio', 'filtroFin', 'filtroEstado', 'filtroTipoRecolector'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', aplicarFiltros);
    });
    
    const busqueda = document.getElementById('filtroReciclador');
    if(busqueda) busqueda.addEventListener('keyup', aplicarFiltros);
});

async function cargarTodo() {
    try {
        const resSol = await fetch(`${API_BASE}/solicitud_recolecciones`);
        if(!resSol.ok) throw new Error("Error fetching solicitudes");
        datosCrudos = await resSol.json();

        const resUs = await fetch(`${API_BASE}/usuarios`);
        if(resUs.ok) {
            const users = await resUs.json();
            usuariosTotal = users.length;
        }

        aplicarFiltros();

    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    }
}

function aplicarFiltros() {
    const fInicio = document.getElementById('filtroInicio').value;
    const fFin = document.getElementById('filtroFin').value;
    const estado = document.getElementById('filtroEstado').value;
    
    // --- CORRECCIÓN 2: OBTENER EL VALOR DEL ID CORRECTO ---
    const tipoRec = document.getElementById('filtroTipoRecolector').value; 
    
    const busqueda = document.getElementById('filtroReciclador').value.toLowerCase().trim();

    const filtrados = datosCrudos.filter(item => {
        // 1. Filtro Fecha
        if (item.fecha_recoleccion_real || item.fecha_creacion) {
            const fechaItem = new Date(item.fecha_recoleccion_real || item.fecha_creacion);
            fechaItem.setHours(0,0,0,0);

            if(fInicio) {
                const dInicio = new Date(fInicio);
                dInicio.setHours(0,0,0,0);
                if(fechaItem < dInicio) return false;
            }
            if(fFin) {
                const dFin = new Date(fFin);
                dFin.setHours(23,59,59,999);
                if(fechaItem > dFin) return false;
            }
        }

        // 2. Filtro Estado
        if(estado !== "TODOS") {
            const est = item.estado || "";
            if (estado === "CANCELADO") {
                if (est !== "CANCELADO" && est !== "RECHAZADO") return false;
            } else if (estado === "PENDIENTE") {
                if (!est.includes("PENDIENTE") && est !== "VERIFICACION_ADMIN") return false;
            } else {
                if (est !== estado) return false;
            }
        }

        // 3. --- LÓGICA TIPO DE RECOLECTOR (CORREGIDA) ---
        const tieneIDUbicacion = item.ubicacion && item.ubicacion.id_ubicacion_reciclaje != null;

        // --- CORRECCIÓN 3: USAR EL VALOR "PUNTO" QUE ESTÁ EN EL HTML ---
        if(tipoRec === "PUNTO") {
            if (!tieneIDUbicacion) return false; // Si NO tiene ubicación, no es punto fijo
        }
        
        if(tipoRec === "RECICLADOR") {
            if (tieneIDUbicacion) return false; // Si TIENE ubicación, no es móvil (es fijo)
        }

        // 4. Filtro Búsqueda Texto
        if(busqueda) {
            let coincide = false;
            if(item.reciclador) {
                const cedula = (item.reciclador.cedula || "").toString();
                const nombre = ((item.reciclador.primer_nombre || "") + " " + (item.reciclador.apellido_paterno || "")).toLowerCase();
                if(cedula.includes(busqueda) || nombre.includes(busqueda)) coincide = true;
            }
            if(item.ubicacion) {
                const nombreUbi = (item.ubicacion.nombre || "").toLowerCase();
                if(nombreUbi.includes(busqueda)) coincide = true;
            }
            if(!coincide) return false;
        }

        return true;
    });

    actualizarDashboard(filtrados);
}

function actualizarDashboard(datos) {
    // 1. CÁLCULO DE KPIs (Solo lo completado cuenta para los números grandes)
    const finalizadosParaKPI = datos.filter(s => s.estado === 'FINALIZADO' || s.estado === 'COMPLETADA');
    
    let totalKg = 0;
    let totalPuntos = 0;

    finalizadosParaKPI.forEach(s => {
        totalPuntos += (s.puntos_ganados || 0);
        if(s.detalles) s.detalles.forEach(d => totalKg += d.cantidad_kg);
    });

    document.getElementById("totalKgGlobal").innerText = totalKg.toFixed(1);
    document.getElementById("totalUsuarios").innerText = usuariosTotal;
    
    // Total Recolecciones muestra TODO lo filtrado (incluyendo pendientes)
    document.getElementById("totalRecolecciones").innerText = datos.length; 
    
    document.getElementById("totalPuntos").innerText = totalPuntos;

    // 2. GRÁFICOS Y TABLAS (Usamos 'datos' completo para ver qué pasa con pendientes/cancelados)
    generarGraficoMateriales(datos);
    generarGraficoTopRecicladores(datos);
    generarGraficoTendencia(datos);
    
    generarTablaRecicladores(datos);
    generarTopUsuarios(datos); 
}

function generarTablaRecicladores(lista) {
    const tbody = document.getElementById("tbodyRecicladores");
    tbody.innerHTML = "";
    const mapa = {}; 

    lista.forEach(s => {
        let key = "";
        let nombreDisplay = "Desconocido";
        let cedulaDisplay = "-";
        let esFijo = false;
        
        // --- LÓGICA DE AGRUPACIÓN ---
        // Usamos Optional Chaining (?.) para seguridad
        const idUbicacion = s.ubicacion?.id_ubicacion_reciclaje;
        const cedulaReciclador = s.reciclador?.cedula;

        if (idUbicacion) {
            // CASO 1: PUNTO FIJO (Tiene ID de Ubicación)
            key = "U_" + idUbicacion;
            nombreDisplay = s.ubicacion.nombre || "Punto Sin Nombre";
            cedulaDisplay = "Punto Fijo";
            esFijo = true;
        } 
        else if (cedulaReciclador) {
            // CASO 2: RECICLADOR MÓVIL ASIGNADO
            key = "R_" + cedulaReciclador;
            nombreDisplay = `${s.reciclador.primer_nombre || ""} ${s.reciclador.apellido_paterno || ""}`.trim();
            cedulaDisplay = cedulaReciclador;
            esFijo = false;
        } 
        else {
            // CASO 3: MÓVIL PENDIENTE (Sin Asignar)
            key = "PENDIENTE";
            nombreDisplay = "Por Asignar / Pendiente";
            cedulaDisplay = "---";
            esFijo = false;
        }

        if(!mapa[key]) {
            mapa[key] = { 
                nombre: nombreDisplay,
                cedula: cedulaDisplay,
                esFijo: esFijo, 
                entregas: 0,
                canceladas: 0,
                totalKg: 0,
                matCount: {}
            };
        }
        
        mapa[key].entregas++;
        
        const est = s.estado || "";
        if (est === 'CANCELADO' || est === 'RECHAZADO') {
            mapa[key].canceladas++;
        }

        // Sumar kilos de todo lo que tenga detalles (para ver proyección)
        if(s.detalles) {
            s.detalles.forEach(d => {
                mapa[key].totalKg += d.cantidad_kg;
                const mName = d.material ? d.material.nombre : "?";
                mapa[key].matCount[mName] = (mapa[key].matCount[mName] || 0) + d.cantidad_kg;
            });
        }
    });

    const entidadesArray = Object.values(mapa);
    const labelCount = document.getElementById("countRecicladores");
    if(labelCount) labelCount.innerText = entidadesArray.length + " encontrados";

    if(entidadesArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">No hay datos para mostrar con estos filtros.</td></tr>`;
        return;
    }

    entidadesArray.sort((a,b) => b.totalKg - a.totalKg);

    entidadesArray.forEach(r => {
        let topMat = "N/A";
        let maxVal = 0;
        Object.entries(r.matCount).forEach(([k,v]) => {
            if(v > maxVal) { maxVal = v; topMat = k; }
        });

        const resumenEntregas = `${r.entregas} <small style="color:#e74c3c">(${r.canceladas} canc.)</small>`;
        
        const icono = r.esFijo 
            ? '<i class="fa-solid fa-map-pin" style="color:#e67e22; margin-right:5px;"></i>' 
            : '<i class="fa-solid fa-user" style="color:#3498db; margin-right:5px;"></i>';

        const row = `<tr>
            <td>${icono} <strong>${r.nombre}</strong></td>
            <td>${r.cedula}</td>
            <td>${resumenEntregas}</td>
            <td><strong>${r.totalKg.toFixed(1)} Kg</strong></td>
            <td><span style="background:#e8f5e9; color:#2e7d32; padding:3px 8px; border-radius:4px; font-size:0.85rem;">${topMat}</span></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// --- GRÁFICOS (Mantenemos igual pero asegurando que reciban los datos correctos) ---

function generarGraficoMateriales(lista) {
    const matStats = {};
    lista.forEach(s => {
        if(s.detalles) s.detalles.forEach(d => {
            const nombre = d.material ? d.material.nombre : "Otros";
            matStats[nombre] = (matStats[nombre] || 0) + d.cantidad_kg;
        });
    });

    const ctx = document.getElementById('chartMaterialesGlobal').getContext('2d');
    if(chartMatInstance) chartMatInstance.destroy();

    chartMatInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(matStats),
            datasets: [{
                data: Object.values(matStats),
                backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c', '#1abc9c'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
}

function generarGraficoTendencia(lista) {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataMeses = new Array(12).fill(0);
    const anioActual = new Date().getFullYear();

    lista.forEach(s => {
        const fecha = new Date(s.fecha_recoleccion_real || s.fecha_creacion);
        if(fecha.getFullYear() === anioActual) {
            let peso = 0;
            if(s.detalles) s.detalles.forEach(d => peso += d.cantidad_kg);
            dataMeses[fecha.getMonth()] += peso;
        }
    });

    const ctx = document.getElementById('chartTendencia').getContext('2d');
    if(chartTendenciaInstance) chartTendenciaInstance.destroy();

    chartTendenciaInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: `Kilos (${anioActual}) - Vista Actual`,
                data: dataMeses,
                borderColor: '#6DB85C',
                backgroundColor: 'rgba(109, 184, 92, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function generarGraficoTopRecicladores(lista) {
    const recStats = {};
    lista.forEach(s => {
        let nombreEntidad = "Desconocido";
        
        if(s.ubicacion?.id_ubicacion_reciclaje) {
             nombreEntidad = `📍 ${s.ubicacion.nombre}`;
        } else if(s.reciclador?.cedula) {
             nombreEntidad = `👤 ${s.reciclador.primer_nombre} ${s.reciclador.apellido_paterno}`;
        } else {
            nombreEntidad = "⏳ Pendiente Asignación";
        }

        let pesoEntrega = 0;
        if(s.detalles) s.detalles.forEach(d => pesoEntrega += d.cantidad_kg);
        recStats[nombreEntidad] = (recStats[nombreEntidad] || 0) + pesoEntrega;
    });

    const sorted = Object.entries(recStats).sort((a,b) => b[1] - a[1]).slice(0, 5);

    const ctx = document.getElementById('chartTopRecicladores').getContext('2d');
    if(chartTopInstance) chartTopInstance.destroy();

    chartTopInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{
                label: 'Kilos (Kg)',
                data: sorted.map(i => i[1].toFixed(1)),
                backgroundColor: '#3A6958',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { beginAtZero: true } }
        }
    });
}

function generarTopUsuarios(lista) {
    const tbody = document.getElementById("tbodyTopUsuarios");
    if (!tbody) return; 
    
    tbody.innerHTML = "";
    const mapaUsuarios = {};

    lista.forEach(s => {
        // En Top Usuarios solemos querer ver solo lo completado para el ranking
        if ((s.estado !== 'FINALIZADO' && s.estado !== 'COMPLETADA') || !s.solicitante) return;

        const ced = s.solicitante.cedula;

        if (!mapaUsuarios[ced]) {
            mapaUsuarios[ced] = {
                nombre: `${s.solicitante.primer_nombre} ${s.solicitante.apellido_paterno}`,
                cedula: ced,
                rango: s.solicitante.rango ? s.solicitante.rango.nombre_rango : 'Nuevo',
                totalKg: 0,
                puntos: 0
            };
        }

        mapaUsuarios[ced].puntos += (s.puntos_ganados || 0);

        if (s.detalles) {
            s.detalles.forEach(d => {
                mapaUsuarios[ced].totalKg += d.cantidad_kg;
            });
        }
    });

    const ranking = Object.values(mapaUsuarios).sort((a, b) => b.totalKg - a.totalKg);

    const countLabel = document.getElementById("countUsuariosTop");
    if(countLabel) countLabel.innerText = ranking.length + " en ranking";

    if (ranking.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">No hay datos de reciclaje completado.</td></tr>`;
        return;
    }

    ranking.slice(0, 10).forEach((u, index) => {
        let medalla = `<span style="color:#999; font-weight:600;">${index + 1}</span>`;
        if(index === 0) medalla = '🥇';
        if(index === 1) medalla = '🥈';
        if(index === 2) medalla = '🥉';

        const row = `<tr>
            <td style="font-size:1.2rem;">${medalla}</td>
            <td><strong>${u.nombre}</strong></td>
            <td>${u.cedula}</td>
            <td><span class="badge-count">${u.rango}</span></td>
            <td><strong style="color:#2ecc71;">${u.totalKg.toFixed(1)} Kg</strong></td>
            <td style="color:#f1c40f; font-weight:700;">${u.puntos} pts</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function resetearFiltros() {
    document.getElementById('filtroInicio').value = '';
    document.getElementById('filtroFin').value = '';
    document.getElementById('filtroEstado').value = 'TODOS';
    document.getElementById('filtroTipoRecolector').value = 'TODOS'; 
    document.getElementById('filtroReciclador').value = '';
    aplicarFiltros();
}

function descargarPDF() {
    const elemento = document.getElementById('reporteContent');
    const botones = document.querySelectorAll('button, .navbar, .filters-card'); 
    
    botones.forEach(b => b.style.display = 'none');

    const originalBackground = document.body.style.background;
    document.body.style.background = '#ffffff';
    elemento.style.background = '#ffffff';
    elemento.style.padding = '20px';
    elemento.style.maxWidth = '100%'; 

    const canvasElements = document.querySelectorAll('canvas');
    canvasElements.forEach(c => {
        c.style.maxWidth = '500px'; 
        c.style.margin = '0 auto';
    });

    const headerHTML = `
        <div id="pdfHeader" style="text-align:center; margin-bottom:20px; padding-bottom:10px; border-bottom:2px solid #2ecc71;">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
                <img src="../Imagenes/logo_icon.png" style="width:50px; height:50px;"> 
                <div>
                    <h2 style="margin:0; color:#333;">Reporte Oficial Loopi</h2>
                    <p style="margin:0; color:#666; font-size:12px;">Generado el: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        </div>
    `;
    
    elemento.insertAdjacentHTML('afterbegin', headerHTML);

    const opt = {
        margin: [0.5, 0.5, 0.5, 0.5], 
        filename: `Reporte_Loopi_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(elemento).save().then(() => {
        botones.forEach(b => b.style.display = '');
        document.body.style.background = originalBackground;
        elemento.style.background = '';
        elemento.style.padding = '';
        elemento.style.maxWidth = '';
        
        const header = document.getElementById("pdfHeader");
        if(header) header.remove();

        canvasElements.forEach(c => { c.style.maxWidth = ''; c.style.margin = ''; });
        
        Swal.fire({
            icon: 'success',
            title: 'Reporte Descargado',
            text: 'El PDF se ha generado correctamente.',
            timer: 2000,
            showConfirmButton: false
        });
    });
}