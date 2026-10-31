import { auth, db } from './firebase-config.js';

import {
    collection,
    doc,
    query,
    where,
    onSnapshot,
    getDocFromServer,
    getDocsFromServer,
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

let autorizado = false;
let enviando = false;
let escuchaFallida = false;
let uidVendedor = null;

let pedidos = new Map();
let sucursales = new Map();

const cancelarEscuchas = [];

const motivosPermitidos = [
    'Falla mecánica',
    'Llanta pinchada',
    'Accidente de tránsito',
    'Tráfico pesado',
    'Otro'
];

// ============================================
// UTILIDADES
// ============================================

function idValido(valor) {
    const id = Number(valor);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('El registro no tiene un ID válido.');
    }

    return id;
}

function numero(valor) {
    const cantidad = Number(valor);

    if (!Number.isFinite(cantidad)) {
        throw new Error('Se encontró una cantidad inválida.');
    }

    return cantidad;
}

function obtenerRevision(pedido) {
    const valor = pedido.REVISION ?? 0;

    if (
        !Number.isSafeInteger(valor) ||
        valor < 0 ||
        !Number.isSafeInteger(valor + 1)
    ) {
        throw new Error('El pedido tiene una revisión inválida.');
    }

    return valor;
}

function errorTexto(error) {
    if (error.code === 'permission-denied') {
        return 'Firestore rechazó la operación. Revisa las reglas ' +
            'y que el pedido pertenezca a tu cuenta.';
    }

    if (error.code === 'unavailable') {
        return 'No se pudo conectar con Firebase. Revisa internet.';
    }

    return error.message || 'No se pudo reportar el incidente.';
}

function marcaModificacion() {
    return {
        MODIFICADO_POR: uidVendedor,
        FECHA_MODIFICACION: serverTimestamp()
    };
}

function actualizarBoton() {
    const id = document.getElementById('cmbPedido').value;

    document.getElementById('btnReportar').disabled =
        !autorizado ||
        enviando ||
        escuchaFallida ||
        !pedidos.has(id);

    document.getElementById('cmbPedido').disabled = enviando;
    document.getElementById('motivo').disabled = enviando;
    document.getElementById('descripcion').disabled = enviando;
}

function seleccionarPedido() {
    const id = document.getElementById('cmbPedido').value;
    const pedido = pedidos.get(id);

    const sucursal = pedido
        ? sucursales.get(String(pedido.ID_SUCURSAL))
        : null;

    document.getElementById('cmbVendedor').value =
        pedido?.ENTREGADO_POR || '';

    document.getElementById('ruta').value =
        pedido?.RUTA || '';

    document.getElementById('sucursal').value =
        sucursal?.NOMBRE || '';

    actualizarBoton();
}

