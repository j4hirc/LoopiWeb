const API_BASE = 'https://api-loopi.onrender.com/api';

let datosCrudos = [];
let usuariosTotal = 0;
let chartMatInstance = null;
let chartTopInstance = null;
let chartTendenciaInstance = null;
const aplicarFiltrosDebounced = debounce(aplicarFiltros, 300);

const RUTA_LOGO_LOCAL = "../../Imagenes/Logo.png";

document.addEventListener("DOMContentLoaded", async () => {
    await cargarTodo();
    document.getElementById('filtroInicio').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroFin').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroTipo').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroReciclador').addEventListener('keyup', aplicarFiltrosDebounced);
});

function debounce(fn, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

async function cargarTodo() {
    try {
        const [resSol, resUs] = await Promise.all([
            fetch(`${API_BASE}/solicitud_recolecciones`),
            fetch(`${API_BASE}/usuarios`)
        ]);

        if (!resSol.ok) throw new Error("Error fetching solicitudes");

        datosCrudos = await resSol.json();
        procesarDatos();

        if (resUs.ok) {
            const users = await resUs.json();
            usuariosTotal = users.length;
        }

        aplicarFiltrosInicial();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    }
}


function aplicarFiltrosInicial() {
    const filtrados = datosProcesados;

    actualizarKPIsInicial(filtrados);

    requestAnimationFrame(() => {
        generarGraficoMateriales(filtrados.filter(s =>
            s.estado === 'FINALIZADO' || s.estado === 'COMPLETADA'
        ));
    });

    requestAnimationFrame(() => {
        generarGraficoTendencia(filtrados);
        generarGraficoTopRecicladores(filtrados);
    });

    setTimeout(() => {
        generarTablaRecicladores(filtrados);
        generarTopUsuarios(filtrados);
    }, 0);
}

function actualizarKPIsInicial(datos) {
    let totalKg = 0;
    let totalPuntos = 0;
    let finalizados = 0;

    for (const s of datos) {
        if (s.estado === 'FINALIZADO' || s.estado === 'COMPLETADA') {
            finalizados++;
            totalPuntos += (s.puntos_ganados || 0);
            totalKg += (s._totalKg || 0); // 🔥 ya procesado
        }
    }

    document.getElementById("totalKgGlobal").innerText = totalKg.toFixed(1);
    document.getElementById("totalUsuarios").innerText = usuariosTotal;
    document.getElementById("totalRecolecciones").innerText = datos.length;
    document.getElementById("totalPuntos").innerText = totalPuntos;
}

let datosProcesados = [];

function procesarDatos() {
    datosProcesados = datosCrudos.map(s => {
        let totalKg = 0;
        if (s.detalles) {
            for (const d of s.detalles) totalKg += d.cantidad_kg;
        }

        return {
            ...s,
            _fecha: new Date(s.fecha_recoleccion_real || s.fecha_creacion),
            _totalKg: totalKg,
            _anio: new Date(s.fecha_recoleccion_real || s.fecha_creacion).getFullYear(),
            _mes: new Date(s.fecha_recoleccion_real || s.fecha_creacion).getMonth()
        };
    });
}

function aplicarFiltros() {
    const fInicio = document.getElementById('filtroInicio').value;
    const fFin = document.getElementById('filtroFin').value;
    const tipo = document.getElementById('filtroTipo').value;
    const busqueda = document.getElementById('filtroReciclador').value.toLowerCase();

    const dInicio = fInicio ? new Date(fInicio) : null;
    const dFin = fFin ? new Date(fFin + 'T23:59:59') : null;

    const filtrados = datosProcesados.filter(item => {

        if (dInicio && item._fecha < dInicio) return false;
        if (dFin && item._fecha > dFin) return false;

        if (tipo !== "TODOS") {
            if (tipo === "RECICLADOR" && !item.reciclador) return false;
            if (tipo === "PUNTO_FIJO" && (!item.ubicacion || item.reciclador)) return false;
        }

        if (busqueda) {
            let texto = '';
            if (item.reciclador) {
                texto = `${item.reciclador.cedula} ${item.reciclador.primer_nombre} ${item.reciclador.apellido_paterno}`.toLowerCase();
            } else if (item.ubicacion) {
                texto = item.ubicacion.nombre.toLowerCase();
            }
            if (!texto.includes(busqueda)) return false;
        }

        return true;
    });

    actualizarDashboard(filtrados);
}

function actualizarDashboard(datos) {
    const finalizados = datos.filter(s => s.estado === 'FINALIZADO' || s.estado === 'COMPLETADA');
    let totalKg = 0;
    let totalPuntos = 0;
    finalizados.forEach(s => {
        totalPuntos += (s.puntos_ganados || 0);
        totalKg += (s._totalKg || 0);
    });
    document.getElementById("totalKgGlobal").innerText = totalKg.toFixed(1);
    document.getElementById("totalUsuarios").innerText = usuariosTotal;
    document.getElementById("totalRecolecciones").innerText = datos.length;
    document.getElementById("totalPuntos").innerText = totalPuntos;
    generarGraficoMateriales(finalizados);
    generarGraficoTopRecicladores(finalizados);
    generarGraficoTendencia(finalizados);
    generarTablaRecicladores(datos);
    generarTopUsuarios(datos);
}

function generarGraficoMateriales(lista) {
    const matStats = {};

    lista.forEach(s => {
        if (s.detalles) {
            s.detalles.forEach(d => {
                const nombre = d.material ? d.material.nombre : "Otros";
                matStats[nombre] = (matStats[nombre] || 0) + d.cantidad_kg;
            });
        }
    });

    const labels = Object.keys(matStats);
    const data = Object.values(matStats);

    const ctx = document
        .getElementById('chartMaterialesGlobal')
        .getContext('2d');

    if (!chartMatInstance) {
        chartMatInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: [
                        '#2ecc71', '#3498db', '#9b59b6',
                        '#f1c40f', '#e74c3c', '#1abc9c'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    } else {
        chartMatInstance.data.labels = labels;
        chartMatInstance.data.datasets[0].data = data;
        chartMatInstance.update();
    }
}

function generarGraficoTendencia(lista) {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataMeses = new Array(12).fill(0);
    const anioActual = new Date().getFullYear();

    lista.forEach(s => {
        const fecha = new Date(s.fecha_recoleccion_real || s.fecha_creacion);
        if (fecha.getFullYear() === anioActual) {
            let peso = 0;
            if (s.detalles) s.detalles.forEach(d => peso += d.cantidad_kg);
            dataMeses[fecha.getMonth()] += peso;
        }
    });

    const ctx = document.getElementById('chartTendencia').getContext('2d');

    if (!chartTendenciaInstance) {
        chartTendenciaInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: meses,
                datasets: [{
                    label: `Kilos Reciclados ${anioActual}`,
                    data: dataMeses,
                    borderColor: '#6DB85C',
                    backgroundColor: 'rgba(109,184,92,0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    } else {
        chartTendenciaInstance.data.datasets[0].data = dataMeses;
        chartTendenciaInstance.update();
    }
}

function generarGraficoTopRecicladores(lista) {
    const recStats = {};

    lista.forEach(s => {
        let nombre = s.reciclador
            ? `👤 ${s.reciclador.primer_nombre} ${s.reciclador.apellido_paterno}`
            : s.ubicacion
                ? `📍 ${s.ubicacion.nombre}`
                : null;
        if (!nombre) return;

        let peso = 0;
        if (s.detalles) s.detalles.forEach(d => peso += d.cantidad_kg);
        recStats[nombre] = (recStats[nombre] || 0) + peso;
    });

    const sorted = Object.entries(recStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const ctx = document.getElementById('chartTopRecicladores').getContext('2d');

    if (!chartTopInstance) {
        chartTopInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(i => i[0]),
                datasets: [{
                    label: 'Kilos Recolectados (Kg)',
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
    } else {
        chartTopInstance.data.labels = sorted.map(i => i[0]);
        chartTopInstance.data.datasets[0].data = sorted.map(i => i[1].toFixed(1));
        chartTopInstance.update();
    }
}

function generarTablaRecicladores(lista) {
    const tbody = document.getElementById("tbodyRecicladores");
    tbody.innerHTML = "";
    const mapa = {};
    lista.forEach(s => {
        let key = "";
        let nombreDisplay = "";
        let cedulaDisplay = "";
        if (s.reciclador) {
            key = "R_" + s.reciclador.cedula;
            nombreDisplay = `${s.reciclador.primer_nombre} ${s.reciclador.apellido_paterno}`;
            cedulaDisplay = s.reciclador.cedula;
        } else if (s.ubicacion) {
            key = "U_" + s.ubicacion.id_ubicacion_reciclaje;
            nombreDisplay = s.ubicacion.nombre;
            cedulaDisplay = "Punto Fijo";
        } else {
            return;
        }
        if (!mapa[key]) {
            mapa[key] = {
                nombre: nombreDisplay,
                cedula: cedulaDisplay,
                entregas: 0,
                canceladas: 0,
                totalKg: 0,
                matCount: {}
            };
        }
        mapa[key].entregas++;
        if (s.estado === 'CANCELADO' || s.estado === 'RECHAZADO') {
            mapa[key].canceladas++;
        }
        if (s.estado === 'FINALIZADO' && s.detalles) {
            s.detalles.forEach(d => {
                mapa[key].totalKg += d.cantidad_kg;
                const mName = d.material ? d.material.nombre : "?";
                mapa[key].matCount[mName] = (mapa[key].matCount[mName] || 0) + d.cantidad_kg;
            });
        }
    });
    const entidadesArray = Object.values(mapa);
    document.getElementById("countRecicladores").innerText = entidadesArray.length + " activos";
    if (entidadesArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">No hay datos para mostrar.</td></tr>`;
        return;
    }
    entidadesArray.sort((a, b) => b.totalKg - a.totalKg);
    entidadesArray.forEach(r => {
        let topMat = "N/A";
        let maxVal = 0;
        Object.entries(r.matCount).forEach(([k, v]) => {
            if (v > maxVal) { maxVal = v; topMat = k; }
        });
        const resumenEntregas = `${r.entregas} <small style="color:#e74c3c">(${r.canceladas} canc.)</small>`;
        const icono = r.cedula === "Punto Fijo" ? '<i class="fa-solid fa-map-pin" style="color:#e67e22"></i>' : '<i class="fa-solid fa-user" style="color:#3498db"></i>';
        const row = `<tr>
            <td>${icono} <strong>${r.nombre}</strong></td>
            <td>${r.cedula}</td>
            <td>${resumenEntregas}</td>
            <td>${r.totalKg.toFixed(1)} Kg</td>
            <td><span style="background:#e8f5e9; color:#2e7d32; padding:3px 8px; border-radius:4px; font-size:0.85rem;">${topMat}</span></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function generarTopUsuarios(lista) {
    const tbody = document.getElementById("tbodyTopUsuarios");
    if (!tbody) return;
    tbody.innerHTML = "";
    const mapaUsuarios = {};
    lista.forEach(s => {
        if (s.estado !== 'FINALIZADO' || !s.solicitante) return;
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
    if (countLabel) countLabel.innerText = ranking.length + " en ranking";
    if (ranking.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">No hay datos de reciclaje completado.</td></tr>`;
        return;
    }
    ranking.slice(0, 10).forEach((u, index) => {
        let medalla = `<span style="color:#999; font-weight:600;">${index + 1}</span>`;
        if (index === 0) medalla = '🥇';
        if (index === 1) medalla = '🥈';
        if (index === 2) medalla = '🥉';
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
    document.getElementById('filtroTipo').value = 'TODOS';
    document.getElementById('filtroReciclador').value = '';
    aplicarFiltros();
}

async function cargarImagenComoBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("No se pudo cargar la imagen del logo:", e);
        return null;
    }
}

// --- FUNCIÓN MEJORADA CON FILTROS EN EL HEADER ---
async function descargarPDF() {
    const elemento = document.getElementById('reporteContent');
    const botones = document.querySelectorAll('button, .navbar, .filters-card');

    // Ocultar elementos UI
    botones.forEach(b => b.style.display = 'none');

    // Capturar valores de los filtros para el encabezado
    const fInicio = document.getElementById('filtroInicio').value || 'Sin restricción';
    const fFin = document.getElementById('filtroFin').value || 'Sin restricción';
    const comboTipo = document.getElementById('filtroTipo');
    const tipoTexto = comboTipo.options[comboTipo.selectedIndex].text;
    const busqueda = document.getElementById('filtroReciclador').value || '(Ninguna)';

    const originalBackground = document.body.style.background;
    const originalPadding = elemento.style.padding;

    document.body.style.background = '#ffffff';
    elemento.style.background = '#ffffff';
    elemento.style.padding = '30px';
    elemento.style.maxWidth = '100%';

    // Inyectar CSS
    const estiloImpresion = document.createElement('style');
    estiloImpresion.innerHTML = `
        body { font-family: 'Poppins', Helvetica, sans-serif !important; color: #333; }
        h1, h2, h3, h4 { color: #2c3e50; }
        .kpi-card { border: 1px solid #ddd; box-shadow: none !important; background: #fdfdfd !important; page-break-inside: avoid; }
        .table-responsive { overflow: visible !important; }
        table { font-size: 11px; width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background-color: #2ecc71 !important; color: #ffffff !important; padding: 10px; border: 1px solid #27ae60; }
        td { border: 1px solid #eee; padding: 8px; vertical-align: middle; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .page-title, .page-subtitle { display: none; }
        .report-header { margin-bottom: 0; }
        .chart-card { page-break-inside: avoid; border: 1px solid #eee; }
    `;
    document.head.appendChild(estiloImpresion);

    // Ajustar gráficas
    const canvasElements = document.querySelectorAll('canvas');
    canvasElements.forEach(c => {
        c.style.maxWidth = '550px';
        c.style.maxHeight = '350px';
        c.style.margin = '0 auto 20px auto';
    });

    let logoImgTag = '';
    const logoBase64 = await cargarImagenComoBase64(RUTA_LOGO_LOCAL);

    if (logoBase64) {
        logoImgTag = `<img src="${logoBase64}" style="width: 70px; height: auto; display: block;">`;
    } else {
        logoImgTag = `<div style="font-weight:bold; color:#2ecc71;">LOOPI</div>`;
    }

    const headerHTML = `
        <div id="pdfHeader" style="padding: 20px 0; border-bottom: 4px solid #2ecc71; margin-bottom: 30px; font-family: Helvetica, Arial, sans-serif;">
            <div style="display:flex; align-items:center; justify-content: space-between; margin-bottom: 15px;">
                <div style="display:flex; align-items:center; gap: 20px;">
                    ${logoImgTag}
                    <div>
                        <h1 style="margin: 0; color: #2c3e50; font-size: 28px; font-weight: bold;">Reporte Oficial Loopi</h1>
                        <p style="margin: 5px 0 0; color: #7f8c8d; font-size: 12px;">Generado el: ${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</p>
                    </div>
                </div>
                <div style="text-align:right; font-size:10px; color:#999;">
                    <p>Documento Confidencial</p>
                    <p>Sistema Admin</p>
                </div>
            </div>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; font-size: 11px; color: #166534;">
                <table style="width:100%; border:none; margin:0;">
                    <tr style="background:transparent;">
                        <td style="border:none; padding:4px;"><strong>Desde:</strong> ${fInicio}</td>
                        <td style="border:none; padding:4px;"><strong>Hasta:</strong> ${fFin}</td>
                        <td style="border:none; padding:4px;"><strong>Tipo:</strong> ${tipoTexto}</td>
                        <td style="border:none; padding:4px;"><strong>Búsqueda:</strong> ${busqueda}</td>
                    </tr>
                </table>
            </div>
        </div>
    `;

    elemento.insertAdjacentHTML('afterbegin', headerHTML);

    const opt = {
        margin: [0.4, 0.4],
        filename: `Reporte_Loopi_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollY: 0
        },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(elemento).save().then(() => {
        botones.forEach(b => b.style.display = '');
        document.body.style.background = originalBackground;
        elemento.style.background = '';
        elemento.style.padding = originalPadding;
        elemento.style.maxWidth = '';

        document.head.removeChild(estiloImpresion);
        const header = document.getElementById("pdfHeader");
        if (header) header.remove();

        canvasElements.forEach(c => {
            c.style.maxWidth = '';
            c.style.maxHeight = '';
            c.style.margin = '';
        });

        Swal.fire({
            icon: 'success',
            title: 'Reporte Descargado',
            text: '¡Reporte con filtros incluido, papu!',
            timer: 2000,
            showConfirmButton: false
        });
    });
}