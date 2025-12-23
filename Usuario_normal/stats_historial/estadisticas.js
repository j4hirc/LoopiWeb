const API_BASE = 'https://api-loopi.onrender.com/api';

document.addEventListener("DOMContentLoaded", async () => {
    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
        window.location.href = "../../incio_de_sesion/login-registro.html";
        return;
    }
    const usuario = JSON.parse(usuarioStr);

    await cargarDatosEstadisticos(usuario.cedula);
});

async function cargarDatosEstadisticos(cedula) {
    try {
        const res = await fetch(`${API_BASE}/solicitud_recolecciones/usuario/${cedula}`);
        
        if (!res.ok) {
            console.error("Error al obtener datos de la API");
            return;
        }

        const data = await res.json();

        const completados = data.filter(s => s.estado === 'FINALIZADO' || s.estado === 'COMPLETADA');

        calcularResumen(completados);

        generarGraficos(completados);

        llenarTablaHistorial(data);

    } catch (e) {
        console.error("Error cargando estadísticas:", e);
        document.getElementById("tbodyHistorial").innerHTML = 
            `<tr><td colspan="5" style="text-align:center; color:red;">Error de conexión</td></tr>`;
    }
}

function calcularResumen(lista) {
    let totalKg = 0;
    let totalPuntos = 0;

    lista.forEach(sol => {
        if (sol.puntos_ganados) totalPuntos += sol.puntos_ganados;
        
        if (sol.detalles) {
            sol.detalles.forEach(d => {
                totalKg += d.cantidad_kg;
            });
        }
    });

    document.getElementById("totalKilos").innerText = totalKg.toFixed(1);
    document.getElementById("totalEntregas").innerText = lista.length;
    document.getElementById("totalPuntos").innerText = totalPuntos;
}

function generarGraficos(lista) {
    const materialStats = {};
    
    lista.forEach(sol => {
        if(sol.detalles) {
            sol.detalles.forEach(d => {
                const nombreMat = d.material ? d.material.nombre : "Otros";
                if(!materialStats[nombreMat]) materialStats[nombreMat] = 0;
                materialStats[nombreMat] += d.cantidad_kg;
            });
        }
    });

    const ctxMat = document.getElementById('chartMateriales').getContext('2d');
    new Chart(ctxMat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(materialStats),
            datasets: [{
                data: Object.values(materialStats),
                backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    const mesesStats = new Array(12).fill(0); // Arreglo de 12 ceros
    const currentYear = new Date().getFullYear();

    lista.forEach(sol => {
        const fecha = new Date(sol.fecha_recoleccion_real || sol.fecha_creacion);
        
        if (fecha.getFullYear() === currentYear) {
            let pesoTotalSol = 0;
            if(sol.detalles) sol.detalles.forEach(d => pesoTotalSol += d.cantidad_kg);
            
            mesesStats[fecha.getMonth()] += pesoTotalSol;
        }
    });

    const ctxMes = document.getElementById('chartMensual').getContext('2d');
    new Chart(ctxMes, {
        type: 'bar',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            datasets: [{
                label: `Kg Reciclados (${currentYear})`,
                data: mesesStats,
                backgroundColor: '#3A6958',
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false } // Ocultamos la leyenda para que se vea más limpio
            }
        }
    });
}

function llenarTablaHistorial(lista) {
    const tbody = document.getElementById("tbodyHistorial");
    tbody.innerHTML = "";

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay actividad reciente.</td></tr>`;
        return;
    }

    lista.sort((a, b) => {
        const dateA = new Date(a.fecha_recoleccion_real || a.fecha_creacion);
        const dateB = new Date(b.fecha_recoleccion_real || b.fecha_creacion);
        return dateB - dateA;
    });

    lista.forEach(sol => {
        const fechaObj = new Date(sol.fecha_recoleccion_real || sol.fecha_creacion);
        const fecha = fechaObj.toLocaleDateString();
        
        let estadoClass = "pendiente";
        if (sol.estado === "FINALIZADO" || sol.estado === "COMPLETADA") estadoClass = "finalizado";
        else if (sol.estado === "ACEPTADA") estadoClass = "aceptada";
        else if (sol.estado === "RECHAZADO") estadoClass = "rechazado";

        let materialesStr = "";
        let pesoTotal = 0;
        if(sol.detalles) {
            sol.detalles.forEach(d => {
                const nombre = d.material ? d.material.nombre : "Material";
                materialesStr += `<span class="material-tag">${nombre} (${d.cantidad_kg}kg)</span>`;
                pesoTotal += d.cantidad_kg;
            });
        }

        const row = `
            <tr>
                <td>${fecha}</td>
                <td><span class="badge-status ${estadoClass}">${sol.estado}</span></td>
                <td>${materialesStr || '<span style="color:#999;font-size:0.8rem;">Sin detalles</span>'}</td>
                <td><strong>${pesoTotal.toFixed(1)} Kg</strong></td>
                <td style="color: #27ae60; font-weight:bold;">+${sol.puntos_ganados || 0}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}