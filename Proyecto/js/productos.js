import { auth, db } from './firebase-config.js';

import {
    collection,
    doc,
    getDocsFromServer,
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

let modalProducto;
let autorizado = false;
let guardando = false;
let cargando = false;

let productos = [];
let filtroActual = '';

// ============================================
// UTILIDADES
// ============================================

function textoSeguro(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[caracter]));
}

function validarProducto(data) {
    if (
        !data.NOMBRE ||
        !data.CODIGO ||
        !data.TIPO ||
        !data.UNIDAD_MEDIDA
    ) {
        throw new Error('Complete todos los campos obligatorios.');
    }

    if (data.NOMBRE.length > 80) {
        throw new Error('El nombre admite hasta 80 caracteres.');
    }

    if (!/^[A-Z0-9_-]{1,30}$/.test(data.CODIGO)) {
        throw new Error(
            'El código admite hasta 30 caracteres: ' +
            'letras, números, guion y guion bajo.'
        );
    }

    if (!['FINAL', 'INSUMO'].includes(data.TIPO)) {
        throw new Error('Seleccione un tipo de producto válido.');
    }

    if (data.UNIDAD_MEDIDA.length > 30) {
        throw new Error('La unidad admite hasta 30 caracteres.');
    }

    if (
        !Number.isFinite(data.STOCK) ||
        data.STOCK < 0 ||
        !Number.isFinite(data.STOCK_MINIMO) ||
        data.STOCK_MINIMO < 0
    ) {
        throw new Error(
            'El stock y el mínimo deben ser números mayores o iguales a cero.'
        );
    }
}

// ============================================
// FILTROS Y TABLA
// ============================================

function cambiarFiltro(tipo) {
    filtroActual = tipo;

    document.querySelectorAll('.filtro-btn').forEach(boton => {
        boton.classList.toggle(
            'active',
            boton.dataset.tipo === tipo
        );
    });

    mostrarProductos();
}

