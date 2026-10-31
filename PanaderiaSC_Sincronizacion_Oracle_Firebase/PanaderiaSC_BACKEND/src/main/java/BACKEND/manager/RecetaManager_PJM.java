package BACKEND.manager;

import BACKEND.model.Receta_PJM;
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

public class RecetaManager_PJM {

    String SCHEMA = new Config().getDBSchema();

    // ============================================================
    // GET receta de un producto
    // ============================================================
    public List<Map<String, Object>> getReceta_PJM(String idProducto) throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCTOS_PJM.GET_RECETA_PJM(?, ?) }");
            cs.setInt(1, Integer.parseInt(idProducto));
            cs.registerOutParameter(2, Types.REF_CURSOR);
            cs.execute();

            rs = (ResultSet) cs.getObject(2);

            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("ID_RECETA",     rs.getString("ID_RECETA"));
                map.put("ID_PRODUCTO",   rs.getString("ID_PRODUCTO"));
                map.put("PRODUCTO",      rs.getString("PRODUCTO"));
                map.put("ID_INSUMO",     rs.getString("ID_INSUMO"));
                map.put("INSUMO",        rs.getString("INSUMO"));
                map.put("UNIDAD_MEDIDA", rs.getString("UNIDAD_MEDIDA"));
                map.put("CANTIDAD",      rs.getString("CANTIDAD"));
                map.put("ESTADO",        rs.getString("ESTADO"));
                salida.add(map);
            }
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }

        return salida;
    }

    // ============================================================
    // POST ingrediente a la receta (suma si ya existe)
    // ============================================================
    public jsonResult insertReceta_PJM(Receta_PJM item) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo insertar el ingrediente");

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCTOS_PJM.INS_RECETA_PJM(?, ?, ?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(item.ID_PRODUCTO));
            cs.setInt(2, Integer.parseInt(item.ID_INSUMO));
            cs.setDouble(3, Double.parseDouble(item.CANTIDAD));
            cs.registerOutParameter(4, Types.NUMERIC);
            cs.registerOutParameter(5, Types.VARCHAR);
            cs.execute();

            int idSalida = cs.getInt(4);
            String mensaje = cs.getString(5);

            if (idSalida > 0) {
                resultado = new jsonResult(idSalida, "OK", mensaje);
            } else {
                resultado = new jsonResult(-1, "Error", mensaje);
            }
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }

        return resultado;
    }

    // ============================================================
    // NUEVO: DELETE eliminar ingrediente de la receta (soft delete)
    // ============================================================
    public jsonResult eliminarReceta_PJM(String idReceta) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo eliminar el ingrediente");

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCTOS_PJM.DELETE_RECETA_PJM(?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idReceta));
            cs.registerOutParameter(2, Types.NUMERIC);
            cs.registerOutParameter(3, Types.VARCHAR);
            cs.execute();

            int idSalida = cs.getInt(2);
            String mensaje = cs.getString(3);

            if (idSalida == 1) {
                resultado = new jsonResult(1, "OK", mensaje);
            } else {
                resultado = new jsonResult(-1, "Error", mensaje);
            }
        } finally {
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }

        return resultado;
    }
}