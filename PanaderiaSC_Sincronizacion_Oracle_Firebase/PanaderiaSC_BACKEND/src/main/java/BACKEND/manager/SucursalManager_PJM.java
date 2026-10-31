package BACKEND.manager;

import BACKEND.model.Sucursal_PJM;
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

public class SucursalManager_PJM {

    String SCHEMA = new Config().getDBSchema();

    // GET todas las sucursales
    public List<Map<String, Object>> getSucursales_PJM() throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_SUCURSALES_PJM.GET_SUCURSALES_PJM(?) }");
            cs.registerOutParameter(1, Types.REF_CURSOR);
            cs.execute();

            rs = (ResultSet) cs.getObject(1);

            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("ID_SUCURSAL", rs.getString("ID_SUCURSAL"));
                map.put("NOMBRE",      rs.getString("NOMBRE"));
                map.put("DIRECCION",   rs.getString("DIRECCION"));
                map.put("TELEFONO",    rs.getString("TELEFONO"));
                map.put("RUTA",        rs.getString("RUTA"));
                map.put("ESTADO",      rs.getString("ESTADO"));
                salida.add(map);
            }
        } finally {
            if (rs != null) rs.close();
            if (cs != null) cs.close();
            if (conn != null) conn.close();
        }

        return salida;
    }

    // POST nueva sucursal
    public jsonResult insertSucursal_PJM(Sucursal_PJM item) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo insertar la sucursal");

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;

        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_SUCURSALES_PJM.INS_SUCURSAL_PJM\n" +
"(?, ?, ?, ?, ?, ?) }");
            cs.setString(1, item.NOMBRE);
            cs.setString(2, item.DIRECCION);
            cs.setString(3, item.TELEFONO);
            cs.setString(4, item.RUTA);
            cs.registerOutParameter(5, Types.NUMERIC);
            cs.registerOutParameter(6, Types.VARCHAR);
            cs.execute();

            int idSalida = cs.getInt(5);
            String mensaje = cs.getString(6);

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