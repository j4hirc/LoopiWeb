const API_BASE = 'https://api-loopi.onrender.com/api';
const gridStats = document.getElementById('gridStats');

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await cargarEstadisticas();
    } catch (e) {
        console.error(e);
        gridStats.innerHTML = `<p style="text-align:center; color:red; grid-column:1/-1;">Error al cargar datos.</p>`;
    }
});

async function cargarEstadisticas() {
    // 1. Obtener todos los canjes (QR_Canje contiene Recompensa -> Auspiciante)
    // Usamos QR_Canje porque representa la acción de "compra/generación" del cupón.
    const res = await fetch(`${API_BASE}/qr_canjeos`);
    
    if (!res.ok) throw new Error("Error API");
    
    const canjes = await res.json();
    
    if (canjes.length === 0) {
        gridStats.innerHTML = `<p style="text-align:center; grid-column:1/-1;">No hay canjes registrados aún.</p>`;
        return;
    }

    // 2. Procesar Datos (Agregación)
    const statsMap = {}; // Mapa: ID_Auspiciante -> Objeto Datos

    canjes.forEach(c => {
        if (!c.recompensa || !c.recompensa.auspiciante) return;

        const ausp = c.recompensa.auspiciante;
        const idAusp = ausp.id_auspiciante;
        const recompensa = c.recompensa;

        // Inicializar si no existe
        if (!statsMap[idAusp]) {
            statsMap[idAusp] = {
                id: idAusp,
                nombre: ausp.nombre,
                logo: ausp.imagen, // Asumiendo que la entidad tiene 'imagen'
                totalCanjes: 0,
                recompensasCount: {} // Mapa: ID_Recompensa -> {nombre, count}
            };
        }

        // Incrementar total del auspiciante
        statsMap[idAusp].totalCanjes++;

        // Contar recompensa específica
        const idRec = recompensa.id_recompensa;
        if (!statsMap[idAusp].recompensasCount[idRec]) {
            statsMap[idAusp].recompensasCount[idRec] = {
                nombre: recompensa.nombre,
                count: 0
            };
        }
        statsMap[idAusp].recompensasCount[idRec].count++;
    });

    // 3. Convertir a Array y Ordenar
    const listaStats = Object.values(statsMap).sort((a, b) => b.totalCanjes - a.totalCanjes);

    // 4. Actualizar Header (KPIs)
    document.getElementById("totalCanjes").innerText = canjes.length;
    if (listaStats.length > 0) {
        document.getElementById("topAuspiciante").innerText = listaStats[0].nombre;
    }

    // 5. Renderizar Gráfico
    renderizarGrafico(listaStats);

    // 6. Renderizar Grid
    renderizarTarjetas(listaStats);
}

function renderizarGrafico(datos) {
    const ctx = document.getElementById('chartAuspiciantes').getContext('2d');
    
    // Top 5 para el gráfico para que no se sature
    const top5 = datos.slice(0, 5);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top5.map(d => d.nombre),
            datasets: [{
                label: 'Cantidad de Canjes',
                data: top5.map(d => d.totalCanjes),
                backgroundColor: [
                    '#3A6958', '#6DB85C', '#2ecc71', '#3498db', '#f1c40f'
                ],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderizarTarjetas(lista) {
    gridStats.innerHTML = "";

    lista.forEach(ausp => {
        // Encontrar la recompensa más canjeada de este auspiciante
        let mejorRecompensa = { nombre: "N/A", count: 0 };
        
        Object.values(ausp.recompensasCount).forEach(r => {
            if (r.count > mejorRecompensa.count) {
                mejorRecompensa = r;
            }
        });

        // Imagen por defecto si falla o no tiene
        let imgUrl = 'https://cdn-icons-png.flaticon.com/512/747/747543.png';
        if (ausp.logo && ausp.logo.length > 5) {
            if (ausp.logo.startsWith("http") || ausp.logo.startsWith("data:")) {
                imgUrl = ausp.logo;
            } else {
                imgUrl = `data:image/png;base64,${ausp.logo}`;
            }
        }

        const card = document.createElement('div');
        card.className = 'card-stat';
        card.innerHTML = `
            <div class="card-top">
                <img src="${imgUrl}" class="ausp-logo" alt="${ausp.nombre}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/747/747543.png'">
                <div class="ausp-info">
                    <h3>${ausp.nombre}</h3>
                    <span>Socio Estratégico</span>
                </div>
            </div>

            <div class="stat-row">
                <span class="stat-label">Total Canjes</span>
                <span class="stat-number">${ausp.totalCanjes}</span>
            </div>

            <div class="best-reward">
                <small><i class="fa-solid fa-crown" style="color:gold"></i> Recompensa más popular:</small>
                <div class="reward-name">
                    ${mejorRecompensa.nombre}
                    <span style="font-size:0.8em; color:#999; font-weight:400;">(${mejorRecompensa.count} veces)</span>
                </div>
            </div>
        `;
        gridStats.appendChild(card);
    });
}