package BACKEND.manager;

import BACKEND.utils.Config;
import BACKEND.utils.ConnectionsPool;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ReporteManager_PJM {

    String SCHEMA = new Config().getDBSchema();

    public List<Map<String, Object>> getPedidosPorSucursal_PJM(String idSucursal, String fecha) throws Exception {
        return ejecutarReporteFecha("{ call " + SCHEMA + ".PKG_REPORTES_PJM.GET_PEDIDOS_POR_SUCURSAL_PJM(?, ?, ?) }", idSucursal, fecha);
    }

    public List<Map<String, Object>> getPedidosCancelados_PJM(String idSucursal, String fecha) throws Exception {
        return ejecutarReporteFecha("{ call " + SCHEMA + ".PKG_REPORTES_PJM.GET_PEDIDOS_CANCELADOS_PJM(?, ?, ?) }", idSucursal, fecha);
    }

    public List<Map<String, Object>> getPedidosEntregados_PJM(String idSucursal, String fecha) throws Exception {
        return ejecutarReporteFecha("{ call " + SCHEMA + ".PKG_REPORTES_PJM.GET_PEDIDOS_ENTREGADOS_PJM(?, ?, ?) }", idSucursal, fecha);
    }

    public List<Map<String, Object>> getProduccionReporte_PJM(String idProduccion, String fecha) throws Exception {
        return ejecutarReporteFecha("{ call " + SCHEMA + ".PKG_REPORTES_PJM.GET_PRODUCCION_REPORTE_PJM(?, ?, ?) }", idProduccion, fecha);
    }

    public List<Map<String, Object>> getProduccionCancelada_PJM(String idProduccion, String fecha) throws Exception {
        return ejecutarReporteFecha("{ call " + SCHEMA + ".PKG_REPORTES_PJM.GET_PRODUCCION_CANCELADA_PJM(?, ?, ?) }", idProduccion, fecha);
    }

    public List<Map<String, Object>> getStockBajo_PJM() throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_REPORTES_PJM.GET_STOCK_BAJO_PJM(?) }");
            cs.registerOutParameter(1, Types.REF_CURSOR);
            cs.execute();
            rs = (ResultSet) cs.getObject(1);
            salida = mapearResultSet(rs); 
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return salida;
    }

    // ============================================================
    // DATOS PARA LAS GRÁFICAS (100% Compatible con Oracle 11g/12c/19c)
    // ============================================================
    public Map<String, Object> getDatosGraficas_PJM() throws Exception {
        Map<String, Object> resultado = new HashMap<>();
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();

        try {
            // 1. Pedidos por Sucursal
            String sql1 = "SELECT s.NOMBRE AS ETIQUETA, COUNT(p.ID_PEDIDO) AS VALOR FROM SUCURSAL_PJM s LEFT JOIN PEDIDO_PJM p ON s.ID_SUCURSAL = p.ID_SUCURSAL GROUP BY s.NOMBRE ORDER BY 2 DESC";
            resultado.put("pedidosPorSucursal", ejecutarQueryGrafica(conn, sql1));

            // 2. Pedidos Entregados vs Cancelados
            String sql2 = "SELECT CASE ESTADO WHEN 2 THEN 'Entregados' WHEN 0 THEN 'Cancelados' ELSE 'Activos' END AS ETIQUETA, COUNT(*) AS VALOR FROM PEDIDO_PJM GROUP BY ESTADO";
            resultado.put("estadoPedidos", ejecutarQueryGrafica(conn, sql2));

            // 3. Top Productos Finales más producidos (ROWNUM para compatibilidad)
            String sql3 = "SELECT * FROM (SELECT p.NOMBRE AS ETIQUETA, NVL(SUM(dp.CANTIDAD_PRODUCIDA), 0) AS VALOR FROM PRODUCTO_PJM p JOIN DETALLE_PRODUCCION_PJM dp ON p.ID_PRODUCTO = dp.ID_PRODUCTO WHERE p.TIPO = 'FINAL' AND dp.ESTADO = 1 GROUP BY p.NOMBRE ORDER BY 2 DESC) WHERE ROWNUM <= 5";
            resultado.put("topProducidos", ejecutarQueryGrafica(conn, sql3));

            // 4. Producción Activa vs Cancelada
            String sql4 = "SELECT CASE ESTADO WHEN 1 THEN 'Activa' WHEN 0 THEN 'Cancelada' END AS ETIQUETA, COUNT(*) AS VALOR FROM PRODUCCION_PJM GROUP BY ESTADO";
            resultado.put("estadoProduccion", ejecutarQueryGrafica(conn, sql4));

            // 5. Top Insumos más utilizados
            String sql5 = "SELECT * FROM (SELECT i.NOMBRE AS ETIQUETA, NVL(SUM(r.CANTIDAD * dp.CANTIDAD_PRODUCIDA), 0) AS VALOR FROM RECETA_PJM r JOIN PRODUCTO_PJM i ON i.ID_PRODUCTO = r.ID_INSUMO JOIN DETALLE_PRODUCCION_PJM dp ON dp.ID_PRODUCTO = r.ID_PRODUCTO WHERE dp.ESTADO = 1 GROUP BY i.NOMBRE ORDER BY 2 DESC) WHERE ROWNUM <= 5";
            resultado.put("topInsumosUsados", ejecutarQueryGrafica(conn, sql5));

            // 6. Stock de Productos Finales
            String sql6 = "SELECT NOMBRE AS ETIQUETA, STOCK AS VALOR FROM PRODUCTO_PJM WHERE TIPO = 'FINAL' AND ESTADO = 1";
            resultado.put("stockFinales", ejecutarQueryGrafica(conn, sql6));

        } finally {
            if (conn != null) conn.close();
        }
        return resultado;
    }

    private List<Map<String, Object>> ejecutarQueryGrafica(Connection conn, String sql) throws Exception {
        List<Map<String, Object>> lista = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("etiqueta", rs.getString("ETIQUETA"));
                map.put("valor", rs.getDouble("VALOR"));
                lista.add(map);
            }
        }
        return lista;
    }

    private List<Map<String, Object>> ejecutarReporteFecha(String sqlCall, String idFiltro, String fecha) throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall(sqlCall);
            if (idFiltro != null && !idFiltro.isEmpty()) cs.setInt(1, Integer.parseInt(idFiltro));
            else cs.setNull(1, Types.NUMERIC);

            if (fecha != null && !fecha.isEmpty()) {
                java.util.Date d = new SimpleDateFormat("dd/MM/yyyy").parse(fecha);
                cs.setDate(2, new java.sql.Date(d.getTime()));
            } else cs.setNull(2, Types.DATE);

            cs.registerOutParameter(3, Types.REF_CURSOR);
            cs.execute();
            rs = (ResultSet) cs.getObject(3);
            salida = mapearResultSet(rs);
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return salida;
    }

    private List<Map<String, Object>> mapearResultSet(ResultSet rs) throws Exception {
        List<Map<String, Object>> lista = new ArrayList<>();
        ResultSetMetaData metaData = rs.getMetaData();
        int columnCount = metaData.getColumnCount();
        while (rs.next()) {
            Map<String, Object> row = new HashMap<>();
            for (int i = 1; i <= columnCount; i++) {
                String columnName = metaData.getColumnLabel(i).toUpperCase();
                Object value = rs.getObject(i);
                row.put(columnName, value);
            }
            lista.add(row);
        }
        return lista;
    }
}