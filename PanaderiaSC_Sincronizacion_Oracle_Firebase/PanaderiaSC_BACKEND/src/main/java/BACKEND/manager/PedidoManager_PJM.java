package BACKEND.manager;

import BACKEND.model.DetallePedido_PJM;
import BACKEND.model.Pedido_PJM;
import BACKEND.utils.Config;
import BACKEND.utils.ConnectionsPool;
import BACKEND.utils.jsonResult;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PedidoManager_PJM {

    String SCHEMA = new Config().getDBSchema();

    // 1. GET PEDIDOS
    public List<Map<String, Object>> getPedidos_PJM(String idSucursal, String idPedido) throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.GET_PEDIDOS_PJM(?, ?, ?) }");
            if (idSucursal != null && !idSucursal.isEmpty()) cs.setInt(1, Integer.parseInt(idSucursal));
            else cs.setNull(1, Types.NUMERIC);

            if (idPedido != null && !idPedido.isEmpty()) cs.setInt(2, Integer.parseInt(idPedido));
            else cs.setNull(2, Types.NUMERIC);

            cs.registerOutParameter(3, Types.REF_CURSOR);
            cs.execute();
            rs = (ResultSet) cs.getObject(3);

            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("ID_PEDIDO", rs.getString("ID_PEDIDO"));
                map.put("SUCURSAL",  rs.getString("SUCURSAL"));
                map.put("FECHA",     rs.getString("FECHA"));
                map.put("TURNO",     rs.getString("TURNO"));
                map.put("RUTA",      rs.getString("RUTA"));
                map.put("ESTADO",    rs.getString("ESTADO"));
                map.put("ENTREGADO_POR", rs.getString("ENTREGADO_POR"));
                map.put("DETALLES",  getDetallePedido_PJM(rs.getString("ID_PEDIDO")));
                map.put("TOTAL",     getTotalPedido_PJM(rs.getString("ID_PEDIDO")));
                salida.add(map);
            }
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return salida;
    }

    // 2. GET DETALLE PEDIDO
    public List<Map<String, Object>> getDetallePedido_PJM(String idPedido) throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.GET_DETALLE_PEDIDO_PJM(?, ?) }");
            cs.setInt(1, Integer.parseInt(idPedido));
            cs.registerOutParameter(2, Types.REF_CURSOR);
            cs.execute();
            rs = (ResultSet) cs.getObject(2);

            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("ID_DETALLE_PEDIDO", rs.getString("ID_DETALLE_PEDIDO"));
                map.put("ID_PEDIDO",         rs.getString("ID_PEDIDO"));
                map.put("ID_PRODUCTO",       rs.getString("ID_PRODUCTO"));
                map.put("PRODUCTO",          rs.getString("PRODUCTO"));
                map.put("CODIGO",            rs.getString("CODIGO"));
                map.put("PRECIO",            rs.getString("PRECIO"));
                map.put("CANTIDAD",          rs.getString("CANTIDAD"));
                map.put("SUBTOTAL",          rs.getString("SUBTOTAL"));
                map.put("ESTADO",            rs.getString("ESTADO"));
                salida.add(map);
            }
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return salida;
    }

    // 3. GET TOTAL PEDIDO
    public String getTotalPedido_PJM(String idPedido) throws Exception {
        String total = "0";
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.GET_TOTAL_PEDIDO_PJM(?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idPedido));
            cs.registerOutParameter(2, Types.NUMERIC);
            cs.registerOutParameter(3, Types.VARCHAR);
            cs.execute();
            total = String.valueOf(cs.getDouble(2));
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return total;
    }

    // 4. POST PEDIDO
    public jsonResult insertPedido_PJM(Pedido_PJM item) throws Exception {
        jsonResult res = new jsonResult(-1, "Error", "No se pudo insertar");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.INS_PEDIDO_PJM(?, ?, ?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(item.ID_SUCURSAL));
            cs.setString(2, item.TURNO);
            cs.setString(3, item.RUTA);
            cs.registerOutParameter(4, Types.NUMERIC);
            cs.registerOutParameter(5, Types.VARCHAR);
            cs.execute();

            int id = cs.getInt(4); String msj = cs.getString(5);
            res = id > 0 ? new jsonResult(id, "OK", msj) : new jsonResult(-1, "Error", msj);
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return res;
    }

    // 5. POST DETALLE PEDIDO
    public jsonResult insertDetallePedido_PJM(DetallePedido_PJM item) throws Exception {
        jsonResult res = new jsonResult(-1, "Error", "No se pudo insertar el detalle");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.INS_DETALLE_PEDIDO_PJM(?, ?, ?, ?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(item.ID_PEDIDO));
            cs.setInt(2, Integer.parseInt(item.ID_PRODUCTO));
            cs.setInt(3, Integer.parseInt(item.CANTIDAD));
            cs.setDouble(4, Double.parseDouble(item.SUBTOTAL));
            cs.registerOutParameter(5, Types.NUMERIC);
            cs.registerOutParameter(6, Types.VARCHAR);
            cs.execute();

            int id = cs.getInt(5); String msj = cs.getString(6);
            res = id > 0 ? new jsonResult(id, "OK", msj) : new jsonResult(-1, "Error", msj);
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return res;
    }

    // 6. PUT TOMAR PEDIDO (VENDEDOR)
    public jsonResult tomarPedido_PJM(String idPedido, String vendedor) throws Exception {
        jsonResult res = new jsonResult(-1, "Error", "No se pudo tomar el pedido");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.TOMAR_PEDIDO_PJM(?, ?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idPedido));
            cs.setString(2, vendedor);
            cs.registerOutParameter(3, Types.NUMERIC);
            cs.registerOutParameter(4, Types.VARCHAR);
            cs.execute();

            int id = cs.getInt(3); String msj = cs.getString(4);
            res = id == 1 ? new jsonResult(1, "OK", msj) : new jsonResult(-1, "Error", msj);
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return res;
    }

    // 7. PUT ENTREGAR PEDIDO (VENDEDOR)
    public jsonResult entregarPedido_PJM(String idPedido, String vendedor) throws Exception {
        jsonResult res = new jsonResult(-1, "Error", "No se pudo entregar el pedido");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.ENTREGAR_PEDIDO_PJM(?, ?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idPedido));
            cs.setString(2, vendedor);
            cs.registerOutParameter(3, Types.NUMERIC);
            cs.registerOutParameter(4, Types.VARCHAR);
            cs.execute();

            int id = cs.getInt(3); String msj = cs.getString(4);
            res = id == 1 ? new jsonResult(1, "OK", msj) : new jsonResult(-1, "Error", msj);
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return res;
    }

    // 8. DELETE ANULAR PEDIDO
    public jsonResult anularPedido_PJM(String idPedido) throws Exception {
        jsonResult res = new jsonResult(-1, "Error", "No se pudo anular");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.ANULAR_PEDIDO_PJM(?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idPedido));
            cs.registerOutParameter(2, Types.NUMERIC);
            cs.registerOutParameter(3, Types.VARCHAR);
            cs.execute();

            int id = cs.getInt(2); String msj = cs.getString(3);
            res = id == 1 ? new jsonResult(1, "OK", msj) : new jsonResult(-1, "Error", msj);
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return res;
    }

    // 9. DELETE ANULAR DETALLE PEDIDO
    public jsonResult anularDetallePedido_PJM(String idDetalle) throws Exception {
        jsonResult res = new jsonResult(-1, "Error", "No se pudo anular el detalle");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM.ANULAR_DETALLE_PEDIDO_PJM(?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idDetalle));
            cs.registerOutParameter(2, Types.NUMERIC);
            cs.registerOutParameter(3, Types.VARCHAR);
            cs.execute();

            int id = cs.getInt(2); String msj = cs.getString(3);
            res = id == 1 ? new jsonResult(1, "OK", msj) : new jsonResult(-1, "Error", msj);
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return res;
    }

    // 10. CONTADORES
    public String getPedidosActivos_PJM() throws Exception { return ejecutarContador("GET_PEDIDOS_ACTIVOS_PJM"); }
    public String getPedidosAnulados_PJM() throws Exception { return ejecutarContador("GET_PEDIDOS_ANULADOS_PJM"); }
    public String getPedidosEntregadosCount_PJM() throws Exception { return ejecutarContador("GET_PEDIDOS_ENTREGADOS_COUNT_PJM"); }

    private String ejecutarContador(String sp) throws Exception {
        String total = "0";
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PEDIDOS_PJM." + sp + "(?, ?) }");
            cs.registerOutParameter(1, Types.NUMERIC);
            cs.registerOutParameter(2, Types.VARCHAR);
            cs.execute();
            total = String.valueOf(cs.getInt(1));
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }
        return total;
    }
}