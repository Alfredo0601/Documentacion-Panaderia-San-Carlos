import { db } from './firebase-config.js';

import {
    enviarCorreo as enviarPorEmailJS
} from './correo.js';

import {
    collection,
    getDocsFromServer
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

// ============================================
// VARIABLES
// ============================================

const charts = {};

let autorizado = false;
let cargando = false;
let gruposInsumos = new Map();

const colores = [
    '#7B2D26',
    '#F4A950',
    '#28a745',
    '#17a2b8',
    '#6f42c1',
    '#dc3545',
    '#ffc107',
    '#495057',
    '#20c997'
];

// ============================================
// UTILIDADES
// ============================================

function numero(valor) {
    const resultado = Number(valor);
    return Number.isFinite(resultado) ? resultado : 0;
}

function clave(valor) {
    return String(valor ?? '');
}

function activo(registro) {
    return numero(registro.ESTADO) === 1;
}

function textoSeguro(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[caracter]));
}

function ponerValor(id, valor) {
    document.getElementById(id).textContent = valor;
}

function sumar(mapa, id, cantidad) {
    mapa.set(id, (mapa.get(id) || 0) + cantidad);
}

function ordenarTop(mapa, nombres, limite = 5) {
    return [...mapa.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limite)
        .map(([id, valor]) => ({
            etiqueta: nombres.get(id) || `ID ${id}`,
            valor
        }));
}

// Fechas de Firebase y fechas importadas desde Oracle.
function fechaLocal(valor) {
    if (valor === null || valor === undefined || valor === '') {
        return null;
    }

    if (typeof valor === 'string') {
        // Las fechas importadas sin zona representan hora de Guatemala.
        const sinZona =
            /^(\d{4}-\d{2}-\d{2})(?:T| )(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

        const partes = valor.match(sinZona);

        if (partes) {
            return {
                dia: partes[1],
                hora: partes[2]
            };
        }
    }

    const fecha = valor?.toDate
        ? valor.toDate()
        : new Date(valor);

    if (!Number.isFinite(fecha.getTime())) {
        return null;
    }

    const partes = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Guatemala',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        })
            .formatToParts(fecha)
            .map(parte => [parte.type, parte.value])
    );

    return {
        dia: `${partes.year}-${partes.month}-${partes.day}`,
        hora: `${partes.hour}:${partes.minute}`
    };
}

// ============================================
// LECTURA DESDE FIRESTORE
// ============================================

async function leerColeccion(nombre) {
    const resultado = await getDocsFromServer(
        collection(db, nombre)
    );

    return resultado.docs
        .map(documento => documento.data())
        .filter(registro => registro._syncEliminado !== true);
}

// ============================================
// GRÁFICAS
// ============================================

function crearGrafica(
    id,
    tipo,
    datos,
    etiqueta,
    fondo,
    horizontal = false
) {
    if (charts[id]) {
        charts[id].destroy();
    }

    const circular = tipo === 'pie' || tipo === 'doughnut';

    charts[id] = new Chart(document.getElementById(id), {
        type: tipo,

        data: {
            labels: datos.map(item => item.etiqueta),

            datasets: [{
                label: etiqueta,
                data: datos.map(item => item.valor),
                backgroundColor: fondo || colores
            }]
        },

        options: {
            responsive: true,

            ...(horizontal ? { indexAxis: 'y' } : {}),

            plugins: {
                legend: {
                    display: circular
                }
            },

            ...(!circular ? {
                scales: {
                    [horizontal ? 'x' : 'y']: {
                        beginAtZero: true
                    }
                }
            } : {})
        }
    });
}

// ============================================
// TABLAS DE STOCK
// ============================================

