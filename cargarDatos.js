const API_URL = 'https://api-loopi.onrender.com/api';

document.addEventListener("DOMContentLoaded", () => {
    cargarMateriales();
    cargarAuspiciantes();
});


async function cargarMateriales() {
    const contenedor = document.getElementById("contenedor-materiales");
    
    try {
        const response = await fetch(`${API_URL}/materiales`);
        
        if (!response.ok) {
            throw new Error("Error al obtener materiales");
        }

        const materiales = await response.json();

        contenedor.innerHTML = "";

        if (materiales.length === 0) {
            contenedor.innerHTML = "<p>No hay materiales registrados aún.</p>";
            return;
        }

        materiales.forEach(mat => {
            let imagenHtml = '';
            
            if (mat.imagen && mat.imagen.length > 50) {
                const limpia = mat.imagen.replace(/(\r\n|\n|\r)/gm, "");
                const src = limpia.startsWith("data:image") ? limpia : `data:image/png;base64,${limpia}`;
                imagenHtml = `<img src="${src}" alt="${mat.nombre}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%;">`;
            } else {
                imagenHtml = `<div class="material-icon blue">♻️</div>`;
            }

            const card = document.createElement("div");
            card.className = "material-card";
            
            card.innerHTML = `
                ${imagenHtml}
                <div>${mat.nombre}</div>
                <div style="font-size: 0.8rem; color: #666;">${mat.descripcion || mat.tipo_material}</div>
                <div style="font-size: 0.7rem; color: #2D5A4A; font-weight: bold; margin-top: 5px;">
                    ${mat.puntos_por_kg} Pts/Kg
                </div>
            `;

            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error("Error:", error);
        contenedor.innerHTML = "<p>Error al cargar los materiales. Intente más tarde.</p>";
    }
}

async function cargarAuspiciantes() {
    const contenedor = document.getElementById("contenedor-auspiciantes");

    try {
        const response = await fetch(`${API_URL}/auspiciantes`);
        
        if (!response.ok) {
            throw new Error("Error al obtener auspiciantes");
        }

        const auspiciantes = await response.json();

        contenedor.innerHTML = "";

        if (auspiciantes.length === 0) {
            contenedor.innerHTML = "<p>Estamos buscando patrocinadores.</p>";
            return;
        }

        auspiciantes.forEach(aus => {
            let imagenSrc = 'https://cdn-icons-png.flaticon.com/512/929/929494.png'; // Placeholder
            
            if (aus.imagen && aus.imagen.length > 20) {
                const limpia = aus.imagen.replace(/(\r\n|\n|\r)/gm, "");
                imagenSrc = limpia.startsWith("data:image") ? limpia : `data:image/png;base64,${limpia}`;
            }

            const card = document.createElement("div");
            card.className = "sponsor-card";

            card.innerHTML = `
                <div class="sponsor-logo" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
                    <img src="${imagenSrc}" alt="${aus.nombre}" style="max-width: 80px; max-height: 80px; object-fit: contain;">
                    <span style="font-size: 1rem; font-weight: bold; color: #333;">${aus.nombre}</span>
                </div>
                <p style="font-size: 0.8rem; text-align: center; color: #666; margin-top: 5px; padding: 0 10px;">
                    ${aus.descripcion || ''}
                </p>
            `;

            contenedor.appendChild(card);
        });

    } catch (error) {
        console.error("Error:", error);
        contenedor.innerHTML = "<p>No se pudieron cargar los patrocinadores.</p>";
    }
}