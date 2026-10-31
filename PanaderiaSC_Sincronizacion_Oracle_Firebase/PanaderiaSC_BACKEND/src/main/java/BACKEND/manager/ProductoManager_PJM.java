package BACKEND.manager;

import BACKEND.model.Producto_PJM;
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

public class ProductoManager_PJM {

    String SCHEMA = new Config().getDBSchema();

    // GET productos (filtro por tipo opcional)
    public List<Map<String, Object>> getProductos_PJM(String tipo) throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCTOS_PJM.GET_PRODUCTOS_PJM(?, ?) }");
            if (tipo != null && !tipo.isEmpty()) {
                cs.setString(1, tipo);
            } else {
                cs.setNull(1, Types.VARCHAR);
            }
            cs.registerOutParameter(2, Types.REF_CURSOR);
            cs.execute();

            rs = (ResultSet) cs.getObject(2);

            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("ID_PRODUCTO",  rs.getString("ID_PRODUCTO"));
                map.put("NOMBRE",       rs.getString("NOMBRE"));
                map.put("CODIGO",       rs.getString("CODIGO"));
                map.put("TIPO",         rs.getString("TIPO"));
                map.put("PRECIO",       rs.getString("PRECIO"));
                map.put("STOCK",        rs.getString("STOCK"));
                map.put("STOCK_MINIMO", rs.getString("STOCK_MINIMO"));
                map.put("UNIDAD_MEDIDA",rs.getString("UNIDAD_MEDIDA"));
                map.put("ESTADO",       rs.getString("ESTADO"));
                salida.add(map);
            }
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }

        return salida;
    }

    // GET producto por ID
    public Map<String, Object> getProductoById_PJM(String idProducto) throws Exception {
        Map<String, Object> salida = new HashMap<>();

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCTOS_PJM.GET_PRODUCTO_PJM(?, ?) }");
            cs.setInt(1, Integer.parseInt(idProducto));
            cs.registerOutParameter(2, Types.REF_CURSOR);
            cs.execute();

            rs = (ResultSet) cs.getObject(2);

            if (rs.next()) {
                salida.put("ID_PRODUCTO",  rs.getString("ID_PRODUCTO"));
                salida.put("NOMBRE",       rs.getString("NOMBRE"));
                salida.put("CODIGO",       rs.getString("CODIGO"));
                salida.put("TIPO",         rs.getString("TIPO"));
                salida.put("PRECIO",       rs.getString("PRECIO"));
                salida.put("STOCK",        rs.getString("STOCK"));
                salida.put("STOCK_MINIMO", rs.getString("STOCK_MINIMO"));
                salida.put("UNIDAD_MEDIDA",rs.getString("UNIDAD_MEDIDA"));
                salida.put("ESTADO",       rs.getString("ESTADO"));
            }
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }

        return salida;
    }

    // POST producto
    public jsonResult insertProducto_PJM(Producto_PJM item) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo insertar el producto");

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCTOS_PJM.INS_PRODUCTO_PJM(?, ?, ?, ?, ?, ?, ?, ?, ?) }");
            cs.setString(1, item.NOMBRE);
            cs.setString(2, item.CODIGO);
            cs.setString(3, item.TIPO);
            cs.setDouble(4, Double.parseDouble(item.PRECIO));
            cs.setInt(5, Integer.parseInt(item.STOCK));
            cs.setInt(6, Integer.parseInt(item.STOCK_MINIMO));
            cs.setString(7, item.UNIDAD_MEDIDA);
            cs.registerOutParameter(8, Types.NUMERIC);
            cs.registerOutParameter(9, Types.VARCHAR);
            cs.execute();

            int idSalida = cs.getInt(8);
            String mensaje = cs.getString(9);

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
}