const BASE_URL = 'https://api-loopi.onrender.com';

const API_URL = `${BASE_URL}/api/multimedias`;

const grid = document.getElementById('gridMultimedia');
const modal = document.getElementById('modalOverlay');
const btnNuevo = document.getElementById('btnNuevo');
const btnCerrar = document.getElementById('btnCerrar');
const btnCancelar = document.getElementById('btnCancelar');
const btnGuardar = document.getElementById('btnGuardar');

const idInput = document.getElementById('idMultimedia');
const imagenInput = document.getElementById('imagen');
const tituloInput = document.getElementById('titulo');
const descripcionInput = document.getElementById('descripcion');
const previewImg = document.getElementById('previewImg');
const searchInput = document.getElementById('searchInput');

let cache = [];

document.addEventListener('DOMContentLoaded', cargar);

btnNuevo.onclick = abrirModal;
btnCerrar.onclick = cerrarModal;
btnCancelar.onclick = cerrarModal;
btnGuardar.onclick = guardar;

imagenInput.onchange = () => {
    const file = imagenInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => previewImg.style.backgroundImage = `url(${e.target.result})`;
        reader.readAsDataURL(file);
    }
};

searchInput.oninput = () => {
    const t = searchInput.value.toLowerCase();
    render(cache.filter(m =>
        m.titulo.toLowerCase().includes(t) ||
        m.descripcion.toLowerCase().includes(t)
    ));
};

function abrirModal() {
    modal.style.display = 'flex';
}

function cerrarModal() {
    modal.style.display = 'none';
    idInput.value = '';
    tituloInput.value = '';
    descripcionInput.value = '';
    imagenInput.value = '';
    previewImg.style.backgroundImage = '';
}

async function cargar() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Error al cargar datos');
        cache = await res.json();
        render(cache);
    } catch (error) {
        console.error(error);
    }
}

function render(lista) {
    grid.innerHTML = '';
    lista.forEach(m => {
        const card = document.createElement('div');
        card.className = 'card';
        
        let imageUrl = 'https://via.placeholder.com/150?text=Sin+Img';
        
        if (m.imagenes) {
            imageUrl = m.imagenes.startsWith('data:') 
                ? m.imagenes 
                : `data:image/png;base64,${m.imagenes}`;
        }

        card.innerHTML = `
            <img src="${imageUrl}" alt="${m.titulo}" style="object-fit: cover;" onerror="this.src='https://via.placeholder.com/150?text=Error'"/>
            <div class="card-body">
                <div class="card-title">${m.titulo}</div>
                <div class="card-desc">${m.descripcion || ''}</div>
            </div>
            <div class="card-actions">
                <button class="btn-edit" onclick="editar(${m.id_multimedia})">Editar</button>
                <button class="btn-delete" onclick="eliminar(${m.id_multimedia})">Eliminar</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.editar = (id) => {
    const m = cache.find(x => x.id_multimedia === id);
    idInput.value = id;
    tituloInput.value = m.titulo;
    descripcionInput.value = m.descripcion;
    
    if (m.imagenes) {
        const imageUrl = m.imagenes.startsWith('data:') 
            ? m.imagenes 
            : `data:image/png;base64,${m.imagenes}`;
            
        previewImg.style.backgroundImage = `url(${imageUrl})`;
    } else {
        previewImg.style.backgroundImage = '';
    }
    
    abrirModal();
};

async function guardar() {
    const file = imagenInput.files[0];
    let fotoBase64 = null;

    if (file) {
        fotoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result); // Esto devuelve "data:image/png;base64,..."
            reader.onerror = error => reject(error);
        });
    }

    const data = {
        titulo: tituloInput.value,
        descripcion: descripcionInput.value
    };

    if (fotoBase64) {
        data.imagenes = fotoBase64; 
    }
    const id = idInput.value;
    const url = id ? `${API_URL}/${id}` : API_URL;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { 
            method: method, 
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(data)
        });

        if(!res.ok) throw new Error("Error en la petición");

        cerrarModal();
        cargar(); // Recargar la lista
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Error al guardar el contenido.");
    }
}

window.eliminar = async (id) => {
    if (!confirm('¿Eliminar este contenido?')) return;
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    cargar();
};