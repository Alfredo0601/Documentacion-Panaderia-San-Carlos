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

// ============================================
// VARIABLES Y UTILIDADES
// ============================================

let autorizado = false;
let ocupado = false;
let produccionActual = null;
let modalProduccion;
let modalDetalle;

let productosVista = new Map();
let produccionesVista = [];
let detallesVista = [];

const activo = dato =>
    dato &&
    dato._syncEliminado !== true &&
    Number(dato.ESTADO) === 1;

const ref = (coleccion, id) =>
    doc(db, coleccion, String(id));

function numero(valor) {
    const n = Number(valor);

    if (!Number.isFinite(n)) {
        throw new Error('Cantidad inválida.');
    }

    return n;
}

function idNumero(valor) {
    const n = Number(valor);

    if (!Number.isSafeInteger(n) || n <= 0) {
        throw new Error('Identificador inválido.');
    }

    return n;
}

function redondear(valor) {
    const n = Math.round(valor * 1e9) / 1e9;

    if (!Number.isFinite(n)) {
        throw new Error('Cantidad fuera de rango.');
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
    if (error.code === 'permission-denied') {
        return 'Firestore rechazó la operación. Revisa las reglas.';
    }

    return error.message || 'No se pudo completar la operación.';
}

function datosDocumento(documento) {
    return {
        ...documento.data(),
        _documento: documento.id
    };
}

// ============================================
// PLANES DE TRANSACCIÓN
// ============================================

function nuevoPlan() {
    return {
        referencias: new Map(),
        contadores: new Map()
    };
}

function incluir(plan, referencia) {
    plan.referencias.set(referencia.path, referencia);
    return referencia;
}

async function prepararContador(
    plan,
    nombre,
    campoId = null,
    reservas = 0
) {
    const referencia = ref('contadores', nombre);
    const documento = await getDocFromServer(referencia);

    const previo = documento.exists()
        ? documento.data().ULTIMO_ID
        : 0;

    if (!Number.isSafeInteger(previo) || previo < 0) {
        throw new Error('Contador inválido: ' + nombre);
    }

    let base = previo;

    if (!documento.exists() && campoId) {
        const resultado = await getDocsFromServer(
            query(
                collection(db, nombre),
                orderBy(campoId, 'desc'),
                limit(1)
            )
        );

        if (!resultado.empty) {
            base = Math.max(
                base,
                idNumero(resultado.docs[0].data()[campoId])
            );
        }
    }

    if (!Number.isSafeInteger(base + reservas)) {
        throw new Error('No se puede generar otro ID.');
    }

    incluir(plan, referencia);

    plan.contadores.set(nombre, {
        referencia,
        existia: documento.exists(),
        previo,
        base,
        reservas
    });

    for (let i = 1; i <= reservas; i++) {
        incluir(plan, ref(nombre, base + i));
    }
}

function datosNuevos(uid) {
    return {
        ESTADO: 1,
        _syncEliminado: false,
        CREADO_POR: uid,
        FECHA_CREACION: serverTimestamp()
    };
}

async function ejecutar(preparar) {
    const usuario = auth.currentUser;

    if (!usuario) {
        throw new Error('La sesión no está disponible.');
    }

    for (let intento = 0; intento < 4; intento++) {
        const plan = nuevoPlan();
        const aplicar = await preparar(plan);

        try {
            return await runTransaction(db, async tx => {
                const referencias = [...plan.referencias.values()];

                const documentos = await Promise.all(
                    referencias.map(referencia => tx.get(referencia))
                );

                const leidos = new Map(
                    documentos.map(documento => [
                        documento.ref.path,
                        documento
                    ])
                );

                for (const contador of plan.contadores.values()) {
                    const actual = leidos.get(contador.referencia.path);
                    const valor = actual.exists()
                        ? actual.data().ULTIMO_ID
                        : 0;

                    if (
                        actual.exists() !== contador.existia ||
                        valor !== contador.previo
                    ) {
                        const error = new Error('Los datos cambiaron.');
                        error.code = 'repreparar';
                        throw error;
                    }
                }

                const escrituras = new Map();
                const usados = new Map();
                const stocks = new Map();

                const ctx = {
                    uid: usuario.uid,

                    leer(referencia) {
                        const documento = leidos.get(referencia.path);

                        if (!documento) {
                            throw new Error(
                                'Lectura no preparada: ' + referencia.path
                            );
                        }

                        return documento.exists()
                            ? documento.data()
                            : null;
                    },

                    siguiente(nombre) {
                        const contador = plan.contadores.get(nombre);
                        const cantidad = (usados.get(nombre) || 0) + 1;

                        if (!contador || cantidad > contador.reservas) {
                            throw new Error('Reserva de IDs insuficiente.');
                        }

                        usados.set(nombre, cantidad);
                        return contador.base + cantidad;
                    },

                    crear(referencia, data) {
                        if (ctx.leer(referencia)) {
                            throw new Error(
                                'Ya existe el registro ' + referencia.id
                            );
                        }

                        escrituras.set(referencia.path, {
                            referencia,
                            crear: true,
                            data
                        });
                    },

                    actualizar(referencia, data) {
                        if (!ctx.leer(referencia)) {
                            throw new Error('El registro ya no existe.');
                        }

                        const anterior = escrituras.get(referencia.path);

                        escrituras.set(referencia.path, {
                            referencia,
                            crear: false,
                            data: {
                                ...anterior?.data,
                                ...data
                            }
                        });
                    },

                    stock(id) {
                        const referencia = ref('productos', id);

                        if (stocks.has(referencia.path)) {
                            return stocks.get(referencia.path);
                        }

                        const producto = ctx.leer(referencia);

                        if (
                            !producto ||
                            producto._syncEliminado === true
                        ) {
                            throw new Error('No existe el producto #' + id);
                        }

                        return numero(producto.STOCK);
                    },

                    mover(id, cantidad) {
                        const referencia = ref('productos', id);

                        stocks.set(
                            referencia.path,
                            redondear(ctx.stock(id) + cantidad)
                        );
                    },

                    anular(referencia) {
                        if (!activo(ctx.leer(referencia))) {
                            throw new Error('El registro ya está anulado.');
                        }

                        ctx.actualizar(referencia, {
                            ESTADO: 0,
                            MODIFICADO_POR: usuario.uid,
                            FECHA_MODIFICACION: serverTimestamp()
                        });
                    },

                    auditar(accion, descripcion) {
                        const referencia = doc(collection(db, 'auditoria'));

                        escrituras.set(referencia.path, {
                            referencia,
                            crear: true,
                            data: {
                                ID_AUDITORIA: referencia.id,
                                ACCION: accion,
                                DESCRIPCION: descripcion.slice(0, 10000),
                                USUARIO: usuario.uid,
                                FECHA: serverTimestamp(),
                                _syncEliminado: false
                            }
                        });
                    }
                };

                const resultado = aplicar(ctx);

                for (const [ruta, stock] of stocks) {
                    const referencia = plan.referencias.get(ruta);
                    const producto = ctx.leer(referencia);

                    if (stock < 0) {
                        throw new Error(
                            'Stock insuficiente de ' + producto.NOMBRE +
                            '. No se guardó ningún cambio.'
                        );
                    }

                    ctx.actualizar(referencia, {
                        STOCK: stock,
                        MODIFICADO_POR: usuario.uid,
                        FECHA_MODIFICACION: serverTimestamp()
                    });
                }

                for (const [nombre, cantidad] of usados) {
                    const contador = plan.contadores.get(nombre);

                    escrituras.set(contador.referencia.path, {
                        referencia: contador.referencia,
                        crear: true,
                        data: {
                            ULTIMO_ID: contador.base + cantidad
                        }
                    });
                }

                if (escrituras.size > 400) {
                    throw new Error(
                        'La operación es demasiado grande. ' +
                        'No se guardó ningún cambio.'
                    );
                }

                for (const escritura of escrituras.values()) {
                    if (escritura.crear) {
                        tx.set(escritura.referencia, escritura.data);
                    } else {
                        tx.update(escritura.referencia, escritura.data);
                    }
                }

                return resultado;
            });

        } catch (error) {
            if (error.code === 'repreparar') continue;
            throw error;
        }
    }

    throw new Error('Hay cambios simultáneos. Intenta nuevamente.');
}

// ============================================
// RECETAS E INVENTARIO
// ============================================

async function prepararRecetas(plan, idsProductos) {
    const grupos = new Map();

    await prepararContador(plan, 'recetas');

    await Promise.all([...new Set(idsProductos)].map(async id => {
        const resultado = await getDocsFromServer(
            query(
                collection(db, 'recetas'),
                where('ID_PRODUCTO', '==', Number(id))
            )
        );

        grupos.set(Number(id), resultado.docs.map(documento => {
            incluir(plan, documento.ref);

            const dato = documento.data();

            if (dato.ID_INSUMO != null) {
                incluir(plan, ref('productos', dato.ID_INSUMO));
            }

            return documento.ref;
        }));
    }));

    return grupos;
}

function calcularConsumos(ctx, referencias, cantidad) {
    const totales = new Map();

    for (const referencia of referencias || []) {
        const receta = ctx.leer(referencia);

        if (!activo(receta)) continue;

        const id = idNumero(receta.ID_INSUMO);
        const porUnidad = numero(receta.CANTIDAD);

        if (porUnidad <= 0) {
            throw new Error('La receta contiene una cantidad inválida.');
        }

        totales.set(
            id,
            redondear(
                (totales.get(id) || 0) + porUnidad * cantidad
            )
        );
    }

    return [...totales].map(([ID_INSUMO, CANTIDAD]) => ({
        ID_INSUMO,
        CANTIDAD
    }));
}

function verificarConsumos(ctx, consumos) {
    for (const consumo of consumos) {
        const producto = ctx.leer(
            ref('productos', consumo.ID_INSUMO)
        );

        if (!activo(producto) || producto.TIPO !== 'INSUMO') {
            throw new Error(
                'El insumo #' + consumo.ID_INSUMO +
                ' no está disponible.'
            );
        }

        if (ctx.stock(consumo.ID_INSUMO) < consumo.CANTIDAD) {
            throw new Error(
                'No hay suficiente ' + producto.NOMBRE +
                ' (necesita ' + consumo.CANTIDAD +
                ', hay ' + ctx.stock(consumo.ID_INSUMO) + ').'
            );
        }
    }
}

function crearCabecera(ctx, turno, observacion) {
    const id = ctx.siguiente('producciones');

    ctx.crear(ref('producciones', id), {
        ID_PRODUCCION: id,
        FECHA: serverTimestamp(),
        TURNO: turno,
        OBSERVACION: observacion,
        ...datosNuevos(ctx.uid)
    });

    return id;
}

function registrarDetalle(
    ctx,
    idProduccion,
    idProducto,
    cantidad,
    consumos
) {
    const id = ctx.siguiente('detalles_produccion');

    ctx.crear(ref('detalles_produccion', id), {
        ID_DETALLE_PRODUCCION: id,
        ID_PRODUCCION: idProduccion,
        ID_PRODUCTO: idProducto,
        CANTIDAD_PRODUCIDA: cantidad,
        CONSUMOS: consumos,
        ...datosNuevos(ctx.uid)
    });

    ctx.mover(idProducto, cantidad);

    for (const consumo of consumos) {
        ctx.mover(consumo.ID_INSUMO, -consumo.CANTIDAD);
    }

    return id;
}

// ============================================
// CREAR PRODUCCIÓN
// ============================================

async function crearProduccion(turno, observacion) {
    return ejecutar(async plan => {
        await prepararContador(
            plan,
            'producciones',
            'ID_PRODUCCION',
            1
        );

        return ctx => {
            const id = crearCabecera(ctx, turno, observacion);

            ctx.auditar(
                'NUEVA_PRODUCCION',
                'Se registró la producción #' + id +
                ' en turno ' + turno
            );

            return id;
        };
    });
}

async function producir(idProduccion, idProducto, cantidad) {
    return ejecutar(async plan => {
        await prepararContador(
            plan,
            'detalles_produccion',
            'ID_DETALLE_PRODUCCION',
            1
        );

        const recetas = await prepararRecetas(plan, [idProducto]);

        incluir(plan, ref('producciones', idProduccion));
        incluir(plan, ref('productos', idProducto));

        return ctx => {
            const cabecera = ctx.leer(
                ref('producciones', idProduccion)
            );

            const producto = ctx.leer(
                ref('productos', idProducto)
            );

            if (!activo(cabecera)) {
                throw new Error('La producción ya no está activa.');
            }

            if (!activo(producto) || producto.TIPO !== 'FINAL') {
                throw new Error('El pan ya no está disponible.');
            }

            const consumos = calcularConsumos(
                ctx,
                recetas.get(idProducto),
                cantidad
            );

            verificarConsumos(ctx, consumos);

            registrarDetalle(
                ctx,
                idProduccion,
                idProducto,
                cantidad,
                consumos
            );

            ctx.auditar(
                'DETALLE_PRODUCCION',
                'Producción #' + idProduccion + ': ' +
                cantidad + ' de ' + producto.NOMBRE
            );
        };
    });
}

// ============================================
// REABASTECIMIENTO DE 50 UNIDADES
// ============================================

async function ejecutarReabastecimiento() {
    return ejecutar(async plan => {
        await prepararContador(plan, 'productos');

        const resultado = await getDocsFromServer(
            query(
                collection(db, 'productos'),
                where('ESTADO', '==', 1)
            )
        );

        const candidatos = resultado.docs
            .filter(documento =>
                documento.data()._syncEliminado !== true &&
                numero(documento.data().STOCK) < 10
            )
            .sort((a, b) => {
                const orden = { INSUMO: 0, FINAL: 1 };

                return (orden[a.data().TIPO] ?? 2) -
                    (orden[b.data().TIPO] ?? 2) ||
                    Number(a.data().ID_PRODUCTO) -
                    Number(b.data().ID_PRODUCTO);
            });

        if (!candidatos.length) {
            return () => 'No hay productos con stock menor de 10.';
        }

        await Promise.all([
            prepararContador(
                plan,
                'producciones',
                'ID_PRODUCCION',
                1
            ),
            prepararContador(
                plan,
                'detalles_produccion',
                'ID_DETALLE_PRODUCCION',
                candidatos.length
            )
        ]);

        for (const documento of candidatos) {
            incluir(plan, documento.ref);
        }

        const finales = candidatos
            .filter(d => d.data().TIPO === 'FINAL')
            .map(d => idNumero(d.data().ID_PRODUCTO));

        const recetas = await prepararRecetas(plan, finales);

        return ctx => {
            let idProduccion = null;

            const generados = [];
            const errores = [];

            const seleccionados = candidatos.filter(documento => {
                const producto = ctx.leer(documento.ref);

                return activo(producto) &&
                    ctx.stock(producto.ID_PRODUCTO) < 10;
            });

            for (const documento of seleccionados) {
                const producto = ctx.leer(documento.ref);
                const id = idNumero(producto.ID_PRODUCTO);

                let consumos = [];

                try {
                    if (producto.TIPO === 'FINAL') {
                        consumos = calcularConsumos(
                            ctx,
                            recetas.get(id),
                            50
                        );

                        verificarConsumos(ctx, consumos);

                    } else if (producto.TIPO !== 'INSUMO') {
                        throw new Error('Tipo de producto inválido.');
                    }

                } catch (error) {
                    errores.push(
                        producto.NOMBRE + ': ' + error.message
                    );

                    continue;
                }

                if (idProduccion === null) {
                    idProduccion = crearCabecera(
                        ctx,
                        'AUTO',
                        'Generación automática por stock bajo'
                    );
                }

                registrarDetalle(
                    ctx,
                    idProduccion,
                    id,
                    50,
                    consumos
                );

                generados.push(producto.NOMBRE);
            }

            if (!generados.length) {
                return errores.length
                    ? 'No se pudo producir: ' + errores.join(' ')
                    : 'No hay productos con stock menor de 10.';
            }

            const mensaje =
                'Se generaron 50 unidades para: ' +
                generados.join(', ') +
                (errores.length
                    ? '. No se pudo producir: ' + errores.join(' ')
                    : '.');

            ctx.auditar('AUTO_PRODUCCION', mensaje);

            return mensaje;
        };
    });
}

// ============================================
// CORREOS DE REABASTECIMIENTO Y STOCK BAJO
// ============================================

async function reabastecerAutomaticamente() {
    const mensaje = await ejecutarReabastecimiento();

    try {
        const aviso = await notificarInventario(mensaje);

        return mensaje + (aviso ? '\n\n' + aviso : '');

    } catch (error) {
        console.error(
            'Proceso de inventario completado; falló el aviso:',
            error
        );

        return mensaje +
            '\n\nEl proceso de inventario terminó. ' +
            'No se completó el aviso por correo: ' +
            (error.message || 'Error de conexión.');
    }
}

async function notificarInventario(mensajeAuto) {
    const huboGeneracion = mensajeAuto.startsWith(
        'Se generaron 50 unidades para:'
    );

    const resultado = await getDocsFromServer(
        collection(db, 'productos')
    );

    const bajos = resultado.docs
        .map(d => d.data())
        .filter(p =>
            activo(p) &&
            numero(p.STOCK) <= numero(p.STOCK_MINIMO)
        )
        .sort((a, b) =>
            Number(a.ID_PRODUCTO) - Number(b.ID_PRODUCTO)
        );

    // Evitar el mismo aviso de stock durante una hora
    // en este navegador. Otros dispositivos tienen su propio registro.
    const llave = 'panaderia-aviso-stock-v1';

    const firma = JSON.stringify(
        bajos.map(p => [
            p.ID_PRODUCTO,
            p.STOCK,
            p.STOCK_MINIMO,
            p.NOMBRE,
            p.UNIDAD_MEDIDA
        ])
    );

    let previo = null;

    try {
        previo = JSON.parse(
            localStorage.getItem(llave) || 'null'
        );
    } catch (_) {
        // El navegador puede bloquear el almacenamiento local.
    }

    const repetido =
        previo?.firma === firma &&
        Date.now() - previo.fecha >= 0 &&
        Date.now() - previo.fecha < 60 * 60 * 1000;

    const avisarBajos = bajos.length > 0 && !repetido;

    if (!huboGeneracion && !avisarBajos) {
        return '';
    }

    const lineas = [
        'AVISO DE INVENTARIO',
        '',
        'Fecha: ' + new Date().toLocaleString('es-GT', {
            timeZone: 'America/Guatemala'
        }) + ' (Guatemala)',
        ''
    ];

    if (huboGeneracion) {
        lineas.push(
            'REABASTECIMIENTO GUARDADO',
            mensajeAuto,
            ''
        );
    }

    if (bajos.length) {
        lineas.push('STOCK BAJO DESPUÉS DE LA OPERACIÓN');

        bajos.forEach(p => {
            lineas.push(
                `${p.TIPO} | ${p.CODIGO || '-'} | ${p.NOMBRE} | ` +
                `Stock: ${numero(p.STOCK)} ` +
                `${p.UNIDAD_MEDIDA || ''} | ` +
                `Mínimo: ${numero(p.STOCK_MINIMO)}`
            );
        });

    } else {
        lineas.push(
            'No hay productos activos con stock igual o inferior al mínimo.'
        );
    }

    const { enviarCorreo } = await import('./correo.js');

    await enviarCorreo(
        huboGeneracion
            ? 'Reabastecimiento automático - Panadería San Carlos'
            : 'Alerta de stock bajo - Panadería San Carlos',
        lineas.join('\n')
    );

    // Guardar la firma solo después de aceptar el envío.
    try {
        localStorage.setItem(
            llave,
            JSON.stringify({
                firma,
                fecha: Date.now()
            })
        );
    } catch (_) {
        // El envío ya fue aceptado.
    }

    return 'EmailJS aceptó el aviso de inventario para su envío.';
}

// ============================================
// ANULAR DETALLE O PRODUCCIÓN
// ============================================

async function cancelar(idProduccion, idDetalle = null) {
    return ejecutar(async plan => {
        await prepararContador(plan, 'detalles_produccion');

        const referenciaCabecera = incluir(
            plan,
            ref('producciones', idProduccion)
        );

        let documentos;

        if (idDetalle !== null) {
            const documento = await getDocFromServer(
                ref('detalles_produccion', idDetalle)
            );

            if (!documento.exists()) {
                throw new Error('El detalle no existe.');
            }

            documentos = [documento];

        } else {
            const resultado = await getDocsFromServer(
                query(
                    collection(db, 'detalles_produccion'),
                    where('ID_PRODUCCION', '==', idProduccion)
                )
            );

            documentos = resultado.docs;
        }

        const heredados = [];

        for (const documento of documentos) {
            incluir(plan, documento.ref);

            const detalle = documento.data();

            incluir(plan, ref('productos', detalle.ID_PRODUCTO));

            if (Array.isArray(detalle.CONSUMOS)) {
                for (const consumo of detalle.CONSUMOS) {
                    incluir(
                        plan,
                        ref('productos', consumo.ID_INSUMO)
                    );
                }
            } else {
                heredados.push(idNumero(detalle.ID_PRODUCTO));
            }
        }

        const recetas = heredados.length
            ? await prepararRecetas(plan, heredados)
            : new Map();

        return ctx => {
            const cabecera = ctx.leer(referenciaCabecera);

            if (!activo(cabecera)) {
                throw new Error('La producción ya está anulada.');
            }

            for (const documento of documentos) {
                const detalle = ctx.leer(documento.ref);

                if (!activo(detalle)) {
                    if (idDetalle !== null) {
                        throw new Error('El detalle ya está anulado.');
                    }

                    continue;
                }

                if (Number(detalle.ID_PRODUCCION) !== idProduccion) {
                    throw new Error(
                        'El detalle no corresponde a esta producción.'
                    );
                }

                const consumos = Array.isArray(detalle.CONSUMOS)
                    ? detalle.CONSUMOS
                    : calcularConsumos(
                        ctx,
                        recetas.get(Number(detalle.ID_PRODUCTO)),
                        numero(detalle.CANTIDAD_PRODUCIDA)
                    );

                ctx.mover(
                    detalle.ID_PRODUCTO,
                    -numero(detalle.CANTIDAD_PRODUCIDA)
                );

                for (const consumo of consumos) {
                    ctx.mover(
                        consumo.ID_INSUMO,
                        numero(consumo.CANTIDAD)
                    );
                }

                ctx.anular(documento.ref);
            }

            if (idDetalle === null) {
                ctx.anular(referenciaCabecera);
            }

            ctx.auditar(
                idDetalle === null
                    ? 'PRODUCCION_CANCELADA'
                    : 'DETALLE_PRODUCCION_CANCELADO',
                idDetalle === null
                    ? 'Se anuló la producción #' + idProduccion
                    : 'Se anuló el detalle #' + idDetalle
            );
        };
    });
}

// ============================================
// INTERFAZ
// ============================================

function controles() {
    document.querySelectorAll(
        '#contenidoProduccion button, ' +
        '#modalProduccion button[type="submit"], ' +
        '#tablaDetalle button'
    ).forEach(boton => {
        boton.disabled = ocupado || !autorizado;
    });

    const cabecera = produccionesVista.find(
        p => Number(p.ID_PRODUCCION) === Number(produccionActual)
    );

    const permitir = autorizado && !ocupado && activo(cabecera);

    document.getElementById('btnAgregar').disabled = !permitir;
    document.getElementById('cmbProductoDetalle').disabled = !permitir;
    document.getElementById('cantidadDetalle').disabled = !permitir;
}

function crearBoton(texto, clase, accion) {
    const boton = document.createElement('button');

    boton.type = 'button';
    boton.className = 'btn btn-sm ' + clase;
    boton.textContent = texto;
    boton.addEventListener('click', accion);

    return boton;
}

function dibujarProducciones() {
    const tabla = document.getElementById('tablaProduccion');
    tabla.replaceChildren();

    const registros = produccionesVista
        .filter(p => p._syncEliminado !== true)
        .sort((a, b) =>
            Number(b.ID_PRODUCCION) - Number(a.ID_PRODUCCION)
        );

    if (!registros.length) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    No hay producciones.
                </td>
            </tr>
        `;
    }

    for (const produccion of registros) {
        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${escapar(produccion.ID_PRODUCCION)}</td>
            <td>${escapar(fechaTexto(produccion.FECHA))}</td>
            <td>
                <span class="badge bg-info">
                    ${escapar(produccion.TURNO)}
                </span>
            </td>
            <td>${escapar(produccion.OBSERVACION || '-')}</td>
            <td>
                <span class="badge ${
                    activo(produccion) ? 'bg-success' : 'bg-secondary'
                }">
                    ${activo(produccion) ? 'Activo' : 'Anulado'}
                </span>
            </td>
            <td></td>
        `;

        fila.lastElementChild.append(
            crearBoton('Detalle', 'btn-primary me-1', () =>
                abrirDetalle(produccion.ID_PRODUCCION)
            )
        );

        if (activo(produccion)) {
            fila.lastElementChild.append(
                crearBoton('Anular', 'btn-danger', () =>
                    solicitarAnulacion(produccion.ID_PRODUCCION)
                )
            );
        }

        tabla.append(fila);
    }
}

