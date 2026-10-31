import { auth, db } from './firebase-config.js';

import {
    signInWithEmailAndPassword,
    setPersistence,
    browserSessionPersistence,
    signOut
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';

import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const form = document.getElementById('formLogin');
const boton = form.querySelector('button[type="submit"]');

const cuentas = {
    admin: 'admin@gmail.com',
    sucursal: 'sucursal@gmail.com',
    vendedor: 'vendedor@gmail.com'
};

const destinos = {
    ADMIN: 'dashboard.html',
    SUCURSAL: 'pedidos.html',
    VENDEDOR: 'incidentes.html'
};

function limpiarSesion() {
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('rol');
    sessionStorage.removeItem('uid');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (boton.disabled) return;

    const usuario = document.getElementById('usuario')
        .value.trim().toLowerCase();

    const password = document.getElementById('password').value;

    if (!usuario || !password) {
        await Swal.fire({
            icon: 'warning',
            title: 'Campos vacíos',
            text: 'Debe ingresar un usuario y contraseña.'
        });
        return;
    }

    const correo = Object.prototype.hasOwnProperty.call(cuentas, usuario)
        ? cuentas[usuario]
        : usuario.includes('@') ? usuario : null;

    if (!correo) {
        await Swal.fire({
            icon: 'error',
            title: 'Acceso denegado',
            text: 'Usuario o contraseña incorrectos.'
        });
        return;
    }

    const contenidoOriginal = boton.innerHTML;

    boton.disabled = true;
    boton.textContent = 'Ingresando...';
    limpiarSesion();

    try {
        await setPersistence(auth, browserSessionPersistence);

        const credencial = await signInWithEmailAndPassword(
            auth,
            correo,
            password
        );

        const perfilDoc = await getDoc(
            doc(db, 'usuarios', credencial.user.uid)
        );

        if (!perfilDoc.exists()) {
            throw new Error('La cuenta no tiene un perfil en usuarios.');
        }

        const perfil = perfilDoc.data();

        if (perfil.activo !== true) {
            throw new Error('Esta cuenta está desactivada.');
        }

        if (!Object.prototype.hasOwnProperty.call(destinos, perfil.rol)) {
            throw new Error('La cuenta no tiene un rol válido.');
        }

        sessionStorage.setItem('uid', credencial.user.uid);
        sessionStorage.setItem('usuario', perfil.nombre || usuario);
        sessionStorage.setItem('rol', perfil.rol);

        window.location.replace(destinos[perfil.rol]);

    } catch (error) {
        await signOut(auth).catch(() => {});
        limpiarSesion();

        const mensajes = {
            'auth/invalid-credential':
                'Usuario o contraseña incorrectos.',
            'auth/user-not-found':
                'Usuario o contraseña incorrectos.',
            'auth/wrong-password':
                'Usuario o contraseña incorrectos.',
            'auth/invalid-email':
                'El correo ingresado no es válido.',
            'auth/user-disabled':
                'Esta cuenta está desactivada.',
            'auth/too-many-requests':
                'Demasiados intentos. Intenta nuevamente más tarde.',
            'auth/network-request-failed':
                'No se pudo conectar. Revisa tu conexión a internet.',
            'permission-denied':
                'Firestore no permite leer el perfil. Revisa las reglas.'
        };

        console.error(
            'Error al iniciar sesión:',
            error.code,
            error.message
        );

        await Swal.fire({
            icon: 'error',
            title: 'No se pudo ingresar',
            text: mensajes[error.code] ||
                (error.code
                    ? 'Ocurrió un error al iniciar sesión.'
                    : error.message),
            confirmButtonColor: '#7B2D26'
        });

    } finally {
        boton.disabled = false;
        boton.innerHTML = contenidoOriginal;
    }
});