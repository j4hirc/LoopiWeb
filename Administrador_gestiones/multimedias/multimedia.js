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
let fotoNuevaFile = null; 

document.addEventListener('DOMContentLoaded', cargar);

btnNuevo.onclick = abrirModal;
btnCerrar.onclick = cerrarModal;
btnCancelar.onclick = cerrarModal;
btnGuardar.onclick = guardar;

imagenInput.onchange = () => {
    const file = imagenInput.files[0];
    if (file) {
        fotoNuevaFile = file; // Guardamos el archivo para enviarlo luego
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
    resetForm();
    modal.style.display = 'flex';
}

function cerrarModal() {
    modal.style.display = 'none';
    resetForm();
}

function resetForm() {
    idInput.value = '';
    tituloInput.value = '';
    descripcionInput.value = '';
    imagenInput.value = '';
    previewImg.style.backgroundImage = '';
    fotoNuevaFile = null;
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
            if (m.imagenes.startsWith('http') || m.imagenes.startsWith('data:')) {
                imageUrl = m.imagenes;
            } else {
                imageUrl = `data:image/png;base64,${m.imagenes}`;
            }
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
    if(!m) return;

    resetForm(); 

    idInput.value = id;
    tituloInput.value = m.titulo;
    descripcionInput.value = m.descripcion;
    
    if (m.imagenes) {
        let imageUrl = m.imagenes;
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
             imageUrl = `data:image/png;base64,${m.imagenes}`;
        }
        previewImg.style.backgroundImage = `url(${imageUrl})`;
    }
    
    modal.style.display = 'flex'; // Abrimos modal directo
};

async function guardar() {
    const id = idInput.value;
    
    const dataObj = {
        titulo: tituloInput.value,
        descripcion: descripcionInput.value,
        imagenes: null // El backend gestiona la foto por separado
    };

    const formData = new FormData();
    formData.append("datos", JSON.stringify(dataObj));

    if (fotoNuevaFile) {
        formData.append("archivo", fotoNuevaFile);
    }

    const url = id ? `${API_URL}/${id}` : API_URL;
    const method = id ? 'PUT' : 'POST';

    try {

        const res = await fetch(url, { 
            method: method, 
            body: formData 
        });

        if(!res.ok) {
            const errText = await res.text();
            throw new Error("Error en la petición: " + errText);
        }

        cerrarModal();
        cargar(); 
        alert("Guardado correctamente");
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Error al guardar el contenido.");
    }
}

window.eliminar = async (id) => {
    if (!confirm('¿Eliminar este contenido?')) return;
    try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        cargar();
    } catch(e) { console.error(e); }
};