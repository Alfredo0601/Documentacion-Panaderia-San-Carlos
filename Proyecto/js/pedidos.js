import { auth, db } from './firebase-config.js';

import {
    collection,
    doc,
    query,
    where,
    orderBy,
    limit,
    getDocFromServer,
    getDocsFromServer,
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

let autorizado = false;
let ocupado = false;
let pedidoActual = null;

let modalPedido;
let modalDetalle;

let pedidos = [];
let detalles = [];
let sucursales = new Map();
let productos = new Map();

// ============================================
// UTILIDADES
// ============================================

const referencia = (nombre, id) =>
    doc(db, nombre, String(id));

const activo = dato =>
    dato &&
    dato._syncEliminado !== true &&
    Number(dato.ESTADO) === 1;

function idValido(valor) {
    const id = Number(valor);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('Identificador inválido.');
    }

    return id;
}

function numero(valor) {
    const n = Number(valor);

    if (!Number.isFinite(n)) {
        throw new Error('Cantidad inválida.');
    }

    return n;
}

function escapar(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function fechaTexto(valor) {
    return valor?.toDate
        ? valor.toDate().toLocaleString('es-GT', {
            timeZone: 'America/Guatemala'
        })
        : String(valor || '-').replace('T', ' ');
}

function errorTexto(error) {
    return error.code === 'permission-denied'
        ? 'Firestore rechazó la operación. Revisa las reglas y el perfil.'
        : error.message || 'No se pudo completar la operación.';
}

function revision(pedido) {
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

function marcaModificacion(uid) {
    return {
        MODIFICADO_POR: uid,
        FECHA_MODIFICACION: serverTimestamp()
    };
}

function auditar(tx, uid, accion, descripcion) {
    const ref = doc(collection(db, 'auditoria'));

    tx.set(ref, {
        ID_AUDITORIA: ref.id,
        ACCION: accion,
        DESCRIPCION: descripcion,
        USUARIO: uid,
        FECHA: serverTimestamp(),
        _syncEliminado: false
    });
}

function usuarioActual() {
    const usuario = auth.currentUser;

    if (!usuario) {
        throw new Error('La sesión no está disponible.');
    }

    return usuario;
}

async function prepararId(nombre, campo) {
    const ref = referencia('contadores', nombre);
    const documento = await getDocFromServer(ref);

    let base = documento.exists()
        ? documento.data().ULTIMO_ID
        : 0;

    if (!Number.isSafeInteger(base) || base < 0) {
        throw new Error('Contador inválido: ' + nombre);
    }

    if (!documento.exists()) {
        const maximo = await getDocsFromServer(
            query(
                collection(db, nombre),
                orderBy(campo, 'desc'),
                limit(1)
            )
        );

        if (!maximo.empty) {
            base = Math.max(
                base,
                idValido(maximo.docs[0].data()[campo])
            );
        }
    }

    return { ref, base };
}

// ============================================
// CREAR PEDIDO
// ============================================

async function crearPedido(idSucursal, turno) {
    const usuario = usuarioActual();
    const contador = await prepararId('pedidos', 'ID_PEDIDO');
    const refSucursal = referencia('sucursales', idSucursal);

    return runTransaction(db, async tx => {
        const [contadorDoc, sucursalDoc] = await Promise.all([
            tx.get(contador.ref),
            tx.get(refSucursal)
        ]);

        const ultimo = contadorDoc.exists()
            ? contadorDoc.data().ULTIMO_ID
            : contador.base;

        if (!Number.isSafeInteger(ultimo) || ultimo < 0) {
            throw new Error('El contador de pedidos no es válido.');
        }

        const id = Math.max(ultimo, contador.base) + 1;

        if (!Number.isSafeInteger(id)) {
            throw new Error('No se puede generar otro ID.');
        }

        const refPedido = referencia('pedidos', id);
        const existente = await tx.get(refPedido);

        if (existente.exists()) {
            throw new Error(
                'El ID ya existe. Actualiza e intenta otra vez.'
            );
        }

        const sucursal = sucursalDoc.exists()
            ? sucursalDoc.data()
            : null;

        if (!activo(sucursal)) {
            throw new Error('La sucursal ya no está disponible.');
        }

        if (
            typeof sucursal.RUTA !== 'string' ||
            !sucursal.RUTA.trim()
        ) {
            throw new Error('La sucursal no tiene una ruta asignada.');
        }

        tx.set(contador.ref, { ULTIMO_ID: id });

        tx.set(refPedido, {
            ID_PEDIDO: id,
            ID_SUCURSAL: idSucursal,
            FECHA: serverTimestamp(),
            TURNO: turno,
            RUTA: sucursal.RUTA,
            ESTADO: 1,
            ENTREGADO_POR: null,
            REVISION: 0,
            _syncEliminado: false,
            CREADO_POR: usuario.uid,
            FECHA_CREACION: serverTimestamp()
        });

        auditar(
            tx,
            usuario.uid,
            'NUEVO_PEDIDO',
            'Se creó el pedido #' + id + ' para ' + sucursal.NOMBRE
        );

        return id;
    });
}

// ============================================
// AGREGAR DETALLE Y DESCONTAR STOCK
// ============================================

async function insertarDetalle(idPedido, idProducto, cantidad) {
    const usuario = usuarioActual();

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error('La cantidad debe ser mayor que cero.');
    }

    const contador = await prepararId(
        'detalles_pedido',
        'ID_DETALLE_PEDIDO'
    );

    const refPedido = referencia('pedidos', idPedido);
    const refProducto = referencia('productos', idProducto);

    return runTransaction(db, async tx => {
        const [contadorDoc, pedidoDoc, productoDoc] =
            await Promise.all([
                tx.get(contador.ref),
                tx.get(refPedido),
                tx.get(refProducto)
            ]);

        const ultimo = contadorDoc.exists()
            ? contadorDoc.data().ULTIMO_ID
            : contador.base;

        if (!Number.isSafeInteger(ultimo) || ultimo < 0) {
            throw new Error('El contador de detalles no es válido.');
        }

        const id = Math.max(ultimo, contador.base) + 1;

        if (!Number.isSafeInteger(id)) {
            throw new Error('No se puede generar otro ID.');
        }

        const refDetalle = referencia('detalles_pedido', id);
        const existente = await tx.get(refDetalle);

        if (existente.exists()) {
            throw new Error(
                'El ID ya existe. Actualiza e intenta otra vez.'
            );
        }

        const pedido = pedidoDoc.exists()
            ? pedidoDoc.data()
            : null;

        const producto = productoDoc.exists()
            ? productoDoc.data()
            : null;

        if (!activo(pedido)) {
            throw new Error('Solo se pueden editar pedidos activos.');
        }

        if (!activo(producto) || producto.TIPO !== 'FINAL') {
            throw new Error(
                'El producto final ya no está disponible.'
            );
        }

        const stock = numero(producto.STOCK);

        if (stock < cantidad) {
            throw new Error(
                'No hay suficiente stock de ' + producto.NOMBRE +
                '. Disponible: ' + stock
            );
        }

        const nuevoStock = stock - cantidad;

        tx.set(contador.ref, { ULTIMO_ID: id });

        tx.set(refDetalle, {
            ID_DETALLE_PEDIDO: id,
            ID_PEDIDO: idPedido,
            ID_PRODUCTO: idProducto,
            CANTIDAD: cantidad,
            SUBTOTAL: 0,
            ESTADO: 1,
            _syncEliminado: false,
            CREADO_POR: usuario.uid,
            FECHA_CREACION: serverTimestamp()
        });

        tx.update(refProducto, {
            STOCK: nuevoStock,
            ...marcaModificacion(usuario.uid)
        });

        tx.update(refPedido, {
            REVISION: revision(pedido) + 1,
            ...marcaModificacion(usuario.uid)
        });

        auditar(
            tx,
            usuario.uid,
            'DETALLE_PEDIDO',
            'Se agregaron ' + cantidad + ' de ' +
            producto.NOMBRE + ' al pedido #' + idPedido
        );

        return id;
    });
}

// ============================================
// ANULAR PEDIDO O DETALLE
// ============================================

async function cancelar(idPedido, idDetalle = null) {
    const usuario = usuarioActual();
    const refPedido = referencia('pedidos', idPedido);

    for (let intento = 0; intento < 4; intento++) {
        const previo = await getDocFromServer(refPedido);

        if (!previo.exists()) {
            throw new Error('El pedido no existe.');
        }

        const revisionPrevia = revision(previo.data());
        let documentos;

        if (idDetalle !== null) {
            const detalleDoc = await getDocFromServer(
                referencia('detalles_pedido', idDetalle)
            );

            if (!detalleDoc.exists()) {
                throw new Error('El detalle no existe.');
            }

            documentos = [detalleDoc];

        } else {
            const resultado = await getDocsFromServer(
                query(
                    collection(db, 'detalles_pedido'),
                    where('ID_PEDIDO', '==', idPedido)
                )
            );

            documentos = resultado.docs.filter(
                d => activo(d.data())
            );
        }

        const refsProductos = new Map();

        for (const documento of documentos) {
            const id = idValido(documento.data().ID_PRODUCTO);

            refsProductos.set(
                String(id),
                referencia('productos', id)
            );
        }

        try {
            await runTransaction(db, async tx => {
                const referencias = [
                    refPedido,
                    ...documentos.map(d => d.ref),
                    ...refsProductos.values()
                ];

                const lecturas = await Promise.all(
                    referencias.map(ref => tx.get(ref))
                );

                const mapa = new Map(
                    lecturas.map(d => [d.ref.path, d])
                );

                const pedidoDoc = mapa.get(refPedido.path);
                const pedido = pedidoDoc.exists()
                    ? pedidoDoc.data()
                    : null;

                if (!pedido || pedido._syncEliminado === true) {
                    throw new Error('El pedido no existe.');
                }

                if (revision(pedido) !== revisionPrevia) {
                    const error = new Error('Los detalles cambiaron.');
                    error.code = 'repreparar';
                    throw error;
                }

                if (idDetalle === null) {
                    if (![1, 3].includes(Number(pedido.ESTADO))) {
                        throw new Error(
                            'El pedido ya está cancelado o entregado.'
                        );
                    }

                } else if (Number(pedido.ESTADO) !== 1) {
                    throw new Error(
                        'Solo se pueden editar detalles de pedidos activos.'
                    );
                }

                const devoluciones = new Map();
                const detallesAnular = [];

                for (const documento of documentos) {
                    const actual = mapa.get(documento.ref.path);
                    const detalle = actual.exists()
                        ? actual.data()
                        : null;

                    if (!activo(detalle)) {
                        if (idDetalle !== null) {
                            throw new Error('El detalle ya está anulado.');
                        }

                        continue;
                    }

                    if (Number(detalle.ID_PEDIDO) !== idPedido) {
                        throw new Error(
                            'El detalle no corresponde a este pedido.'
                        );
                    }

                    if (
                        Number(detalle.ID_PRODUCTO) !==
                        Number(documento.data().ID_PRODUCTO)
                    ) {
                        throw new Error(
                            'El producto del detalle cambió.'
                        );
                    }

                    const id = String(detalle.ID_PRODUCTO);
                    const cantidad = numero(detalle.CANTIDAD);

                    if (cantidad <= 0) {
                        throw new Error(
                            'El detalle tiene cantidad inválida.'
                        );
                    }

                    devoluciones.set(
                        id,
                        (devoluciones.get(id) || 0) + cantidad
                    );

                    detallesAnular.push(documento.ref);
                }

                if (
                    detallesAnular.length +
                    devoluciones.size + 2 > 400
                ) {
                    throw new Error(
                        'El pedido es demasiado grande para esta operación.'
                    );
                }

                for (const [id, cantidad] of devoluciones) {
                    const refProducto = refsProductos.get(id);
                    const documento = mapa.get(refProducto.path);

                    if (
                        !documento.exists() ||
                        documento.data()._syncEliminado === true
                    ) {
                        throw new Error('No existe el producto #' + id);
                    }

                    const stock =
                        numero(documento.data().STOCK) + cantidad;

                    if (!Number.isFinite(stock) || stock < 0) {
                        throw new Error(
                            'El stock calculado no es válido.'
                        );
                    }

                    tx.update(refProducto, {
                        STOCK: stock,
                        ...marcaModificacion(usuario.uid)
                    });
                }

                for (const refDetalle of detallesAnular) {
                    tx.update(refDetalle, {
                        ESTADO: 0,
                        ...marcaModificacion(usuario.uid)
                    });
                }

                tx.update(refPedido, {
                    ESTADO: idDetalle === null ? 0 : 1,
                    REVISION: revision(pedido) + 1,
                    ...marcaModificacion(usuario.uid)
                });

                auditar(
                    tx,
                    usuario.uid,
                    idDetalle === null
                        ? 'PEDIDO_CANCELADO'
                        : 'DETALLE_PEDIDO_CANCELADO',
                    idDetalle === null
                        ? 'Se anuló el pedido #' + idPedido
                        : 'Se anuló el detalle #' + idDetalle +
                          ' del pedido #' + idPedido
                );
            });

            return;

        } catch (error) {
            if (error.code === 'repreparar') continue;
            throw error;
        }
    }

    throw new Error(
        'El pedido está cambiando en otra sesión. Intenta nuevamente.'
    );
}

// ============================================
// ENTREGAR PEDIDO EN RUTA
// ============================================

async function entregar(idPedido) {
    const usuario = usuarioActual();
    const refPedido = referencia('pedidos', idPedido);

    await runTransaction(db, async tx => {
        const documento = await tx.get(refPedido);
        const pedido = documento.exists()
            ? documento.data()
            : null;

        if (
            !pedido ||
            pedido._syncEliminado === true ||
            Number(pedido.ESTADO) !== 3
        ) {
            throw new Error('El pedido no está en ruta.');
        }

        tx.update(refPedido, {
            ESTADO: 2,
            REVISION: revision(pedido) + 1,
            ...marcaModificacion(usuario.uid)
        });

        auditar(
            tx,
            usuario.uid,
            'PEDIDO_ENTREGADO',
            'Se entregó el pedido #' + idPedido
        );
    });
}

// ============================================
// INTERFAZ
// ============================================

function controles() {
    document.querySelectorAll(
        '#contenidoPedidos button, ' +
        '#modalPedido button[type="submit"], ' +
        '#tablaDetalle button'
    ).forEach(boton => {
        boton.disabled = ocupado || !autorizado;
    });

    const pedido = pedidos.find(
        p => Number(p.ID_PEDIDO) === Number(pedidoActual)
    );

    const editar = autorizado && !ocupado && activo(pedido);

    document.getElementById('btnAgregarDetalle').disabled = !editar;
    document.getElementById('cmbProductoDetalle').disabled = !editar;
    document.getElementById('cantidadDetalle').disabled = !editar;
}

function boton(texto, clase, accion) {
    const elemento = document.createElement('button');

    elemento.type = 'button';
    elemento.className = 'btn btn-sm ' + clase;
    elemento.textContent = texto;
    elemento.addEventListener('click', accion);

    return elemento;
}

function dibujar() {
    const tbody = document.getElementById('tablaPedidos');
    tbody.replaceChildren();

    const estados = {
        0: ['Cancelado', 'bg-danger'],
        1: ['Activo', 'bg-success'],
        2: ['Entregado', 'bg-primary'],
        3: ['En ruta', 'bg-warning text-dark']
    };

    const visibles = pedidos
        .filter(p => p._syncEliminado !== true)
        .sort((a, b) => Number(b.ID_PEDIDO) - Number(a.ID_PEDIDO));

    if (!visibles.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    No hay pedidos.
                </td>
            </tr>
        `;
    }

    for (const pedido of visibles) {
        const estado = Number(pedido.ESTADO);

        const [nombreEstado, clase] =
            estados[estado] || ['Desconocido', 'bg-secondary'];

        const sucursal = sucursales.get(
            String(pedido.ID_SUCURSAL)
        );

        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${escapar(pedido.ID_PEDIDO)}</td>
            <td class="fw-semibold">
                ${escapar(sucursal?.NOMBRE || pedido.ID_SUCURSAL)}
            </td>
            <td>${escapar(fechaTexto(pedido.FECHA))}</td>
            <td>
                <span class="badge bg-info">
                    ${escapar(pedido.TURNO)}
                </span>
            </td>
            <td>${escapar(pedido.RUTA || '-')}</td>
            <td>
                <span class="badge ${clase}">
                    ${nombreEstado}
                </span>
            </td>
            <td></td>
        `;

        const acciones = fila.lastElementChild;

        acciones.append(
            boton('Detalle', 'btn-primary me-1', () =>
                abrirDetalle(pedido.ID_PEDIDO)
            )
        );

        if (estado === 3) {
            acciones.append(
                boton('Entregar', 'btn-success me-1', () =>
                    confirmarEntrega(pedido.ID_PEDIDO)
                )
            );
        }

        if ([1, 3].includes(estado)) {
            acciones.append(
                boton('Anular', 'btn-danger', () =>
                    confirmarAnulacion(pedido.ID_PEDIDO)
                )
            );
        }

        tbody.append(fila);
    }

    const selectSucursal = document.getElementById('idSucursal');
    const sucursalAnterior = selectSucursal.value;

    selectSucursal.replaceChildren(
        new Option('-- Seleccione --', '')
    );

    [...sucursales.values()]
        .filter(activo)
        .sort((a, b) =>
            String(a.NOMBRE).localeCompare(String(b.NOMBRE))
        )
        .forEach(sucursal => {
            selectSucursal.add(
                new Option(
                    sucursal.NOMBRE,
                    String(sucursal.ID_SUCURSAL)
                )
            );
        });

    if ([...selectSucursal.options].some(
        o => o.value === sucursalAnterior
    )) {
        selectSucursal.value = sucursalAnterior;
    }

    actualizarRuta();

    const selectProducto = document.getElementById(
        'cmbProductoDetalle'
    );

    const productoAnterior = selectProducto.value;

    selectProducto.replaceChildren(
        new Option('-- Seleccione --', '')
    );

    [...productos.values()]
        .filter(p => activo(p) && p.TIPO === 'FINAL')
        .sort((a, b) =>
            String(a.NOMBRE).localeCompare(String(b.NOMBRE))
        )
        .forEach(producto => {
            selectProducto.add(new Option(
                `${producto.NOMBRE} (Stock: ${producto.STOCK})`,
                String(producto.ID_PRODUCTO)
            ));
        });

    if ([...selectProducto.options].some(
        o => o.value === productoAnterior
    )) {
        selectProducto.value = productoAnterior;
    }

    dibujarDetalle();
    controles();
}

function actualizarRuta() {
    const id = document.getElementById('idSucursal').value;

    document.getElementById('ruta').value =
        sucursales.get(id)?.RUTA || '';
}

function dibujarDetalle() {
    const tbody = document.getElementById('tablaDetalle');
    tbody.replaceChildren();

    document.getElementById('idPedidoDetalle').textContent =
        pedidoActual || '';

    const pedido = pedidos.find(
        p => Number(p.ID_PEDIDO) === Number(pedidoActual)
    );

    const visibles = detalles
        .filter(d => d._syncEliminado !== true)
        .sort((a, b) =>
            Number(a.ID_DETALLE_PEDIDO) -
            Number(b.ID_DETALLE_PEDIDO)
        );

    if (!visibles.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    Sin detalles.
                </td>
            </tr>
        `;
    }

    for (const detalle of visibles) {
        const producto = productos.get(
            String(detalle.ID_PRODUCTO)
        );

        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${escapar(producto?.NOMBRE || detalle.ID_PRODUCTO)}</td>
            <td>
                <code>${escapar(producto?.CODIGO || '-')}</code>
            </td>
            <td>${escapar(detalle.CANTIDAD)}</td>
            <td>${activo(detalle) ? 'Activo' : 'Anulado'}</td>
            <td></td>
        `;

        if (activo(detalle) && activo(pedido)) {
            fila.lastElementChild.append(
                boton('Anular', 'btn-danger', () =>
                    confirmarAnulacion(
                        detalle.ID_PEDIDO,
                        detalle.ID_DETALLE_PEDIDO
                    )
                )
            );
        }

        tbody.append(fila);
    }
}

async function actualizar() {
    const consultas = [
        getDocsFromServer(collection(db, 'pedidos')),
        getDocsFromServer(collection(db, 'sucursales')),
        getDocsFromServer(collection(db, 'productos'))
    ];

    if (pedidoActual !== null) {
        consultas.push(
            getDocsFromServer(
                query(
                    collection(db, 'detalles_pedido'),
                    where('ID_PEDIDO', '==', pedidoActual)
                )
            )
        );
    }

    const [p, s, pr, d] = await Promise.all(consultas);

    pedidos = p.docs.map(documento => documento.data());

    sucursales = new Map(
        s.docs.map(documento => [
            String(documento.data().ID_SUCURSAL),
            documento.data()
        ])
    );

    productos = new Map(
        pr.docs.map(documento => [
            String(documento.data().ID_PRODUCTO),
            documento.data()
        ])
    );

    detalles = d
        ? d.docs.map(documento => documento.data())
        : [];

    dibujar();
}

// Una actualización visual fallida no implica que se perdió
// una operación que Firebase ya confirmó.
async function actualizarTrasGuardar() {
    try {
        await actualizar();
        return '';

    } catch (error) {
        console.error('Cambios guardados; falló actualizar pantalla:', error);

        return 'Los cambios quedaron guardados, pero no se pudo ' +
            'actualizar la pantalla. Recarga antes de seguir. ' +
            errorTexto(error);
    }
}

async function tarea(accion) {
    if (!autorizado || ocupado) return;

    ocupado = true;
    controles();

    try {
        await accion();

    } catch (error) {
        console.error('Error en pedidos:', error);
        await mostrarError(errorTexto(error));

    } finally {
        ocupado = false;
        controles();
    }
}

async function abrirDetalle(id) {
    await tarea(async () => {
        pedidoActual = idValido(id);

        document.getElementById('idPedidoDetalle').textContent =
            pedidoActual;

        detalles = [];

        document.getElementById('tablaDetalle').innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    Cargando...
                </td>
            </tr>
        `;

        modalDetalle.show();

        const [resultado, cabecera] = await Promise.all([
            getDocsFromServer(
                query(
                    collection(db, 'detalles_pedido'),
                    where('ID_PEDIDO', '==', pedidoActual)
                )
            ),
            getDocFromServer(
                referencia('pedidos', pedidoActual)
            )
        ]);

        detalles = resultado.docs.map(
            documento => documento.data()
        );

        if (cabecera.exists()) {
            pedidos = pedidos.filter(
                p => Number(p.ID_PEDIDO) !== pedidoActual
            );

            pedidos.push(cabecera.data());
        }

        dibujarDetalle();
    });
}

// ============================================
// FORMULARIOS
// ============================================

async function enviarPedido(e) {
    e.preventDefault();

    await tarea(async () => {
        const idSucursal = idValido(
            document.getElementById('idSucursal').value
        );

        const turno = document.getElementById('turno').value;

        if (!['MAÑANA', 'TARDE'].includes(turno)) {
            throw new Error('Seleccione un turno válido.');
        }

        const id = await crearPedido(idSucursal, turno);

        pedidoActual = id;
        modalPedido.hide();

        const aviso = await actualizarTrasGuardar();

        if (aviso) {
            await Swal.fire({
                icon: 'warning',
                title: 'Pedido creado con ID: ' + id,
                text: aviso
            });
        } else {
            mostrarExito('Pedido creado con ID: ' + id);
        }
    });
}

async function enviarDetalle(e) {
    e.preventDefault();

    await tarea(async () => {
        const idPedido = idValido(pedidoActual);

        const idProducto = idValido(
            document.getElementById('cmbProductoDetalle').value
        );

        const cantidad = numero(
            document.getElementById('cantidadDetalle').value
        );

        if (cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor que cero.');
        }

        // Primero confirmar el detalle y el descuento de existencias.
        await insertarDetalle(idPedido, idProducto, cantidad);

        document.getElementById('cmbProductoDetalle').value = '';
        document.getElementById('cantidadDetalle').value = '1';

        let mensajeAuto = '';
        let errorAuto = '';

        // produccion.js ya se encarga del correo.
        // No enviar otro correo aquí para evitar duplicados.
        try {
            const servicio = await import('./produccion.js');

            mensajeAuto = await servicio.reabastecerAutomaticamente();

        } catch (error) {
            console.error('Error en reabastecimiento:', error);
            errorAuto = errorTexto(error);
        }

        const avisoPantalla = await actualizarTrasGuardar();

        if (errorAuto) {
            await Swal.fire({
                icon: 'warning',
                title: 'Detalle guardado',
                text:
                    'El detalle se guardó y su stock se descontó. ' +
                    'Falló el proceso posterior de reabastecimiento: ' +
                    errorAuto +
                    (avisoPantalla ? '\n\n' + avisoPantalla : '') +
                    '\n\nNo vuelvas a agregar el mismo detalle.'
            });

            return;
        }

        const sinCambios =
            'No hay productos con stock menor de 10.';

        const hayAvisoAuto =
            mensajeAuto && mensajeAuto !== sinCambios;

        if (hayAvisoAuto || avisoPantalla) {
            await Swal.fire({
                icon: avisoPantalla ||
                    mensajeAuto.includes('No se completó el aviso')
                    ? 'warning'
                    : 'info',
                title: 'Detalle guardado',
                text: [
                    'Detalle agregado. Stock descontado.',
                    hayAvisoAuto ? mensajeAuto : '',
                    avisoPantalla
                ].filter(Boolean).join('\n\n')
            });

        } else {
            mostrarExito('Detalle agregado. Stock descontado.');
        }
    });
}

async function confirmarAnulacion(idPedido, idDetalle = null) {
    await tarea(async () => {
        const resultado = await Swal.fire({
            title: idDetalle === null
                ? '¿Anular pedido?'
                : '¿Anular detalle?',
            text: 'El stock será devuelto.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'Sí, anular',
            cancelButtonText: 'Cancelar'
        });

        if (!resultado.isConfirmed) return;

        await cancelar(
            idValido(idPedido),
            idDetalle === null ? null : idValido(idDetalle)
        );

        const aviso = await actualizarTrasGuardar();

        if (aviso) {
            await Swal.fire({
                icon: 'warning',
                title: 'Anulación completada; stock devuelto',
                text: aviso
            });
        } else {
            mostrarExito('Anulación completada. Stock devuelto.');
        }
    });
}

async function confirmarEntrega(idPedido) {
    await tarea(async () => {
        const resultado = await Swal.fire({
            title: '¿Marcar como entregado?',
            text: 'El pedido debe estar en ruta.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            confirmButtonText: 'Sí, entregar',
            cancelButtonText: 'Cancelar'
        });

        if (!resultado.isConfirmed) return;

        await entregar(idValido(idPedido));

        const aviso = await actualizarTrasGuardar();

        if (aviso) {
            await Swal.fire({
                icon: 'warning',
                title: 'Pedido entregado',
                text: aviso
            });
        } else {
            mostrarExito('Pedido entregado correctamente.');
        }
    });
}

// ============================================
// INICIO
// ============================================

async function iniciar() {
    if (!await verificarSesion(['ADMIN', 'SUCURSAL'])) return;

    autorizado = true;

    renderMenu('pedidos');

    modalPedido = new bootstrap.Modal(
        document.getElementById('modalPedido')
    );

    modalDetalle = new bootstrap.Modal(
        document.getElementById('modalDetalle')
    );

    document.getElementById('contenidoPedidos').hidden = false;

    document.getElementById('btnNuevoPedido')
        .addEventListener('click', () => {
            if (ocupado) return;

            document.getElementById('formPedido').reset();
            document.getElementById('ruta').value = '';

            modalPedido.show();
        });

    document.getElementById('btnActualizarPedidos')
        .addEventListener('click', () => tarea(actualizar));

    document.getElementById('idSucursal')
        .addEventListener('change', actualizarRuta);

    document.getElementById('formPedido')
        .addEventListener('submit', enviarPedido);

    document.getElementById('formDetallePedido')
        .addEventListener('submit', enviarDetalle);

    await tarea(actualizar);
}

iniciar().catch(error => {
    console.error('Error al iniciar pedidos:', error);
    mostrarError(errorTexto(error));
});