function dibujarProductos() {
    const select = document.getElementById('cmbProductoDetalle');
    const anterior = select.value;

    select.replaceChildren(
        new Option('-- Seleccione --', '')
    );

    [...productosVista.values()]
        .filter(p => activo(p) && p.TIPO === 'FINAL')
        .sort((a, b) =>
            String(a.NOMBRE).localeCompare(String(b.NOMBRE))
        )
        .forEach(producto => {
            select.add(new Option(
                `${producto.NOMBRE} (${producto.CODIGO})`,
                String(producto.ID_PRODUCTO)
            ));
        });

    if ([...select.options].some(o => o.value === anterior)) {
        select.value = anterior;
    }
}

function dibujarDetalles() {
    const tabla = document.getElementById('tablaDetalle');

    document.getElementById('idProduccionDetalle').textContent =
        produccionActual || '';

    tabla.replaceChildren();

    const cabecera = produccionesVista.find(
        p => Number(p.ID_PRODUCCION) === Number(produccionActual)
    );

    const detalles = detallesVista
        .filter(d => d._syncEliminado !== true)
        .sort((a, b) =>
            Number(a.ID_DETALLE_PRODUCCION) -
            Number(b.ID_DETALLE_PRODUCCION)
        );

    if (!detalles.length) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    Sin detalles.
                </td>
            </tr>
        `;
    }

    for (const detalle of detalles) {
        const producto = productosVista.get(
            String(detalle.ID_PRODUCTO)
        );

        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${escapar(producto?.NOMBRE || detalle.ID_PRODUCTO)}</td>
            <td>
                <code>${escapar(producto?.CODIGO || '-')}</code>
            </td>
            <td class="fw-bold">
                ${escapar(detalle.CANTIDAD_PRODUCIDA)}
            </td>
            <td>
                <span class="badge ${
                    activo(detalle) ? 'bg-success' : 'bg-secondary'
                }">
                    ${activo(detalle) ? 'Activo' : 'Anulado'}
                </span>
            </td>
            <td></td>
        `;

        if (activo(detalle) && activo(cabecera)) {
            fila.lastElementChild.append(
                crearBoton('Anular', 'btn-danger', () =>
                    solicitarAnulacion(
                        detalle.ID_PRODUCCION,
                        detalle.ID_DETALLE_PRODUCCION
                    )
                )
            );

        } else {
            fila.lastElementChild.textContent = 'Anulado';
        }

        tabla.append(fila);
    }

    controles();
}

