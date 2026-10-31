package BACKEND.manager;

import BACKEND.model.Incidente_PJM;
import BACKEND.notificador.NotificadorCorreo_PJM;
import BACKEND.utils.Config;
import BACKEND.utils.ConnectionsPool;
import BACKEND.utils.jsonResult;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Types;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

public class IncidenteManager_PJM {

    private static final Logger LOGGER =
            Logger.getLogger(IncidenteManager_PJM.class.getName());

    private final String SCHEMA = new Config().getDBSchema();

    public List<Map<String, Object>> getIncidentes_PJM(String fecha)
            throws Exception {

        List<Map<String, Object>> salida = new ArrayList<>();
        ConnectionsPool pool = new ConnectionsPool();

        String sql = "{ call " + SCHEMA
                + ".PKG_INCIDENTES_PJM.GET_INCIDENTES_PJM(?, ?) }";

        try (Connection conn = pool.conectar();
             CallableStatement cs = conn.prepareCall(sql)) {

            if (fecha != null && !fecha.trim().isEmpty()) {
                SimpleDateFormat formato =
                        new SimpleDateFormat("dd/MM/yyyy");

                formato.setLenient(false);

                java.util.Date fechaConvertida =
                        formato.parse(fecha.trim());

                cs.setDate(
                        1,
                        new java.sql.Date(fechaConvertida.getTime())
                );
            } else {
                cs.setNull(1, Types.DATE);
            }

            cs.registerOutParameter(2, Types.REF_CURSOR);
            cs.execute();

            try (ResultSet rs = (ResultSet) cs.getObject(2)) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();

                    map.put("ID_INCIDENTE", rs.getString("ID_INCIDENTE"));
                    map.put("RUTA", rs.getString("RUTA"));
                    map.put("SUCURSAL", rs.getString("SUCURSAL"));
                    map.put("VENDEDOR", rs.getString("VENDEDOR"));
                    map.put("MOTIVO", rs.getString("MOTIVO"));
                    map.put("DESCRIPCION", rs.getString("DESCRIPCION"));
                    map.put("FECHA", rs.getString("FECHA"));
                    map.put("ESTADO", rs.getString("ESTADO"));

                    salida.add(map);
                }
            }
        }

        return salida;
    }

    public jsonResult insertIncidente_PJM(Incidente_PJM item)
            throws Exception {

        if (item == null) {
            return new jsonResult(
                    -1,
                    "Error",
                    "No se recibieron los datos del incidente."
            );
        }

        int idPedido;

        try {
            idPedido = Integer.parseInt(
                    item.ID_PEDIDO == null
                            ? ""
                            : item.ID_PEDIDO.trim()
            );

            if (idPedido <= 0) {
                throw new NumberFormatException();
            }

        } catch (NumberFormatException ex) {
            return new jsonResult(
                    -1,
                    "Error",
                    "Seleccione un pedido válido para reportar el incidente."
            );
        }

        if (item.MOTIVO == null || item.MOTIVO.trim().isEmpty()) {
            return new jsonResult(
                    -1,
                    "Error",
                    "Seleccione el motivo del incidente."
            );
        }

        ConnectionsPool pool = new ConnectionsPool();

        String sql = "{ call " + SCHEMA
                + ".PKG_INCIDENTES_PJM.INS_INCIDENTE_PJM"
                + "(?, ?, ?, ?, ?, ?, ?, ?) }";

        int idSalida;
        String mensaje;

        // Oracle guarda el incidente y cancela el pedido
        // dentro del mismo procedimiento.
        try (Connection conn = pool.conectar();
             CallableStatement cs = conn.prepareCall(sql)) {

            cs.setInt(1, idPedido);
            cs.setString(2, item.RUTA);
            cs.setString(3, item.SUCURSAL);
            cs.setString(4, item.VENDEDOR);
            cs.setString(5, item.MOTIVO.trim());
            cs.setString(6, item.DESCRIPCION);

            cs.registerOutParameter(7, Types.NUMERIC);
            cs.registerOutParameter(8, Types.VARCHAR);

            cs.execute();

            idSalida = cs.getInt(7);
            mensaje = cs.getString(8);
        }

        if (idSalida <= 0) {
            return new jsonResult(
                    -1,
                    "Error",
                    mensaje == null
                            ? "No se pudo reportar el incidente."
                            : mensaje
            );
        }

        // El registro ya fue confirmado por Oracle.
        // Un error del correo no debe cambiar el resultado a Error.
        try {
            NotificadorCorreo_PJM notificador =
                    new NotificadorCorreo_PJM();

            notificador.enviarAlertaIncidente(
                    item.RUTA,
                    item.SUCURSAL,
                    item.VENDEDOR,
                    item.MOTIVO,
                    item.DESCRIPCION
            );

        } catch (Exception ex) {
            LOGGER.log(
                    Level.WARNING,
                    "No se pudo enviar el correo del incidente #"
                            + idSalida + " del pedido #" + idPedido,
                    ex
            );

            mensaje = (mensaje == null ? "Operación completada." : mensaje)
                    + " No se pudo enviar el correo de alerta.";
        }

        return new jsonResult(
                idSalida,
                "OK",
                mensaje
        );
    }

    public jsonResult resolverIncidente_PJM(String idIncidente)
            throws Exception {

        int id;

        try {
            id = Integer.parseInt(
                    idIncidente == null
                            ? ""
                            : idIncidente.trim()
            );

            if (id <= 0) {
                throw new NumberFormatException();
            }

        } catch (NumberFormatException ex) {
            return new jsonResult(
                    -1,
                    "Error",
                    "Seleccione un incidente válido."
            );
        }

        ConnectionsPool pool = new ConnectionsPool();

        String sql = "{ call " + SCHEMA
                + ".PKG_INCIDENTES_PJM.RESOLVER_INCIDENTE_PJM(?, ?, ?) }";

        try (Connection conn = pool.conectar();
             CallableStatement cs = conn.prepareCall(sql)) {

            cs.setInt(1, id);
            cs.registerOutParameter(2, Types.NUMERIC);
            cs.registerOutParameter(3, Types.VARCHAR);

            cs.execute();

            int idSalida = cs.getInt(2);
            String mensaje = cs.getString(3);

            if (idSalida == 1) {
                return new jsonResult(1, "OK", mensaje);
            }

            return new jsonResult(-1, "Error", mensaje);
        }
    }
}