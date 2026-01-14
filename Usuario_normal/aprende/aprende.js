const API_BASE = 'https://api-loopi.onrender.com/api';
let cardsData = []; 
let currentIndex = 0; 
let isAnimating = false;

// Variables para Touch (Swipe)
let touchstartX = 0;
let touchendX = 0;

document.addEventListener("DOMContentLoaded", () => {
    cargarMultimedia();
    
    // Eventos de Teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') moverCarrusel(-1);
        if (e.key === 'ArrowRight') moverCarrusel(1);
    });

    // Eventos Touch para Móviles
    const zone = document.getElementById('gesture-zone');
    zone.addEventListener('touchstart', e => touchstartX = e.changedTouches[0].screenX);
    zone.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleGesture();
    });
});

function handleGesture() {
    if (touchendX < touchstartX - 50) moverCarrusel(1); // Swipe Izquierda (Siguiente)
    if (touchendX > touchstartX + 50) moverCarrusel(-1); // Swipe Derecha (Anterior)
}

async function cargarMultimedia() {
    const contenedor = document.getElementById("grid-multimedia");
    try {
        const res = await fetch(`${API_BASE}/multimedias`);
        if (!res.ok) throw new Error("Error API");
        cardsData = await res.json();
        
        contenedor.innerHTML = "";

        if (cardsData.length === 0) {
            contenedor.innerHTML = "<h3>No hay tips por ahora :(</h3>";
            return;
        }

        cardsData.forEach((item, index) => {
            // Manejo de imagen robusto
            let imgUrl = 'https://via.placeholder.com/400x400?text=Loopi';
            if (item.imagenes && item.imagenes.length > 5) {
                imgUrl = (item.imagenes.startsWith('http') || item.imagenes.startsWith('data:')) 
                    ? item.imagenes 
                    : `data:image/png;base64,${item.imagenes}`;
            }

            const card = document.createElement("div");
            card.className = "post-card";
            // Al hacer click: si es la activa abre modal, si no, la enfoca
            card.onclick = () => {
                if (index === currentIndex) abrirModal(item, imgUrl);
                else {
                    currentIndex = index;
                    actualizarCarrusel();
                }
            };

            card.innerHTML = `
                <div class="img-container">
                    <img src="${imgUrl}" loading="lazy" alt="Tip">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${item.titulo}</h3>
                </div>
            `;
            contenedor.appendChild(card);
        });

        // Centrar al inicio
        currentIndex = Math.floor(cardsData.length / 2);
        actualizarCarrusel();

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `<p>Error de conexión ñaño :(</p>`;
    }
}

function moverCarrusel(direction) {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < cardsData.length) {
        currentIndex = newIndex;
        actualizarCarrusel();
    }
}

function actualizarCarrusel() {
    const cards = document.querySelectorAll('.post-card');
    const width = window.innerWidth < 768 ? 260 : 300; // Ancho base de tarjeta
    const spacing = window.innerWidth < 768 ? 40 : 120; // Espaciado entre cartas

    cards.forEach((card, i) => {
        const offset = i - currentIndex;
        
        // Optimización: Ocultar las que están muy lejos para rendimiento
        if (Math.abs(offset) > 3) {
            card.style.opacity = 0;
            card.style.pointerEvents = 'none';
        } else {
            card.style.opacity = 1;
            card.style.pointerEvents = 'all';
        }

        // Matemáticas del Carrusel "Cover Flow"
        const translateX = offset * spacing;
        const scale = 1 - Math.abs(offset) * 0.15; // Se hacen más pequeñas las de atrás
        const rotateY = offset * -5; // Rotación sutil
        const zIndex = 100 - Math.abs(offset); // Las del centro encima

        // Filtros visuales para profundidad
        const blur = Math.abs(offset) * 2;
        const brightness = 1 - Math.abs(offset) * 0.15;

        card.style.zIndex = zIndex;
        card.style.transform = `translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`;
        card.style.filter = `blur(${blur}px) brightness(${brightness})`;
        
        // Resetear borde si es la activa
        if(offset === 0) {
            card.style.borderColor = "#000";
            card.style.cursor = "zoom-in";
        } else {
            card.style.borderColor = "transparent";
            card.style.cursor = "pointer";
        }
    });
}

function abrirModal(item, imgUrl) {
    document.getElementById("modal-img").src = imgUrl;
    document.getElementById("modal-titulo").innerText = item.titulo;
    document.getElementById("modal-desc").innerText = item.descripcion || "Sin detalles.";
    document.getElementById("modal-detalle").style.display = "flex";
}

function cerrarModal(force) {
    if (force || event.target.id === "modal-detalle") {
        document.getElementById("modal-detalle").style.display = "none";
    }
}