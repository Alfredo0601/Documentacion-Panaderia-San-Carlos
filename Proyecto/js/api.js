/* ============================================
   API - Panadería San Carlos
   ============================================ */

const API_URL = 'http://localhost:8091/BACKEND/webapi';

async function realizarPeticion(endpoint, metodo, data) {
    const opciones = { method: metodo };

    if (data !== undefined) {
        opciones.headers = {
            'Content-Type': 'application/json'
        };
        opciones.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}${endpoint}`, opciones);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json && json.result !== undefined) {
        json.tipo = json.result;
    }

    if (json && json.msj !== undefined) {
        json.mensaje = json.msj;
    }

    return json;
}

async function apiGet(endpoint) {
    return realizarPeticion(endpoint, 'GET');
}

async function apiPost(endpoint, data) {
    return realizarPeticion(endpoint, 'POST', data);
}

async function apiPut(endpoint, data) {
    return realizarPeticion(endpoint, 'PUT', data);
}

async function apiDelete(endpoint) {
    return realizarPeticion(endpoint, 'DELETE');
}

// ============================================
// FIREBASE Y SESIÓN
// ============================================

const firebaseConfigURL = new URL(
    './firebase-config.js',
    document.currentScript.src
).href;

let modulosFirebase;

function cargarFirebaseSesion() {
    if (!modulosFirebase) {
        modulosFirebase = Promise.all([
            import(firebaseConfigURL),
            import(
                'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'
            ),
            import(
                'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js'
            )
        ]);
    }

    return modulosFirebase;
}

function limpiarDatosSesion() {
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('rol');
    sessionStorage.removeItem('uid');
}

function getUsuario() {
    return sessionStorage.getItem('usuario') || 'Invitado';
}

async function verificarSesion(rolesPermitidos = []) {
    try {
        const [
            { auth, db },
            { signOut },
            { doc, getDoc }
        ] = await cargarFirebaseSesion();

        await auth.authStateReady();

        const usuario = auth.currentUser;

        if (!usuario) {
            limpiarDatosSesion();
            window.location.replace('index.html');
            return false;
        }

        const documento = await getDoc(
            doc(db, 'usuarios', usuario.uid)
        );

        if (!documento.exists()) {
            await signOut(auth);
            throw new Error(
                'La cuenta no tiene un perfil registrado en usuarios.'
            );
        }

        const perfil = documento.data();

        const destinos = {
            ADMIN: 'dashboard.html',
            SUCURSAL: 'pedidos.html',
            VENDEDOR: 'incidentes.html'
        };

        if (
            perfil.activo !== true ||
            !Object.prototype.hasOwnProperty.call(destinos, perfil.rol)
        ) {
            await signOut(auth);
            throw new Error(
                'La cuenta está inactiva o tiene un rol inválido.'
            );
        }

        sessionStorage.setItem('uid', usuario.uid);
        sessionStorage.setItem(
            'usuario',
            perfil.nombre || usuario.email
        );
        sessionStorage.setItem('rol', perfil.rol);

        if (
            rolesPermitidos.length > 0 &&
            !rolesPermitidos.includes(perfil.rol)
        ) {
            window.location.replace(destinos[perfil.rol]);
            return false;
        }

        return true;

    } catch (error) {
        console.error(
            'Error al verificar sesión:',
            error.code,
            error.message
        );

        limpiarDatosSesion();

        await Swal.fire({
            icon: 'error',
            title: 'No se pudo verificar la sesión',
            text: error.code === 'permission-denied'
                ? 'Firestore no permite leer tu perfil. Revisa las reglas.'
                : error.message || 'Revisa tu conexión a internet.',
            confirmButtonColor: '#7B2D26'
        });

        window.location.replace('index.html');
        return false;
    }
}

async function cerrarSesion() {
    const resultado = await Swal.fire({
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro de que deseas salir del sistema?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    });

    if (!resultado.isConfirmed) return;

    try {
        const [
            { auth },
            { signOut }
        ] = await cargarFirebaseSesion();

        await signOut(auth);

        limpiarDatosSesion();
        window.location.replace('index.html');

    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        mostrarError('No se pudo cerrar la sesión. Intenta nuevamente.');
    }
}

// ============================================
// ALERTAS
// ============================================

function mostrarExito(mensaje) {
    return Swal.fire({
        icon: 'success',
        title: '¡Operación exitosa!',
        text: mensaje,
        confirmButtonColor: '#7B2D26',
        timer: 2500,
        timerProgressBar: true
    });
}

function mostrarError(mensaje) {
    return Swal.fire({
        icon: 'error',
        title: 'Ocurrió un error',
        text: mensaje,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Cerrar'
    });
}