const API_URL = 'https://api-loopi.onrender.com/api/favoritos'; 

document.addEventListener('DOMContentLoaded', () => {
    const usuarioStr = localStorage.getItem("usuario");
    if (!usuarioStr) {
        window.location.href = "../incio_de_sesion/login-registro.html";
        return;
    }
    const usuarioLogueado = JSON.parse(usuarioStr);
    fetchFavoritos(usuarioLogueado.cedula);
});

async function fetchFavoritos(cedula) {
    try {
        const response = await fetch(`${API_URL}/usuario/${cedula}`);
        if (!response.ok) throw new Error('Error API');
        const data = await response.json();
        renderCards(data);
    } catch (error) {
        console.error(error);
        document.getElementById('gridFavoritos').innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:red;">Ups, hubo un error al cargar tus favoritos.</div>';
    }
}

function renderCards(favoritos) {
    const container = document.getElementById('gridFavoritos');
    container.innerHTML = ''; 

    if(!favoritos || favoritos.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        return;
    }
    
    document.getElementById('emptyState').style.display = 'none';

    favoritos.forEach(fav => {
        // Manejo de IDs
        const idParaBorrar = fav.id_favorito || fav.idFavorito || fav.id;
        
        // Manejo de Ubicación
        let infoUbicacion = fav.ubicacion || fav.ubicacionReciclaje || {};
        const idUbicacionReal = infoUbicacion.id_ubicacion_reciclaje || infoUbicacion.id;
        const nombreLugar = infoUbicacion.nombre || 'Punto Guardado';
        const direccion = infoUbicacion.direccion || 'Sin dirección registrada';
        
        // --- 📸 MANEJO DE IMAGEN (AQUÍ ESTÁ LO NUEVO) ---
        // Buscamos la propiedad de imagen. Si no existe, usamos una por defecto.
        // Nota: Asegúrate que tu API devuelva 'imagen_url' o 'foto'. Ajusta la propiedad si es necesario.
        let imagenSrc = infoUbicacion.imagen_url || infoUbicacion.foto || infoUbicacion.imagen;
        
        // Imagen por defecto si viene null o vacía
        if (!imagenSrc) {
            imagenSrc = 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=600&auto=format&fit=crop'; 
        }

        const card = document.createElement('div');
        card.className = 'favorito-card';
        card.id = `card-${idParaBorrar}`; 

        // Insertamos el HTML con la imagen arriba
        card.innerHTML = `
            <div class="card-image-container">
                <span class="badge-overlay">Reciclaje</span>
                <img src="${imagenSrc}" 
                     alt="${nombreLugar}" 
                     class="card-image"
                     onerror="this.src='https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=600&auto=format&fit=crop'">
            </div>

            <div class="card-content">
                <h3>${nombreLugar}</h3>
                <div class="card-address">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${direccion}</span>
                </div>

                <div class="card-actions">
                    <button class="btn btn-request" onclick="irASolicitar(${idUbicacionReal})">
                        <i class="fa-solid fa-recycle"></i> Solicitar
                    </button>

                    <button class="btn btn-delete" onclick="eliminarFavorito(${idParaBorrar})" title="Eliminar favorito">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function irASolicitar(idUbicacion) {
    if(!idUbicacion) {
        Swal.fire('Atención', 'Información de ubicación incompleta.', 'warning');
        return;
    }
    localStorage.setItem('preSelectedUbicacionId', idUbicacion);
    window.location.href = '../solicitud_recoleccion/nueva_solicitud.html';
}

async function eliminarFavorito(id) {
    const confirmResult = await Swal.fire({
        title: '¿Eliminar favorito?',
        text: "Ya no lo verás en tu lista rápida.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e53935',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        
        if (response.ok) {
            const card = document.getElementById(`card-${id}`);
            // Animación de salida
            card.style.transform = 'scale(0.8) translateY(20px)';
            card.style.opacity = '0';
            
            setTimeout(() => {
                card.remove();
                // Verificar si quedó vacío
                if(document.getElementById('gridFavoritos').children.length === 0) {
                    document.getElementById('emptyState').style.display = 'block';
                }
            }, 300);
            
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
            Toast.fire({ icon: 'success', title: 'Eliminado correctamente' });
        } else {
            Swal.fire('Error', 'No se pudo eliminar el favorito', 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}