async function actualizar() {
    const consultas = [
        getDocsFromServer(collection(db, 'producciones')),
        getDocsFromServer(collection(db, 'productos'))
    ];

    if (produccionActual !== null) {
        consultas.push(
            getDocsFromServer(
                query(
                    collection(db, 'detalles_produccion'),
                    where('ID_PRODUCCION', '==', produccionActual)
                )
            )
        );
    }

    const [producciones, productos, detalles] =
        await Promise.all(consultas);

    produccionesVista = producciones.docs.map(datosDocumento);

    productosVista = new Map(
        productos.docs.map(documento => [
            String(documento.data().ID_PRODUCTO),
            datosDocumento(documento)
        ])
    );

    detallesVista = detalles
        ? detalles.docs.map(datosDocumento)
        : [];

    dibujarProducciones();
    dibujarProductos();
    dibujarDetalles();
}

async function tarea(accion) {
    if (!autorizado || ocupado) return;

    ocupado = true;
    controles();

    try {
        await accion();

    } catch (error) {
        console.error('Error de producción:', error);
        await mostrarError(errorTexto(error));

    } finally {
        ocupado = false;
        controles();
    }
}

async function abrirDetalle(id) {
    await tarea(async () => {
        produccionActual = idNumero(id);
        detallesVista = [];

        document.getElementById('idProduccionDetalle').textContent =
            produccionActual;

        document.getElementById('tablaDetalle').innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    Cargando...
                </td>
            </tr>
        `;

        modalDetalle.show();

        const [detalles, cabecera] = await Promise.all([
            getDocsFromServer(
                query(
                    collection(db, 'detalles_produccion'),
                    where('ID_PRODUCCION', '==', produccionActual)
                )
            ),
            getDocFromServer(
                ref('producciones', produccionActual)
            )
        ]);

        detallesVista = detalles.docs.map(datosDocumento);

        if (cabecera.exists()) {
            produccionesVista = produccionesVista.filter(
                p => Number(p.ID_PRODUCCION) !== produccionActual
            );

            produccionesVista.push(cabecera.data());
        }

        dibujarDetalles();
    });
}

// ============================================
// EVENTOS
// ============================================

async function guardarCabecera(e) {
    e.preventDefault();

    const turno = document.getElementById('turno').value;
    const observacion = document.getElementById('observacion')
        .value.trim();

    if (
        !['MAÑANA', 'TARDE'].includes(turno) ||
        observacion.length > 1000
    ) {
        mostrarError('Revise el turno y la observación.');
        return;
    }

    await tarea(async () => {
        const id = await crearProduccion(turno, observacion);

        produccionActual = id;
        modalProduccion.hide();

        await actualizar();

        mostrarExito('Producción creada con ID: ' + id);
    });
}

async function agregarDetalle(e) {
    e.preventDefault();

    await tarea(async () => {
        const idProduccion = idNumero(produccionActual);

        const idProducto = idNumero(
            document.getElementById('cmbProductoDetalle').value
        );

        const cantidad = numero(
            document.getElementById('cantidadDetalle').value
        );

        if (cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor que cero.');
        }

        await producir(idProduccion, idProducto, cantidad);

        document.getElementById('cantidadDetalle').value = '1';
        document.getElementById('cmbProductoDetalle').value = '';

        let mensajeAuto = '';
        let errorAuto = '';

        try {
            mensajeAuto = await reabastecerAutomaticamente();
        } catch (error) {
            errorAuto = errorTexto(error);
        }

        await actualizar();

        if (errorAuto) {
            await Swal.fire({
                icon: 'warning',
                title: 'Producción guardada',
                text:
                    'El detalle sí se guardó. Falló únicamente ' +
                    'el reabastecimiento automático: ' + errorAuto
            });

        } else if (
            mensajeAuto &&
            mensajeAuto !== 'No hay productos con stock menor de 10.'
        ) {
            await Swal.fire({
                icon: 'info',
                title: 'Producción y reabastecimiento',
                text: mensajeAuto
            });

        } else {
            mostrarExito(
                'Producción registrada. Insumos descontados.'
            );
        }
    });
}

async function solicitarAnulacion(idProduccion, idDetalle = null) {
    await tarea(async () => {
        const produccion = idNumero(idProduccion);

        const detalle = idDetalle === null
            ? null
            : idNumero(idDetalle);

        const confirmacion = await Swal.fire({
            title: detalle === null
                ? '¿Anular producción?'
                : '¿Anular detalle?',
            text:
                'Se devolverán insumos y bajará el stock del producto. ' +
                'Los registros importados sin consumo guardado ' +
                'utilizan la receta actual.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'Sí, anular',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmacion.isConfirmed) return;

        await cancelar(produccion, detalle);
        await actualizar();

        mostrarExito('Anulación completada. Stock actualizado.');
    });
}

// ============================================
// INICIO
// ============================================

async function iniciar() {
    if (!await verificarSesion(['ADMIN'])) return;

    autorizado = true;
    renderMenu('produccion');

    modalProduccion = new bootstrap.Modal(
        document.getElementById('modalProduccion')
    );

    modalDetalle = new bootstrap.Modal(
        document.getElementById('modalDetalle')
    );

    document.getElementById('contenidoProduccion').hidden = false;

    document.getElementById('btnNueva').addEventListener('click', () => {
        if (ocupado) return;

        document.getElementById('formProduccion').reset();
        modalProduccion.show();
    });

    document.getElementById('btnActualizar').addEventListener(
        'click',
        () => tarea(actualizar)
    );

    document.getElementById('btnAuto').addEventListener(
        'click',
        () => tarea(async () => {
            const mensaje = await reabastecerAutomaticamente();

            await actualizar();

            await Swal.fire({
                icon: 'info',
                title: 'Reabastecimiento',
                text: mensaje
            });
        })
    );

    document.getElementById('formProduccion')
        .addEventListener('submit', guardarCabecera);

    document.getElementById('formDetalle')
        .addEventListener('submit', agregarDetalle);

    await tarea(actualizar);
}

// Permite que pedidos.js utilice el mismo reabastecimiento.
export { reabastecerAutomaticamente };

// Iniciar la interfaz únicamente en la página de producción.
if (document.getElementById('contenidoProduccion')) {
    iniciar().catch(error => {
        console.error('Error al iniciar producción:', error);
        mostrarError(errorTexto(error));
    });
}