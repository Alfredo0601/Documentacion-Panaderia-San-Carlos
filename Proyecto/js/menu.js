function renderMenu(activo) {
    const usuario = getUsuario();
    const rol = sessionStorage.getItem('rol') || 'ADMIN';
    let opciones = '';

    if (rol === 'ADMIN') {
        opciones = `
            <li class="nav-item"><a class="nav-link ${activo==='dashboard'?'active':''}" href="dashboard.html"><i class="bi bi-speedometer2"></i> Dashboard</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='sucursales'?'active':''}" href="sucursales.html"><i class="bi bi-shop-window"></i> Sucursales</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='productos'?'active':''}" href="productos.html"><i class="bi bi-box-seam"></i> Productos</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='recetas'?'active':''}" href="recetas.html"><i class="bi bi-journal-text"></i> Recetas</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='pedidos'?'active':''}" href="pedidos.html"><i class="bi bi-cart-check"></i> Pedidos</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='produccion'?'active':''}" href="produccion.html"><i class="bi bi-gear-wide-connected"></i> Producción</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='reportes'?'active':''}" href="reportes.html"><i class="bi bi-file-earmark-bar-graph"></i> Reportes</a></li>
        `;
    } else if (rol === 'SUCURSAL') {
        opciones = `
            <li class="nav-item"><a class="nav-link ${activo==='pedidos'?'active':''}" href="pedidos.html"><i class="bi bi-cart-check"></i> Pedidos</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='reportes'?'active':''}" href="reportes.html"><i class="bi bi-file-earmark-bar-graph"></i> Reportes</a></li>
        `;
    } else if (rol === 'VENDEDOR') {
        opciones = `
            <li class="nav-item"><a class="nav-link ${activo==='rutas'?'active':''}" href="rutas.html"><i class="bi bi-truck"></i> Mis Rutas</a></li>
            <li class="nav-item"><a class="nav-link ${activo==='incidentes'?'active':''}" href="incidentes.html"><i class="bi bi-exclamation-triangle"></i> Reportar Incidente</a></li>
        `;
    }

    const menu = `
    <div class="sidebar">
        <div class="brand">
            <img src="img/logo-umg.png" alt="UMG" height="50" class="mb-2 logo-umg">
            <h5 class="brand-titulo"><i class="bi bi-shop"></i> Panadería San Carlos</h5>
            <small class="brand-subtitulo">UMG</small>
        </div>
        <ul class="nav flex-column">
            ${opciones}
            <li class="nav-item mt-4"><a class="nav-link text-warning" href="#" onclick="cerrarSesion()"><i class="bi bi-box-arrow-right"></i> Cerrar Sesión</a></li>
        </ul>
        <div class="text-center mt-4 mb-3">
            <small class="text-light"><i class="bi bi-person-circle"></i> ${usuario} (${rol})</small>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', menu);
}