function mostrarProductos() {
    const tbody = document.getElementById('tablaProductos');

    const visibles = productos.filter(producto =>
        producto._syncEliminado !== true &&
        (!filtroActual || producto.TIPO === filtroActual)
    );

    if (visibles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    No hay productos para este filtro.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = visibles.map(producto => {
        const activo = Number(producto.ESTADO) === 1;

        const stockBajo =
            Number(producto.STOCK) <= Number(producto.STOCK_MINIMO);

        return `
            <tr>
                <td>${textoSeguro(producto.ID_PRODUCTO)}</td>

                <td>
                    <code>${textoSeguro(producto.CODIGO)}</code>
                </td>

                <td class="fw-semibold">
                    ${textoSeguro(producto.NOMBRE)}
                </td>

                <td>
                    <span class="badge ${
                        producto.TIPO === 'FINAL'
                            ? 'badge-final'
                            : 'badge-insumo'
                    }">
                        ${textoSeguro(producto.TIPO)}
                    </span>
                </td>

                <td class="${stockBajo ? 'text-danger fw-bold' : ''}">
                    ${textoSeguro(producto.STOCK)}
                </td>

                <td>${textoSeguro(producto.STOCK_MINIMO)}</td>

                <td>${textoSeguro(producto.UNIDAD_MEDIDA)}</td>

                <td>
                    <span class="badge ${
                        activo ? 'bg-success' : 'bg-secondary'
                    }">
                        ${activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// LEER PRODUCTOS
// ============================================

async function cargarProductos() {
    if (!autorizado || cargando) return;

    cargando = true;

    const boton = document.getElementById('btnActualizarProductos');
    boton.disabled = true;

    try {
        const resultado = await getDocsFromServer(
            collection(db, 'productos')
        );

        productos = resultado.docs
            .map(documento => documento.data())
            .sort(
                (a, b) =>
                    Number(a.ID_PRODUCTO) - Number(b.ID_PRODUCTO)
            );

        mostrarProductos();

    } catch (error) {
        console.error('Error al cargar productos:', error);

        await mostrarError(
            error.code === 'permission-denied'
                ? 'No tienes permiso para consultar productos.'
                : 'Error al cargar productos: ' + error.message
        );

    } finally {
        cargando = false;
        boton.disabled = false;
    }
}

// ============================================
// MODAL
// ============================================

function abrirModalNuevo() {
    if (!autorizado || guardando) return;

    document.getElementById('formProducto').reset();
    document.getElementById('stock').value = '0';
    document.getElementById('stockMinimo').value = '0';

    modalProducto.show();
}

// ============================================
// GUARDADO TRANSACCIONAL
// ============================================

async function crearProducto(data) {
    const usuario = auth.currentUser;

    if (!usuario) {
        throw new Error('La sesión no está disponible.');
    }

    const existentes = await getDocsFromServer(
        collection(db, 'productos')
    );

    let maximoExistente = 0;
    let codigoExistente = false;

    existentes.forEach(documento => {
        const producto = documento.data();

        const codigo = String(producto.CODIGO || '')
            .trim()
            .toUpperCase();

        if (codigo === data.CODIGO) {
            codigoExistente = true;
        }

        for (const valor of [
            documento.id,
            producto.ID_PRODUCTO
        ]) {
            const id = Number(valor);

            if (Number.isSafeInteger(id) && id > maximoExistente) {
                maximoExistente = id;
            }
        }
    });

    if (codigoExistente) {
        throw new Error('Ya existe un producto con ese código.');
    }

    const referenciaContador = doc(db, 'contadores', 'productos');

    const referenciaCodigo = doc(
        db,
        'codigos_productos',
        data.CODIGO
    );

    return runTransaction(db, async transaccion => {
        const contador = await transaccion.get(referenciaContador);
        const codigoRegistrado = await transaccion.get(referenciaCodigo);

        if (codigoRegistrado.exists()) {
            throw new Error('Ya existe un producto con ese código.');
        }

        const ultimoId = contador.exists()
            ? contador.data().ULTIMO_ID
            : 0;

        if (!Number.isSafeInteger(ultimoId) || ultimoId < 0) {
            throw new Error('El contador de productos no es válido.');
        }

        const nuevoId = Math.max(ultimoId, maximoExistente) + 1;

        if (!Number.isSafeInteger(nuevoId)) {
            throw new Error('No se puede generar otro ID numérico.');
        }

        const referenciaProducto = doc(
            db,
            'productos',
            String(nuevoId)
        );

        const productoExistente = await transaccion.get(
            referenciaProducto
        );

        if (productoExistente.exists()) {
            throw new Error(
                'Ese ID ya existe. Actualiza la página e intenta de nuevo.'
            );
        }

        transaccion.set(referenciaContador, {
            ULTIMO_ID: nuevoId
        });

        transaccion.set(referenciaCodigo, {
            ID_PRODUCTO: nuevoId
        });

        transaccion.set(referenciaProducto, {
            ID_PRODUCTO: nuevoId,
            NOMBRE: data.NOMBRE,
            CODIGO: data.CODIGO,
            TIPO: data.TIPO,
            PRECIO: 0,
            STOCK: data.STOCK,
            STOCK_MINIMO: data.STOCK_MINIMO,
            UNIDAD_MEDIDA: data.UNIDAD_MEDIDA,
            ESTADO: 1,
            _syncEliminado: false,
            CREADO_POR: usuario.uid,
            FECHA_CREACION: serverTimestamp()
        });

        return nuevoId;
    });
}

// ============================================
// FORMULARIO
// ============================================

async function guardarProducto(e) {
    e.preventDefault();

    if (!autorizado || guardando) return;

    const stockTexto = document.getElementById('stock').value.trim();

    const minimoTexto = document.getElementById('stockMinimo')
        .value.trim();

    const data = {
        NOMBRE: document.getElementById('nombre').value.trim(),

        CODIGO: document.getElementById('codigo')
            .value.trim().toUpperCase(),

        TIPO: document.getElementById('tipo').value,

        UNIDAD_MEDIDA: document.getElementById('unidad')
            .value.trim().toUpperCase(),

        STOCK: stockTexto === '' ? NaN : Number(stockTexto),

        STOCK_MINIMO: minimoTexto === '' ? NaN : Number(minimoTexto)
    };

    try {
        validarProducto(data);
    } catch (error) {
        mostrarError(error.message);
        return;
    }

    const boton = document.querySelector(
        '#formProducto button[type="submit"]'
    );

    const contenidoOriginal = boton.innerHTML;

    guardando = true;
    boton.disabled = true;
    boton.textContent = 'Guardando...';

    let nuevoId;

    try {
        nuevoId = await crearProducto(data);

    } catch (error) {
        console.error('Error al guardar producto:', error);

        await mostrarError(
            error.code === 'permission-denied'
                ? 'Firestore rechazó el guardado. ' +
                  'Revisa las reglas y el perfil ADMIN.'
                : 'No se pudo guardar el producto: ' + error.message
        );

        return;

    } finally {
        guardando = false;
        boton.disabled = false;
        boton.innerHTML = contenidoOriginal;
    }

    modalProducto.hide();
    document.getElementById('formProducto').reset();

    cambiarFiltro('');

    await mostrarExito(
        'Producto #' + nuevoId + ' guardado en Firebase.'
    );

    await cargarProductos();
}

// ============================================
// INICIO
// ============================================

async function iniciar() {
    const sesionValida = await verificarSesion(['ADMIN']);

    if (!sesionValida) return;

    autorizado = true;

    renderMenu('productos');

    modalProducto = new bootstrap.Modal(
        document.getElementById('modalProducto')
    );

    document.getElementById('contenidoProductos').hidden = false;

    document.getElementById('btnNuevoProducto')
        .addEventListener('click', abrirModalNuevo);

    document.getElementById('btnActualizarProductos')
        .addEventListener('click', cargarProductos);

    document.getElementById('formProducto')
        .addEventListener('submit', guardarProducto);

    document.querySelectorAll('.filtro-btn').forEach(boton => {
        boton.addEventListener('click', () => {
            cambiarFiltro(boton.dataset.tipo);
        });
    });

    await cargarProductos();
}

iniciar().catch(error => {
    console.error('Error al iniciar productos:', error);

    mostrarError(
        'No se pudo iniciar la página: ' + error.message
    );
});