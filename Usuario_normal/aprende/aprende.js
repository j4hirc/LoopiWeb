const API_BASE = 'https://api-loopi.onrender.com/api';
let cardsData = []; 
let currentIndex = 0; 
let isScrolling = false; 

document.addEventListener("DOMContentLoaded", () => {
    cargarMultimedia();
});

async function cargarMultimedia() {
    const contenedor = document.getElementById("grid-multimedia");
    contenedor.innerHTML = '<div class="loader-container"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const res = await fetch(`${API_BASE}/multimedias`);
        if (!res.ok) throw new Error("Error API");
        cardsData = await res.json();
        contenedor.innerHTML = "";

        if (cardsData.length === 0) {
            contenedor.innerHTML = `<h3 style="text-align:center; width:100%;">No hay contenido.</h3>`;
            return;
        }

        cardsData.forEach((item, index) => {
            
            let imgUrl = 'https://via.placeholder.com/400x400?text=Sin+Imagen'; // Default

            if (item.imagenes && item.imagenes.length > 5) {
                if (item.imagenes.startsWith('http') || item.imagenes.startsWith('data:')) {
                    imgUrl = item.imagenes;
                } else {
                    imgUrl = `data:image/png;base64,${item.imagenes}`;
                }
            }


            const card = document.createElement("div");
            card.className = "post-card";
            
            card.onclick = () => {
                if (index === currentIndex) abrirModal(item, imgUrl);
                else {
                    currentIndex = index;
                    actualizarCarrusel();
                }
            };

            card.innerHTML = `
                <div class="img-container">
                    <img src="${imgUrl}" alt="${item.titulo}" onerror="this.src='https://via.placeholder.com/400x400?text=Error'">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${item.titulo}</h3>
                </div>
            `;
            contenedor.appendChild(card);
        });

        currentIndex = Math.floor(cardsData.length / 2);
        actualizarCarrusel();

        const scrollZone = document.querySelector('.main-content');
        if(scrollZone) {
            scrollZone.addEventListener('wheel', (e) => {
                e.preventDefault(); 
                
                if (isScrolling) return; 
                
                isScrolling = true;
                
                if (e.deltaY > 0) {
                    if (currentIndex < cardsData.length - 1) currentIndex++;
                } else {
                    if (currentIndex > 0) currentIndex--;
                }
                
                actualizarCarrusel();
                
                setTimeout(() => { isScrolling = false; }, 300); // Debounce
            }, { passive: false });
        }

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `<p style="text-align:center; color:red">Error de conexión.</p>`;
    }
}

function actualizarCarrusel() {
    const cards = document.querySelectorAll('.post-card');
    const totalCards = cards.length;

    cards.forEach((card, i) => {
        let offset = i - currentIndex;
        
        if (Math.abs(offset) > 3) {
             card.style.opacity = 0;
             card.style.pointerEvents = 'none';
             card.style.transform = `translateX(${offset * 100}px) scale(0.5)`;
             return;
        }

        card.style.opacity = 1;
        card.style.pointerEvents = 'all';

        const spacing = 220; 
        const scaleDown = 0.15; 
        
        let translateX = offset * spacing;
        let scale = 1 - Math.abs(offset) * scaleDown;
        let zIndex = totalCards - Math.abs(offset);
        let translateZ = Math.abs(offset) * -100; 
        let rotateY = offset * -10; 

        card.style.zIndex = zIndex;
        card.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
        
        if(offset === 0) {
             card.style.filter = "brightness(1.1)";
             card.style.border = "4px solid var(--accent)"; // Borde naranja al activo
        } else {
             card.style.filter = "brightness(0.6)"; // Más oscuras las de atrás
             card.style.border = "3px solid #333";
        }
    });
}

function abrirModal(item, imgUrl) {
    const modalImg = document.getElementById("modal-img");
    if(modalImg) modalImg.src = imgUrl;

    const modalTitulo = document.getElementById("modal-titulo");
    if(modalTitulo) modalTitulo.innerText = item.titulo;

    const modalDesc = document.getElementById("modal-desc");
    if(modalDesc) modalDesc.innerText = item.descripcion || "Sin descripción.";

    const modalDetalle = document.getElementById("modal-detalle");
    if(modalDetalle) modalDetalle.style.display = "flex";
}

function cerrarModal(force = false) {
    const modal = document.getElementById("modal-detalle");
    if (modal && (force || event.target.id === "modal-detalle")) {
        modal.style.display = "none";
    }
}