function dibujarPedidos() {
    const select = document.getElementById('cmbPedido');
    const anterior = select.value;

    select.replaceChildren();

    const lista = [...pedidos.values()].sort(
        (a, b) => Number(a.ID_PEDIDO) - Number(b.ID_PEDIDO)
    );

    document.getElementById('alertaSinRutas')
        .classList.toggle('d-none', lista.length > 0);

    if (!lista.length) {
        select.add(new Option('Sin pedidos en ruta', ''));

    } else {
        select.add(new Option('-- Seleccione pedido --', ''));

        for (const pedido of lista) {
            const sucursal = sucursales.get(
                String(pedido.ID_SUCURSAL)
            );

            select.add(new Option(
                `Pedido #${pedido.ID_PEDIDO} - ${
                    sucursal?.NOMBRE ||
                    `Sucursal #${pedido.ID_SUCURSAL}`
                }`,
                String(pedido.ID_PEDIDO)
            ));
        }

        if (pedidos.has(anterior)) {
            select.value = anterior;
        } else if (lista.length === 1) {
            select.value = String(lista[0].ID_PEDIDO);
        }
    }

    seleccionarPedido();
}

// ============================================
// LECTURA EN TIEMPO REAL
// ============================================

function errorEscucha(error) {
    console.error('Error al escuchar pedidos:', error);

    const primero = !escuchaFallida;
    escuchaFallida = true;

    document.getElementById('estadoIncidentes').textContent =
        'No se pudieron actualizar los pedidos. Recarga la página.';

    actualizarBoton();

    if (primero) {
        mostrarError(errorTexto(error));
    }
}

function iniciarEscuchas() {
    cancelarEscuchas.push(
        onSnapshot(
            collection(db, 'sucursales'),
            snapshot => {
                sucursales = new Map(
                    snapshot.docs
                        .filter(d => d.data()._syncEliminado !== true)
                        .map(d => [
                            String(d.data().ID_SUCURSAL),
                            d.data()
                        ])
                );

                dibujarPedidos();
            },
            errorEscucha
        )
    );

    cancelarEscuchas.push(
        onSnapshot(
            query(
                collection(db, 'pedidos'),
                where('VENDEDOR_UID', '==', uidVendedor)
            ),
            { includeMetadataChanges: true },
            snapshot => {
                pedidos = new Map(
                    snapshot.docs
                        .map(d => d.data())
                        .filter(p =>
                            p._syncEliminado !== true &&
                            Number(p.ESTADO) === 3
                        )
                        .map(p => [String(p.ID_PEDIDO), p])
                );

                if (!enviando) {
                    document.getElementById('estadoIncidentes')
                        .textContent = snapshot.metadata.fromCache
                            ? 'Datos locales; verificando conexión...'
                            : 'Pedidos actualizados desde Firebase.';
                }

                dibujarPedidos();
            },
            errorEscucha
        )
    );
}

// ============================================
// GUARDAR INCIDENTE Y DEVOLVER STOCK
// ============================================

async function registrarIncidente(idPedido, motivo, descripcion) {
    const refPedido = doc(db, 'pedidos', String(idPedido));
    const refIncidente = doc(collection(db, 'incidentes'));
    const refAuditoria = doc(collection(db, 'auditoria'));

    for (let intento = 0; intento < 4; intento++) {
        const pedidoPrevioDoc = await getDocFromServer(refPedido);

        if (!pedidoPrevioDoc.exists()) {
            throw new Error('El pedido no existe.');
        }

        const previo = pedidoPrevioDoc.data();

        if (
            Number(previo.ESTADO) !== 3 ||
            previo.VENDEDOR_UID !== uidVendedor ||
            previo._syncEliminado === true
        ) {
            throw new Error(
                'El pedido ya no está en ruta o pertenece a otra cuenta.'
            );
        }

        const revisionPrevia = obtenerRevision(previo);
        const idSucursal = idValido(previo.ID_SUCURSAL);

        const refSucursal = doc(
            db,
            'sucursales',
            String(idSucursal)
        );

        const resultadoDetalles = await getDocsFromServer(
            query(
                collection(db, 'detalles_pedido'),
                where('ID_PEDIDO', '==', idPedido)
            )
        );

        const detallesActivos = resultadoDetalles.docs.filter(d =>
            d.data()._syncEliminado !== true &&
            Number(d.data().ESTADO) === 1
        );

        if (detallesActivos.length > 8) {
            throw new Error(
                'Este pedido tiene más de 8 detalles activos. ' +
                'Debe revisarlo el administrador. No se guardaron cambios.'
            );
        }

        const grupos = new Map();

        for (const documento of detallesActivos) {
            const idProducto = idValido(
                documento.data().ID_PRODUCTO
            );

            const clave = String(idProducto);

            if (!grupos.has(clave)) {
                grupos.set(clave, []);
            }

            grupos.get(clave).push(documento);
        }

        for (const grupo of grupos.values()) {
            grupo.sort((a, b) => a.id.localeCompare(b.id));

            if (grupo.length > 5) {
                throw new Error(
                    'El pedido tiene más de 5 detalles del mismo producto. ' +
                    'Debe revisarlo el administrador. ' +
                    'No se guardaron cambios.'
                );
            }
        }

        const refsProductos = new Map(
            [...grupos.keys()].map(id => [
                id,
                doc(db, 'productos', id)
            ])
        );

        try {
            const incidenteGuardado = await runTransaction(
                db,
                async tx => {
                    const referencias = [
                        refPedido,
                        refSucursal,
                        refIncidente,
                        ...detallesActivos.map(d => d.ref),
                        ...refsProductos.values()
                    ];

                    const lecturas = await Promise.all(
                        referencias.map(referencia => tx.get(referencia))
                    );

                    const documentos = new Map(
                        lecturas.map(d => [d.ref.path, d])
                    );

                    const pedidoDoc = documentos.get(refPedido.path);
                    const pedido = pedidoDoc.exists()
                        ? pedidoDoc.data()
                        : null;

                    if (
                        !pedido ||
                        pedido._syncEliminado === true ||
                        Number(pedido.ESTADO) !== 3 ||
                        pedido.VENDEDOR_UID !== uidVendedor
                    ) {
                        throw new Error(
                            'El pedido ya fue entregado, cancelado ' +
                            'o pertenece a otra cuenta.'
                        );
                    }

                    if (auth.currentUser?.uid !== uidVendedor) {
                        throw new Error(
                            'La sesión cambió. Inicia sesión nuevamente.'
                        );
                    }

                    if (
                        obtenerRevision(pedido) !== revisionPrevia ||
                        Number(pedido.ID_SUCURSAL) !== idSucursal
                    ) {
                        const error = new Error('El pedido cambió.');
                        error.code = 'repreparar';
                        throw error;
                    }

                    if (documentos.get(refIncidente.path).exists()) {
                        throw new Error(
                            'El incidente ya fue registrado.'
                        );
                    }

                    const sucursalDoc = documentos.get(
                        refSucursal.path
                    );

                    if (!sucursalDoc.exists()) {
                        throw new Error(
                            'No se encontró la sucursal del pedido.'
                        );
                    }

                    const sucursal = sucursalDoc.data();
                    const devoluciones = {};
                    const stocksNuevos = new Map();

                    for (const [idProducto, grupo] of grupos) {
                        const refProducto = refsProductos.get(idProducto);
                        const productoDoc = documentos.get(
                            refProducto.path
                        );

                        if (
                            !productoDoc.exists() ||
                            productoDoc.data()._syncEliminado === true
                        ) {
                            throw new Error(
                                'No se encontró el producto #' + idProducto
                            );
                        }

                        let cantidadDevolver = 0;

                        for (const original of grupo) {
                            const actualDoc = documentos.get(
                                original.ref.path
                            );

                            const detalle = actualDoc.exists()
                                ? actualDoc.data()
                                : null;

                            if (
                                !detalle ||
                                detalle._syncEliminado === true ||
                                Number(detalle.ESTADO) !== 1 ||
                                Number(detalle.ID_PEDIDO) !== idPedido ||
                                String(detalle.ID_PRODUCTO) !== idProducto
                            ) {
                                const error = new Error(
                                    'Los detalles cambiaron.'
                                );

                                error.code = 'repreparar';
                                throw error;
                            }

                            const cantidad = numero(detalle.CANTIDAD);

                            if (cantidad <= 0) {
                                throw new Error(
                                    'Un detalle tiene una cantidad inválida.'
                                );
                            }

                            cantidadDevolver += cantidad;
                        }

                        const nuevoStock =
                            numero(productoDoc.data().STOCK) +
                            cantidadDevolver;

                        if (
                            !Number.isFinite(nuevoStock) ||
                            nuevoStock < 0
                        ) {
                            throw new Error(
                                'El stock calculado no es válido.'
                            );
                        }

                        devoluciones[idProducto] = grupo.map(d => d.id);
                        stocksNuevos.set(idProducto, nuevoStock);
                    }

                    const datosIncidente = {
                        ID_INCIDENTE: refIncidente.id,
                        ID_PEDIDO: idPedido,
                        RUTA: pedido.RUTA || '',
                        SUCURSAL: sucursal.NOMBRE,
                        VENDEDOR: pedido.ENTREGADO_POR || '',
                        VENDEDOR_UID: uidVendedor,
                        MOTIVO: motivo,
                        DESCRIPCION: descripcion,
                        FECHA: serverTimestamp(),
                        ESTADO: 'PENDIENTE',
                        DEVOLUCIONES: devoluciones,
                        _syncEliminado: false
                    };

                    // Todas las lecturas se completaron.
                    tx.set(refIncidente, datosIncidente);

                    for (const [idProducto, stock] of stocksNuevos) {
                        tx.update(refsProductos.get(idProducto), {
                            STOCK: stock,
                            INCIDENTE_REVERSION_ID: refIncidente.id,
                            ...marcaModificacion()
                        });
                    }

                    for (const detalle of detallesActivos) {
                        tx.update(detalle.ref, {
                            ESTADO: 0,
                            INCIDENTE_ID: refIncidente.id,
                            ...marcaModificacion()
                        });
                    }

                    tx.update(refPedido, {
                        ESTADO: 0,
                        REVISION: obtenerRevision(pedido) + 1,
                        INCIDENTE_ID: refIncidente.id,
                        ...marcaModificacion()
                    });

                    tx.set(refAuditoria, {
                        ID_AUDITORIA: refAuditoria.id,
                        ID_PEDIDO: idPedido,
                        ID_INCIDENTE: refIncidente.id,
                        ACCION: 'PEDIDO_CANCELADO',
                        DESCRIPCION:
                            'Pedido #' + idPedido +
                            ' cancelado por incidente #' +
                            refIncidente.id,
                        USUARIO: uidVendedor,
                        FECHA: serverTimestamp(),
                        _syncEliminado: false
                    });

                    // Datos canónicos de la transacción confirmada.
                    // El envío de correo se hace fuera de la transacción.
                    return {
                        ID_INCIDENTE: refIncidente.id,
                        ID_PEDIDO: idPedido,
                        RUTA: datosIncidente.RUTA,
                        SUCURSAL: datosIncidente.SUCURSAL,
                        VENDEDOR: datosIncidente.VENDEDOR,
                        MOTIVO: motivo,
                        DESCRIPCION: descripcion
                    };
                }
            );

            return incidenteGuardado;

        } catch (error) {
            if (error.code === 'repreparar') continue;
            throw error;
        }
    }

    throw new Error(
        'El pedido está cambiando en otra sesión. ' +
        'Actualiza la página e intenta nuevamente.'
    );
}

// ============================================
// CORREO DE INCIDENTE
// ============================================

async function enviarCorreoIncidente(incidente) {
    // Importación al enviar: un fallo al cargar correo.js
    // no impide guardar la operación en Firebase.
    const { enviarCorreo } = await import('./correo.js');

    const mensaje = [
        'ALERTA DE INCIDENTE EN RUTA',
        '',
        `Incidente: ${incidente.ID_INCIDENTE}`,
        `Pedido: #${incidente.ID_PEDIDO}`,
        `Ruta: ${incidente.RUTA || '-'}`,
        `Sucursal: ${incidente.SUCURSAL || '-'}`,
        `Vendedor: ${incidente.VENDEDOR || '-'}`,
        `Motivo: ${incidente.MOTIVO}`,
        '',
        'Descripción:',
        incidente.DESCRIPCION || 'Sin descripción adicional.',
        '',
        'RESULTADO DE LA OPERACIÓN',
        'El incidente quedó registrado como PENDIENTE.',
        'El pedido y sus detalles fueron cancelados.',
        'Los productos del pedido fueron devueltos al stock.',
        '',
        'El administrador debe revisar el incidente.'
    ].join('\n');

    await enviarCorreo(
        `Incidente en ruta - Pedido #${incidente.ID_PEDIDO}`,
        mensaje
    );
}

// ============================================
// FORMULARIO
// ============================================

async function enviarIncidente(e) {
    e.preventDefault();

    if (!autorizado || enviando || escuchaFallida) return;

    let idPedido;

    try {
        idPedido = idValido(
            document.getElementById('cmbPedido').value
        );
    } catch (error) {
        mostrarError('Seleccione un pedido válido.');
        return;
    }

    const motivo = document.getElementById('motivo').value;
    const descripcion = document.getElementById('descripcion')
        .value.trim();

    if (!motivosPermitidos.includes(motivo)) {
        mostrarError('Seleccione un motivo válido.');
        return;
    }

    if (descripcion.length > 2000) {
        mostrarError('La descripción admite hasta 2000 caracteres.');
        return;
    }

    enviando = true;
    actualizarBoton();

    let confirmado = false;
    let incidenteGuardado = null;

    try {
        const respuesta = await Swal.fire({
            title: '¿Reportar incidente?',
            text:
                'Se cancelará el pedido #' + idPedido +
                ' y sus productos volverán al stock.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'Sí, reportar y cancelar',
            cancelButtonText: 'Volver'
        });

        if (!respuesta.isConfirmed) return;

        confirmado = true;

        document.getElementById('estadoIncidentes').textContent =
            'Registrando incidente y devolviendo existencias...';

        incidenteGuardado = await registrarIncidente(
            idPedido,
            motivo,
            descripcion
        );

        document.getElementById('formIncidente').reset();

        // Quitar el pedido cancelado aunque la escucha siga actualizándose.
        pedidos.delete(String(idPedido));
        dibujarPedidos();

        document.getElementById('estadoIncidentes').textContent =
            'Incidente guardado. Enviando aviso por correo...';

        Swal.fire({
            title: 'Incidente guardado',
            text: 'Enviando el aviso por correo...',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading()
        });

        // El correo tiene su propio manejo de errores:
        // no se vuelve a ejecutar la cancelación.
        try {
            await enviarCorreoIncidente(incidenteGuardado);

        } catch (errorCorreo) {
            console.error(
                'Incidente guardado, pero falló el correo:',
                errorCorreo
            );

            document.getElementById('estadoIncidentes').textContent =
                'Incidente guardado: ' +
                incidenteGuardado.ID_INCIDENTE +
                '. No se completó el aviso por correo.';

            await Swal.fire({
                icon: 'warning',
                title: 'Incidente guardado; correo no enviado',
                text:
                    'El pedido #' + idPedido +
                    ' ya fue cancelado y el stock fue devuelto. ' +
                    'No repitas el reporte. Error de correo: ' +
                    (errorCorreo.message || 'No se pudo enviar el aviso.'),
                confirmButtonColor: '#7B2D26'
            });

            return;
        }

        document.getElementById('estadoIncidentes').textContent =
            'Incidente guardado: ' +
            incidenteGuardado.ID_INCIDENTE +
            '. Aviso aceptado por EmailJS.';

        await Swal.fire({
            icon: 'success',
            title: 'Incidente reportado',
            text:
                'Pedido #' + idPedido +
                ' cancelado y stock devuelto. ' +
                'EmailJS aceptó el aviso para enviarlo a ' +
                'pansancarlosumg@gmail.com.',
            confirmButtonColor: '#7B2D26'
        });

    } catch (error) {
        console.error('Error al reportar incidente:', error);

        if (incidenteGuardado) {
            document.getElementById('estadoIncidentes').textContent =
                'El incidente quedó guardado: ' +
                incidenteGuardado.ID_INCIDENTE;

            await mostrarError(
                'El incidente ya fue guardado y el stock devuelto. ' +
                'No repitas la operación. ' +
                'Ocurrió un error posterior: ' + errorTexto(error)
            );

        } else {
            document.getElementById('estadoIncidentes').textContent =
                'No se completó el reporte. Revisa el mensaje de error.';

            await mostrarError(errorTexto(error));
        }

    } finally {
        enviando = false;
        actualizarBoton();

        if (!confirmado && !escuchaFallida) {
            document.getElementById('estadoIncidentes').textContent =
                'Selecciona un pedido para reportar.';
        }
    }
}

// ============================================
// INICIO Y LIMPIEZA
// ============================================

function detenerEscuchas() {
    while (cancelarEscuchas.length) {
        cancelarEscuchas.pop()();
    }
}

async function iniciar() {
    if (!await verificarSesion(['VENDEDOR'])) return;

    uidVendedor = auth.currentUser?.uid;

    if (!uidVendedor) {
        window.location.replace('index.html');
        return;
    }

    autorizado = true;

    renderMenu('incidentes');

    document.getElementById('contenidoIncidentes').hidden = false;

    document.getElementById('cmbPedido')
        .addEventListener('change', seleccionarPedido);

    document.getElementById('formIncidente')
        .addEventListener('submit', enviarIncidente);

    iniciarEscuchas();
}

window.addEventListener('pagehide', detenerEscuchas);

window.addEventListener('pageshow', evento => {
    if (evento.persisted) window.location.reload();
});

iniciar().catch(error => {
    autorizado = false;
    detenerEscuchas();

    console.error('Error al iniciar incidentes:', error);
    mostrarError(errorTexto(error));
});