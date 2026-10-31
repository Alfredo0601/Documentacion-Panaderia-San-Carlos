package BACKEND.manager;

import BACKEND.model.DetalleProduccion_PJM;
import BACKEND.model.Produccion_PJM;
import BACKEND.notificador.NotificadorCorreo_PJM;
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

public class ProduccionManager_PJM {

    String SCHEMA = new Config().getDBSchema();

    public List<Map<String, Object>> getProduccion_PJM(String idProduccion) throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.GET_PRODUCCION_PJM(?, ?) }");
            if (idProduccion != null && !idProduccion.isEmpty()) cs.setInt(1, Integer.parseInt(idProduccion));
            else cs.setNull(1, Types.NUMERIC);
            cs.registerOutParameter(2, Types.REF_CURSOR);
            cs.execute();
            rs = (ResultSet) cs.getObject(2);
            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("ID_PRODUCCION", rs.getString("ID_PRODUCCION"));
                map.put("FECHA",         rs.getString("FECHA"));
                map.put("TURNO",         rs.getString("TURNO"));
                map.put("OBSERVACION",   rs.getString("OBSERVACION"));
                map.put("ESTADO",        rs.getString("ESTADO"));
                map.put("DETALLES",      getDetalleProduccion_PJM(rs.getString("ID_PRODUCCION")));
                salida.add(map);
            }
        } finally {
            if (rs != null) rs.close(); if (cs != null) cs.close(); if (conn != null) conn.close();
        }
        return salida;
    }

    public List<Map<String, Object>> getDetalleProduccion_PJM(String idProduccion) throws Exception {
        List<Map<String, Object>> salida = new ArrayList<>();
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        ResultSet rs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.GET_DETALLE_PRODUCCION_PJM(?, ?) }");
            cs.setInt(1, Integer.parseInt(idProduccion));
            cs.registerOutParameter(2, Types.REF_CURSOR);
            cs.execute();
            rs = (ResultSet) cs.getObject(2);
            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("ID_DETALLE_PRODUCCION", rs.getString("ID_DETALLE_PRODUCCION"));
                map.put("ID_PRODUCCION",         rs.getString("ID_PRODUCCION"));
                map.put("ID_PRODUCTO",           rs.getString("ID_PRODUCTO"));
                map.put("PRODUCTO",              rs.getString("PRODUCTO"));
                map.put("CODIGO",                rs.getString("CODIGO"));
                map.put("CANTIDAD_PRODUCIDA",    rs.getString("CANTIDAD_PRODUCIDA"));
                map.put("ESTADO",                rs.getString("ESTADO"));
                salida.add(map);
            }
        } finally {
            if (rs != null) rs.close(); if (cs != null) cs.close(); if (conn != null) conn.close();
        }
        return salida;
    }

    public jsonResult insertProduccion_PJM(Produccion_PJM item) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo insertar la producción");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.INS_PRODUCCION_PJM(?, ?, ?, ?) }");
            cs.setString(1, item.TURNO); cs.setString(2, item.OBSERVACION);
            cs.registerOutParameter(3, Types.NUMERIC); cs.registerOutParameter(4, Types.VARCHAR);
            cs.execute();
            int idSalida = cs.getInt(3); String mensaje = cs.getString(4);
            if (idSalida > 0) resultado = new jsonResult(idSalida, "OK", mensaje);
            else resultado = new jsonResult(-1, "Error", mensaje);
        } finally {
            if (cs != null) cs.close(); if (conn != null) conn.close();
        }
        return resultado;
    }

    public jsonResult insertDetalleProduccion_PJM(DetalleProduccion_PJM item) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo insertar el detalle");
        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();
        CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.INS_DETALLE_PRODUCCION_PJM(?, ?, ?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(item.ID_PRODUCCION)); cs.setInt(2, Integer.parseInt(item.ID_PRODUCTO)); cs.setInt(3, Integer.parseInt(item.CANTIDAD_PRODUCIDA));
            cs.registerOutParameter(4, Types.NUMERIC); cs.registerOutParameter(5, Types.VARCHAR);
            cs.execute();
            int idSalida = cs.getInt(4); String mensaje = cs.getString(5);
            if (idSalida > 0) resultado = new jsonResult(idSalida, "OK", mensaje);
            else resultado = new jsonResult(-1, "Error", mensaje);
        } finally {
            if (cs != null) cs.close(); if (conn != null) conn.close();
        }
        return resultado;
    }

    public jsonResult anularDetalleProduccion_PJM(String idDetalle) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo anular el detalle");
        ConnectionsPool c = new ConnectionsPool(); Connection conn = c.conectar(); CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.ANULAR_DETALLE_PRODUCCION_PJM(?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idDetalle)); cs.registerOutParameter(2, Types.NUMERIC); cs.registerOutParameter(3, Types.VARCHAR); cs.execute();
            int idSalida = cs.getInt(2); String mensaje = cs.getString(3);
            if (idSalida == 1) resultado = new jsonResult(1, "OK", mensaje); else resultado = new jsonResult(-1, "Error", mensaje);
        } finally { if (cs != null) cs.close(); if (conn != null) conn.close(); }
        return resultado;
    }

    public jsonResult anularProduccion_PJM(String idProduccion) throws Exception {
        jsonResult resultado = new jsonResult(-1, "Error", "No se pudo anular la producción");
        ConnectionsPool c = new ConnectionsPool(); Connection conn = c.conectar(); CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.ANULAR_PRODUCCION_PJM(?, ?, ?) }");
            cs.setInt(1, Integer.parseInt(idProduccion)); cs.registerOutParameter(2, Types.NUMERIC); cs.registerOutParameter(3, Types.VARCHAR); cs.execute();
            int idSalida = cs.getInt(2); String mensaje = cs.getString(3);
            if (idSalida == 1) resultado = new jsonResult(1, "OK", mensaje); else resultado = new jsonResult(-1, "Error", mensaje);
        } finally { if (cs != null) cs.close(); if (conn != null) conn.close(); }
        return resultado;
    }

    public String getProduccionActiva_PJM() throws Exception {
        String total = "0"; ConnectionsPool c = new ConnectionsPool(); Connection conn = c.conectar(); CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.GET_PRODUCCION_ACTIVA_PJM(?, ?) }");
            cs.registerOutParameter(1, Types.NUMERIC); cs.registerOutParameter(2, Types.VARCHAR); cs.execute();
            total = String.valueOf(cs.getInt(1));
        } finally { if (cs != null) cs.close(); if (conn != null) conn.close(); }
        return total;
    }

    public String getProduccionAnulada_PJM() throws Exception {
        String total = "0"; ConnectionsPool c = new ConnectionsPool(); Connection conn = c.conectar(); CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.GET_PRODUCCION_ANULADA_PJM(?, ?) }");
            cs.registerOutParameter(1, Types.NUMERIC); cs.registerOutParameter(2, Types.VARCHAR); cs.execute();
            total = String.valueOf(cs.getInt(1));
        } finally { if (cs != null) cs.close(); if (conn != null) conn.close(); }
        return total;
    }

    public jsonResult autoReabastecer_PJM() throws Exception {
        jsonResult res = new jsonResult(-1, "Error", "No se pudo auto-reabastecer");
        ConnectionsPool c = new ConnectionsPool(); Connection conn = c.conectar(); CallableStatement cs = null;
        try {
            cs = conn.prepareCall("{ call " + SCHEMA + ".PKG_PRODUCCION_PJM.AUTO_REABASTECER_PJM(?, ?) }");
            cs.registerOutParameter(1, Types.NUMERIC); cs.registerOutParameter(2, Types.VARCHAR); cs.execute();
            int generados = cs.getInt(1); String mensaje = cs.getString(2);
            if (generados > 0) {
                res = new jsonResult(generados, "OK", mensaje);
                NotificadorCorreo_PJM notificador = new NotificadorCorreo_PJM();
                notificador.enviarAlertaAutoProduccion(mensaje);
            } else if (generados == 0) {
                res = new jsonResult(0, "Info", mensaje);
            } else {
                res = new jsonResult(-1, "Error", mensaje);
            }
        } finally { if (cs != null) cs.close(); if (conn != null) conn.close(); }
        return res;
    }
}