function mostrarTablaStock(id, productos, mensajeVacio) {
    const tabla = document.getElementById(id);

    tabla.innerHTML = productos.length
        ? productos.map(producto => `
            <tr>
                <td>
                    <code>${textoSeguro(producto.CODIGO)}</code>
                </td>

                <td class="fw-semibold">
                    ${textoSeguro(producto.NOMBRE)}
                </td>

                <td class="text-danger fw-bold">
                    ${textoSeguro(producto.STOCK)}
                </td>

                <td>
                    ${textoSeguro(producto.STOCK_MINIMO)}
                </td>

                <td>
                    ${textoSeguro(producto.UNIDAD_MEDIDA)}
                </td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="5" class="text-center text-success">
                    ${textoSeguro(mensajeVacio)}
                </td>
            </tr>
        `;
}

// ============================================
// CONSUMO ESTIMADO DE INSUMOS
// ============================================

function prepararInsumos(
    recetas,
    cantidadesProducidas,
    productosPorId
) {
    gruposInsumos = new Map();

    for (const receta of recetas.filter(activo)) {
        const cantidadProducida = cantidadesProducidas.get(
            clave(receta.ID_PRODUCTO)
        ) || 0;

        // Estimación con la receta actual por unidad de pan.
        const consumo =
            cantidadProducida * numero(receta.CANTIDAD);

        if (consumo <= 0) continue;

        const idInsumo = clave(receta.ID_INSUMO);
        const insumo = productosPorId.get(idInsumo);

        const unidad = String(
            insumo?.UNIDAD_MEDIDA || 'SIN UNIDAD'
        ).trim().toUpperCase();

        if (!gruposInsumos.has(unidad)) {
            gruposInsumos.set(unidad, {
                cantidades: new Map(),
                nombres: new Map()
            });
        }

        const grupo = gruposInsumos.get(unidad);

        sumar(grupo.cantidades, idInsumo, consumo);

        grupo.nombres.set(
            idInsumo,
            insumo?.NOMBRE || `Insumo ${idInsumo}`
        );
    }

    const selector = document.getElementById('unidadInsumos');
    const seleccionAnterior = selector.value;

    selector.replaceChildren();

    for (const unidad of [...gruposInsumos.keys()].sort()) {
        selector.add(new Option(unidad, unidad));
    }

    if (selector.options.length === 0) {
        selector.add(
            new Option('Sin consumo estimado', '')
        );
    }

    if (gruposInsumos.has(seleccionAnterior)) {
        selector.value = seleccionAnterior;
    }

    dibujarInsumos();
}

function dibujarInsumos() {
    const unidad = document.getElementById('unidadInsumos').value;
    const grupo = gruposInsumos.get(unidad);

    const datos = grupo
        ? ordenarTop(grupo.cantidades, grupo.nombres)
        : [];

    crearGrafica(
        'chartTopInsumos',
        'bar',
        datos,
        `Consumo estimado (${unidad || 'sin datos'})`,
        '#dc3545',
        true
    );
}

// ============================================
// MOSTRAR DATOS DEL DASHBOARD
// ============================================

function mostrarDashboard(datos) {
    const {
        sucursales,
        productos,
        pedidos,
        producciones,
        detalles,
        recetas,
        incidentes
    } = datos;

    const productosActivos = productos.filter(activo);
    const sucursalesActivas = sucursales.filter(activo);

    function contarPedidos(estado) {
        return pedidos.filter(
            pedido => numero(pedido.ESTADO) === estado
        ).length;
    }

    const pedidosActivos = contarPedidos(1);
    const entregados = contarPedidos(2);
    const cancelados = contarPedidos(0);
    const tomados = contarPedidos(3);

    const produccionesActivas = producciones.filter(activo);

    const produccionesCanceladas = producciones.filter(
        produccion => numero(produccion.ESTADO) === 0
    );

    ponerValor('kpiSucursales', sucursalesActivas.length);
    ponerValor('kpiProductos', productosActivos.length);
    ponerValor('kpiPedidosActivos', pedidosActivos);
    ponerValor('kpiPedidosEntregados', entregados);
    ponerValor('kpiPedidosAnulados', cancelados);
    ponerValor('kpiPedidosTomados', tomados);
    ponerValor('kpiProduccionActiva', produccionesActivas.length);
    ponerValor('kpiProduccionAnulada', produccionesCanceladas.length);
    ponerValor('kpiIncidentes', incidentes.length);

    const nombresSucursales = new Map(
        sucursales.map(sucursal => [
            clave(sucursal.ID_SUCURSAL),
            sucursal.NOMBRE
        ])
    );

    const nombresProductos = new Map(
        productos.map(producto => [
            clave(producto.ID_PRODUCTO),
            producto.NOMBRE
        ])
    );

    const productosPorId = new Map(
        productos.map(producto => [
            clave(producto.ID_PRODUCTO),
            producto
        ])
    );

    // Pedidos por sucursal: todos los estados.
    const pedidosPorSucursal = new Map();

    for (const pedido of pedidos) {
        sumar(
            pedidosPorSucursal,
            clave(pedido.ID_SUCURSAL),
            1
        );
    }

    crearGrafica(
        'chartSucursales',
        'bar',
        ordenarTop(
            pedidosPorSucursal,
            nombresSucursales,
            Infinity
        ),
        'Pedidos registrados',
        '#7B2D26'
    );

    crearGrafica(
        'chartEstadoPedidos',
        'doughnut',
        [
            { etiqueta: 'Entregados', valor: entregados },
            { etiqueta: 'Cancelados', valor: cancelados },
            { etiqueta: 'Tomados / En ruta', valor: tomados }
        ],
        'Pedidos',
        ['#28a745', '#dc3545', '#6f42c1']
    );

    crearGrafica(
        'chartEstadoProduccion',
        'pie',
        [
            {
                etiqueta: 'Activa',
                valor: produccionesActivas.length
            },
            {
                etiqueta: 'Cancelada',
                valor: produccionesCanceladas.length
            }
        ],
        'Producciones',
        ['#17a2b8', '#6c757d']
    );

    // Producción no cancelada.
    const idsProduccionesActivas = new Set(
        produccionesActivas.map(
            produccion => clave(produccion.ID_PRODUCCION)
        )
    );

    const cantidadesProducidas = new Map();

    for (const detalle of detalles) {
        if (
            activo(detalle) &&
            idsProduccionesActivas.has(
                clave(detalle.ID_PRODUCCION)
            )
        ) {
            sumar(
                cantidadesProducidas,
                clave(detalle.ID_PRODUCTO),
                numero(detalle.CANTIDAD_PRODUCIDA)
            );
        }
    }

    crearGrafica(
        'chartTopProducidos',
        'bar',
        ordenarTop(
            cantidadesProducidas,
            nombresProductos
        ),
        'Unidades producidas',
        '#F4A950',
        true
    );

    const finales = productosActivos.filter(
        producto => producto.TIPO === 'FINAL'
    );

    crearGrafica(
        'chartStockFinales',
        'pie',
        finales.map(producto => ({
            etiqueta: producto.NOMBRE,
            valor: numero(producto.STOCK)
        })),
        'Stock',
        colores
    );

    const stockBajo = productosActivos.filter(
        producto =>
            numero(producto.STOCK) <= numero(producto.STOCK_MINIMO)
    );

    mostrarTablaStock(
        'tablaStockBajoFinales',
        stockBajo.filter(
            producto => producto.TIPO === 'FINAL'
        ),
        'No hay panes con stock bajo.'
    );

    mostrarTablaStock(
        'tablaStockBajoInsumos',
        stockBajo.filter(
            producto => producto.TIPO === 'INSUMO'
        ),
        'No hay insumos con stock bajo.'
    );

    prepararInsumos(
        recetas,
        cantidadesProducidas,
        productosPorId
    );
}

// ============================================
// CARGAR Y ACTUALIZAR DASHBOARD
// ============================================

async function cargarDashboard() {
    if (!autorizado || cargando) return;

    cargando = true;

    const boton = document.getElementById('btnActualizar');
    const estado = document.getElementById('estadoCarga');

    boton.disabled = true;
    estado.textContent = 'Consultando Firebase...';

    try {
        const nombres = [
            'sucursales',
            'productos',
            'pedidos',
            'producciones',
            'detalles_produccion',
            'recetas',
            'incidentes'
        ];

        const resultados = await Promise.all(
            nombres.map(leerColeccion)
        );

        mostrarDashboard({
            sucursales: resultados[0],
            productos: resultados[1],
            pedidos: resultados[2],
            producciones: resultados[3],
            detalles: resultados[4],
            recetas: resultados[5],
            incidentes: resultados[6]
        });

        estado.textContent =
            'Datos de Firebase actualizados: ' +
            new Date().toLocaleString('es-GT', {
                timeZone: 'America/Guatemala'
            });

    } catch (error) {
        console.error('Error leyendo Firestore:', error);

        estado.textContent =
            'No se pudo actualizar. Los datos visibles pueden ser anteriores.';

        await mostrarError(
            error.code === 'permission-denied'
                ? 'No tienes permiso para consultar los datos. ' +
                  'Revisa las reglas y el perfil ADMIN.'
                : 'No se pudo cargar el dashboard desde Firebase: ' +
                  error.message
        );

    } finally {
        cargando = false;
        boton.disabled = false;
    }
}

// ============================================
// CONSTRUIR REPORTE PARA CORREO
// ============================================

function construirReporte(datos) {
    const ahora = fechaLocal(new Date());

    const contar = (filas, estado) => filas.filter(
        registro => numero(registro.ESTADO) === estado
    ).length;

    const productos = datos.productos.filter(activo);

    const bajos = productos.filter(
        producto =>
            numero(producto.STOCK) <=
            numero(producto.STOCK_MINIMO)
    );

    const lineas = [
        `REPORTE GENERAL AL ${ahora.dia} ${ahora.hora} (Guatemala)`,
        'Resumen acumulado de los registros disponibles.',
        '',
        `Sucursales activas: ${datos.sucursales.filter(activo).length}`,
        `Productos activos: ${productos.length}`,
        '',
        'PEDIDOS',
        `Activos / pendientes: ${contar(datos.pedidos, 1)}`,
        `En ruta: ${contar(datos.pedidos, 3)}`,
        `Entregados: ${contar(datos.pedidos, 2)}`,
        `Anulados: ${contar(datos.pedidos, 0)}`,
        '',
        'PRODUCCIÓN',
        `Producciones activas: ${contar(datos.producciones, 1)}`,
        `Producciones anuladas: ${contar(datos.producciones, 0)}`,
        '',
        'INCIDENTES',
        `Total: ${datos.incidentes.length}`,
        `Pendientes: ${
            datos.incidentes.filter(
                incidente => incidente.ESTADO === 'PENDIENTE'
            ).length
        }`,
        `Resueltos: ${
            datos.incidentes.filter(
                incidente => incidente.ESTADO === 'RESUELTO'
            ).length
        }`,
        '',
        'EXISTENCIAS ACTUALES (productos activos)'
    ];

    for (const tipo of ['FINAL', 'INSUMO']) {
        lineas.push(
            '',
            tipo === 'FINAL' ? 'Panes:' : 'Insumos:'
        );

        const filas = productos
            .filter(producto => producto.TIPO === tipo)
            .sort((a, b) =>
                String(a.NOMBRE).localeCompare(String(b.NOMBRE))
            );

        if (!filas.length) {
            lineas.push('Sin registros.');
        }

        filas.forEach(producto => {
            lineas.push(
                `${producto.CODIGO || '-'} | ` +
                `${producto.NOMBRE || '-'} | ` +
                `Stock: ${numero(producto.STOCK)} ` +
                `${producto.UNIDAD_MEDIDA || ''} | ` +
                `Mínimo: ${numero(producto.STOCK_MINIMO)}`
            );
        });
    }

    lineas.push(
        '',
        `ALERTAS DE STOCK BAJO: ${bajos.length}`
    );

    bajos.forEach(producto => {
        lineas.push(
            `${producto.NOMBRE}: ` +
            `${numero(producto.STOCK)} ` +
            `${producto.UNIDAD_MEDIDA || ''} ` +
            `(mínimo ${numero(producto.STOCK_MINIMO)})`
        );
    });

    if (!bajos.length) {
        lineas.push('Sin alertas.');
    }

    const actividades = datos.auditoria
        .map(registro => ({
            registro,
            fecha: fechaLocal(registro.FECHA)
        }))
        .filter(item => item.fecha?.dia === ahora.dia)
        .sort((a, b) =>
            a.fecha.hora.localeCompare(b.fecha.hora)
        );

    lineas.push(
        '',
        `ACTIVIDADES DE HOY (${ahora.dia}, Guatemala): ${actividades.length}`
    );

    actividades.forEach(({ registro, fecha }) => {
        lineas.push(
            `${fecha.hora} | ` +
            `${registro.ACCION || '-'} | ` +
            `${registro.DESCRIPCION || '-'} | ` +
            `Usuario: ${registro.USUARIO || '-'}`
        );
    });

    if (!actividades.length) {
        lineas.push('Sin actividades registradas hoy.');
    }

    return {
        asunto: `Reporte Panadería San Carlos - ${ahora.dia}`,
        mensaje: lineas.join('\n')
    };
}

// ============================================
// ENVIAR REPORTE CON EMAILJS
// ============================================

async function enviarCorreo() {
    if (!autorizado) return;

    const boton = document.getElementById('btnEnviarCorreo');

    if (boton.disabled) return;

    boton.disabled = true;

    Swal.fire({
        title: 'Preparando reporte...',
        text: 'Consultando los datos actuales en Firebase.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // Consultar nuevamente para enviar datos actuales.
        const nombres = [
            'sucursales',
            'productos',
            'pedidos',
            'producciones',
            'incidentes',
            'auditoria'
        ];

        const resultados = await Promise.all(
            nombres.map(leerColeccion)
        );

        const datos = Object.fromEntries(
            nombres.map((nombre, indice) => [
                nombre,
                resultados[indice]
            ])
        );

        const reporte = construirReporte(datos);

        Swal.update({
            title: 'Enviando reporte...',
            text: 'Enviando mediante EmailJS.'
        });

        await enviarPorEmailJS(
            reporte.asunto,
            reporte.mensaje
        );

        await Swal.fire({
            icon: 'success',
            title: 'Reporte enviado',
            text:
                'EmailJS aceptó el reporte. Revisa Recibidos o Spam ' +
                'en pansancarlosumg@gmail.com.',
            confirmButtonColor: '#7B2D26'
        });

    } catch (error) {
        console.error('Error al enviar reporte:', error);

        await mostrarError(
            error.code === 'permission-denied'
                ? 'Firestore no permitió leer el reporte. ' +
                  'Revisa las reglas del perfil ADMIN, incluida auditoria.'
                : 'No se pudo completar el envío: ' + error.message
        );

    } finally {
        boton.disabled = false;
    }
}

// ============================================
// INICIO
// ============================================

async function iniciar() {
    const sesionValida = await verificarSesion(['ADMIN']);

    if (!sesionValida) return;

    autorizado = true;

    renderMenu('dashboard');

    document.getElementById('contenidoDashboard').hidden = false;

    document.getElementById('btnActualizar')
        .addEventListener('click', cargarDashboard);

    document.getElementById('btnEnviarCorreo')
        .addEventListener('click', enviarCorreo);

    document.getElementById('unidadInsumos')
        .addEventListener('change', dibujarInsumos);

    await cargarDashboard();
}

iniciar().catch(error => {
    console.error('Error al iniciar dashboard:', error);

    mostrarError(
        'No se pudo iniciar el dashboard: ' + error.message
    );
});