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
    const res = await fetch(`${API_BASE}/qr_canjeos`);
    if (!res.ok) throw new Error("Error API");
    
    const canjes = await res.json();
    
    if (canjes.length === 0) {
        gridStats.innerHTML = `<p style="text-align:center; grid-column:1/-1; padding:40px; color:#64748b;">No hay canjes registrados aún.</p>`;
        document.getElementById("totalCanjes").innerText = "0";
        document.getElementById("topAuspiciante").innerText = "-";
        return;
    }

    const statsMap = {}; 

    canjes.forEach(c => {
        if (!c.recompensa || !c.recompensa.auspiciante) return;

        const ausp = c.recompensa.auspiciante;
        const idAusp = ausp.id_auspiciante;
        const recompensa = c.recompensa;

        if (!statsMap[idAusp]) {
            statsMap[idAusp] = {
                id: idAusp,
                nombre: ausp.nombre,
                logo: ausp.imagen,
                totalCanjes: 0,
                recompensasCount: {} 
            };
        }

        statsMap[idAusp].totalCanjes++;

        const idRec = recompensa.id_recompensa;
        if (!statsMap[idAusp].recompensasCount[idRec]) {
            statsMap[idAusp].recompensasCount[idRec] = {
                nombre: recompensa.nombre,
                count: 0
            };
        }
        statsMap[idAusp].recompensasCount[idRec].count++;
    });

    const listaStats = Object.values(statsMap).sort((a, b) => b.totalCanjes - a.totalCanjes);

    document.getElementById("totalCanjes").innerText = canjes.length;
    if (listaStats.length > 0) {
        document.getElementById("topAuspiciante").innerText = listaStats[0].nombre;
    }

    renderizarGrafico(listaStats);
    renderizarTarjetas(listaStats);
}

function renderizarGrafico(datos) {
    const ctx = document.getElementById('chartAuspiciantes').getContext('2d');
    const top5 = datos.slice(0, 5);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top5.map(d => d.nombre),
            datasets: [{
                label: 'Canjes Realizados',
                data: top5.map(d => d.totalCanjes),
                backgroundColor: '#3A6958',
                borderRadius: 8,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#F1F5F9' },
                    ticks: { precision: 0, font: {family: 'Poppins'} }
                },
                x: { 
                    grid: { display: false },
                    ticks: { font: {family: 'Poppins'} }
                }
            }
        }
    });
}

function renderizarTarjetas(lista) {
    gridStats.innerHTML = "";

    lista.forEach((ausp, index) => {
        let mejorRecompensa = { nombre: "Sin datos", count: 0 };
        Object.values(ausp.recompensasCount).forEach(r => {
            if (r.count > mejorRecompensa.count) mejorRecompensa = r;
        });

        let imgUrl = 'https://cdn-icons-png.flaticon.com/512/747/747543.png';
        if (ausp.logo && ausp.logo.length > 5) {
            if (ausp.logo.startsWith("http") || ausp.logo.startsWith("data:")) {
                imgUrl = ausp.logo;
            } else {
                imgUrl = `data:image/png;base64,${ausp.logo}`;
            }
        }

        const card = document.createElement('div');
        card.className = 'brand-card';
        
        let trophyClass = "fa-medal";
        if(index === 0) trophyClass = "fa-trophy";
        
        card.innerHTML = `
            <div class="card-top">
                <div class="logo-box">
                    <img src="${imgUrl}" alt="${ausp.nombre}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/747/747543.png'">
                </div>
                <div class="brand-info">
                    <h4>${ausp.nombre}</h4>
                    <span class="rank-badge">Ranking #${index + 1}</span>
                </div>
            </div>

            <div class="card-stats">
                <div class="stat-item">
                    <span>Total Canjes</span>
                    <strong>${ausp.totalCanjes}</strong>
                </div>
                <div class="stat-icon">
                    <i class="fa-solid ${trophyClass} medal-icon"></i>
                </div>
            </div>

            <div class="card-footer">
                <span class="footer-label">Favorito del Público</span>
                <div class="reward-info">
                    <div class="reward-name">
                        <i class="fa-solid fa-gift"></i> ${mejorRecompensa.nombre}
                    </div>
                    <div class="reward-count">
                        x${mejorRecompensa.count}
                    </div>
                </div>
            </div>
        `;
        gridStats.appendChild(card);
    });
}

function descargarPDF() {
    const btn = document.querySelector('.btn-export');
    const originalText = btn.innerHTML;
    
    // 1. Feedback visual de carga
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    const element = document.getElementById('reporteContent');
    const hoy = new Date();
    
    // Formato de fecha legible para el footer
    const fechaTexto = hoy.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    // Formato de fecha para el archivo
    const fechaArchivo = hoy.toISOString().slice(0,10); 
    
    // Mostrar footer temporalmente
    const footer = document.querySelector('.pdf-footer');
    if(footer) footer.style.display = 'block';
    document.getElementById('fechaReporte').innerText = fechaTexto;

    const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4], // Margen equilibrado
        filename:     `Reporte_Auspiciantes_${fechaArchivo}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2,             // Mejor resolución
            useCORS: true,        // IMPORTANTE: Para que salgan las imágenes externas
            letterRendering: true,
            scrollY: 0            // Asegura imprimir desde arriba
        },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Evita que se corten las tarjetas
    };

    html2pdf().set(opt).from(element).save()
        .then(() => {
            // Restaurar botón y ocultar footer
            if(footer) footer.style.display = 'none';
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            // Alerta bonita
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: 'Reporte descargado correctamente'
            });
        })
        .catch(err => {
            console.error('Error PDF:', err);
            if(footer) footer.style.display = 'none';
            btn.innerHTML = originalText;
            btn.disabled = false;
            Swal.fire('Error', 'No se pudo generar el PDF.', 'error');
        });
}