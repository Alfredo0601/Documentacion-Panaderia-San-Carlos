package BACKEND.notificador;

import BACKEND.utils.Config;
import BACKEND.utils.ConnectionsPool;

import javax.ejb.Schedule;
import javax.ejb.Singleton;

import javax.mail.Authenticator;
import javax.mail.Message;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.Properties;

@Singleton
public class NotificadorCorreo_PJM {

    String SCHEMA = new Config().getDBSchema();

    // ============================================================
    // 1. REPORTE DIARIO (11:00 PM)
    // ============================================================

    @Schedule(hour = "23", minute = "0", second = "0", persistent = false)
    public void enviarReporteDiario() {

        System.out.println(
                ">>> [REPORTE] Iniciando envío de correo diario..."
        );

        try {
            String htmlTablaStock = obtenerTablaStock();
            String htmlAuditoria = obtenerAuditoriaHoy();

            String cuerpoHtml =
                    "<html><body style='font-family: Arial, sans-serif;'>"
                    + "<h2 style='color: #7B2D26;'>"
                    + "Reporte Diario - Panadería San Carlos"
                    + "</h2>"
                    + "<h3>Resumen del Dashboard</h3>"
                    + htmlTablaStock
                    + "<hr>"
                    + "<h3>Actividades del Día</h3>"
                    + htmlAuditoria
                    + "</body></html>";

            enviarCorreo(
                    "pansancarlosumg@gmail.com",
                    "Reporte Diario - Panadería San Carlos",
                    cuerpoHtml
            );

        } catch (Exception e) {
            System.err.println(
                    "Error al enviar reporte: " + e.getMessage()
            );
        }
    }

    // ============================================================
    // 2. ALERTA DE STOCK BAJO
    // ============================================================

    public void enviarAlertaStockBajo_PJM() {

        try {
            String tabla = obtenerTablaStockBajo();

            if (tabla == null || tabla.isEmpty()) {
                return;
            }

            String cuerpoHtml =
                    "<html><body style='font-family: Arial, sans-serif;'>"
                    + "<h2 style='color: #dc3545;'>"
                    + "<i>⚠️ ALERTA: Stock por debajo del mínimo</i>"
                    + "</h2>"
                    + "<p>Los siguientes productos han alcanzado "
                    + "su nivel crítico:</p>"
                    + tabla
                    + "</body></html>";

            enviarCorreo(
                    "pansancarlosumg@gmail.com",
                    "⚠️ ALERTA - Stock Bajo en Panadería",
                    cuerpoHtml
            );

        } catch (Exception e) {
            System.err.println(
                    "Error al enviar alerta de stock bajo: "
                    + e.getMessage()
            );
        }
    }

    // ============================================================
    // 3. ALERTA DE AUTO-PRODUCCIÓN
    // ============================================================

    public void enviarAlertaAutoProduccion(String mensajeDetalle) {

        try {
            String cuerpoHtml =
                    "<html><body style='font-family: Arial, sans-serif;'>"
                    + "<h2 style='color: #ffc107;'>"
                    + "<i>⚠️ ADVERTENCIA: Producción Automática Generada</i>"
                    + "</h2>"
                    + "<p>El sistema ha detectado productos con menos "
                    + "de 10 unidades en stock.</p>"
                    + "<p><b>Detalle:</b> " + mensajeDetalle + "</p>"
                    + "<p>Se han generado 50 unidades automáticamente "
                    + "para dichos productos y se han actualizado "
                    + "los stocks.</p>"
                    + "</body></html>";

            enviarCorreo(
                    "pansancarlosumg@gmail.com",
                    "⚠️ ADVERTENCIA - Producción Automática",
                    cuerpoHtml
            );

            System.out.println(
                    ">>> ✅ Alerta de Producción Automática enviada."
            );

        } catch (Exception e) {
            System.err.println(
                    "Error al enviar alerta de auto-producción: "
                    + e.getMessage()
            );
        }
    }

    // ============================================================
    // 4. ALERTA DE INCIDENTE EN RUTA
    // ============================================================

    public void enviarAlertaIncidente(
            String ruta,
            String sucursal,
            String vendedor,
            String motivo,
            String descripcion
    ) {

        try {
            String cuerpoHtml =
                    "<html><body style='font-family: Arial, sans-serif;'>"
                    + "<h2 style='color: #dc3545;'>"
                    + "🚨 EMERGENCIA EN RUTA"
                    + "</h2>"
                    + "<p>El vendedor ha reportado un problema "
                    + "que requiere atención inmediata:</p>"

                    + "<table border='1' "
                    + "style='border-collapse: collapse; "
                    + "width: 100%; text-align: left;'>"

                    + "<tr style='background-color: #dc3545; color: white;'>"
                    + "<th style='padding: 8px;'>Campo</th>"
                    + "<th style='padding: 8px;'>Detalle</th>"
                    + "</tr>"

                    + "<tr>"
                    + "<td style='padding: 8px;'><b>Vendedor</b></td>"
                    + "<td style='padding: 8px;'>" + vendedor + "</td>"
                    + "</tr>"

                    + "<tr>"
                    + "<td style='padding: 8px;'><b>Ruta</b></td>"
                    + "<td style='padding: 8px;'>" + ruta + "</td>"
                    + "</tr>"

                    + "<tr>"
                    + "<td style='padding: 8px;'><b>Sucursal</b></td>"
                    + "<td style='padding: 8px;'>" + sucursal + "</td>"
                    + "</tr>"

                    + "<tr>"
                    + "<td style='padding: 8px;'><b>Motivo</b></td>"
                    + "<td style='padding: 8px; color: #dc3545;'>"
                    + "<b>" + motivo + "</b>"
                    + "</td>"
                    + "</tr>"

                    + "<tr>"
                    + "<td style='padding: 8px;'><b>Descripción</b></td>"
                    + "<td style='padding: 8px;'>" + descripcion + "</td>"
                    + "</tr>"

                    + "</table>"

                    + "<p>Por favor, envíe otra unidad para despachar "
                    + "el pedido a la brevedad posible.</p>"
                    + "</body></html>";

            enviarCorreo(
                    "pansancarlosumg@gmail.com",
                    "🚨 EMERGENCIA - Problema en Ruta",
                    cuerpoHtml
            );

            System.out.println(
                    ">>> ✅ Alerta de Incidente en Ruta enviada. "
                    + "Vendedor: " + vendedor
            );

        } catch (Exception e) {
            System.err.println(
                    "Error al enviar alerta de incidente: "
                    + e.getMessage()
            );

            e.printStackTrace();
        }
    }

    // ============================================================
    // RESUMEN DEL DASHBOARD + INCIDENTES RUTA
    // ============================================================

    private String obtenerTablaStock() throws Exception {

        StringBuilder sb = new StringBuilder();

        sb.append(
                "<table border='1' "
                + "style='border-collapse: collapse; "
                + "width: 100%; text-align: left;'>"
        );

        sb.append(
                "<tr style='background-color: #F4A950; color: white;'>"
                + "<th style='padding: 8px;'>Concepto</th>"
                + "<th style='padding: 8px;'>Total</th>"
                + "</tr>"
        );

        ConnectionsPool pool = new ConnectionsPool();

        try (Connection conn = pool.conectar()) {

            String llamada = "{ call " + SCHEMA
                    + ".PKG_REPORTES_PJM.GET_RESUMEN_STOCK_PJM(?) }";

            try (CallableStatement cs = conn.prepareCall(llamada)) {

                cs.registerOutParameter(1, Types.REF_CURSOR);
                cs.execute();

                try (ResultSet rs = (ResultSet) cs.getObject(1)) {

                    while (rs.next()) {
                        sb.append("<tr>");

                        sb.append("<td style='padding: 8px;'>")
                                .append(rs.getString("CONCEPTO"))
                                .append("</td>");

                        sb.append(
                                "<td style='padding: 8px; "
                                + "font-weight: bold;'>"
                        )
                                .append(rs.getString("TOTAL"))
                                .append("</td>");

                        sb.append("</tr>");
                    }
                }
            }

            // Agregar la cantidad total de incidentes,
            // igual que el indicador del dashboard.
            String sql = "SELECT COUNT(*) AS TOTAL FROM "
                    + SCHEMA
                    + ".INCIDENTES_RUTA_PJM";

            try (PreparedStatement ps = conn.prepareStatement(sql);
                 ResultSet rs = ps.executeQuery()) {

                if (rs.next()) {
                    sb.append("<tr>");

                    sb.append(
                            "<td style='padding: 8px;'>"
                            + "Incidentes Ruta"
                            + "</td>"
                    );

                    sb.append(
                            "<td style='padding: 8px; "
                            + "font-weight: bold;'>"
                    )
                            .append(rs.getInt("TOTAL"))
                            .append("</td>");

                    sb.append("</tr>");
                }
            }
        }

        sb.append("</table>");

        return sb.toString();
    }

    // ============================================================
    // TABLA DE STOCK BAJO
    // ============================================================

    private String obtenerTablaStockBajo() throws Exception {

        StringBuilder sb = new StringBuilder();
        int contador = 0;

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();

        CallableStatement cs = null;
        ResultSet rs = null;

        try {
            cs = conn.prepareCall(
                    "{ call " + SCHEMA
                    + ".PKG_REPORTES_PJM.GET_STOCK_BAJO_PJM(?) }"
            );

            cs.registerOutParameter(1, Types.REF_CURSOR);
            cs.execute();

            rs = (ResultSet) cs.getObject(1);

            while (rs.next()) {

                if (contador == 0) {
                    sb.append(
                            "<table border='1' "
                            + "style='border-collapse: collapse; "
                            + "width: 100%; text-align: left;'>"
                    );

                    sb.append(
                            "<tr style='background-color: #dc3545; "
                            + "color: white;'>"
                    );

                    sb.append(
                            "<th style='padding: 8px;'>Tipo</th>"
                            + "<th style='padding: 8px;'>Código</th>"
                            + "<th style='padding: 8px;'>Producto</th>"
                            + "<th style='padding: 8px;'>Stock Actual</th>"
                            + "<th style='padding: 8px;'>Stock Mínimo</th>"
                            + "</tr>"
                    );
                }

                sb.append("<tr><td style='padding: 8px;'><b>")
                        .append(rs.getString("TIPO"))
                        .append("</b></td>");

                sb.append("<td style='padding: 8px;'>")
                        .append(rs.getString("CODIGO"))
                        .append("</td>");

                sb.append("<td style='padding: 8px;'>")
                        .append(rs.getString("NOMBRE"))
                        .append("</td>");

                sb.append(
                        "<td style='padding: 8px; color: #dc3545; "
                        + "font-weight: bold;'>"
                )
                        .append(rs.getString("STOCK"))
                        .append("</td>");

                sb.append("<td style='padding: 8px;'>")
                        .append(rs.getString("STOCK_MINIMO"))
                        .append("</td></tr>");

                contador++;
            }

            if (contador > 0) {
                sb.append("</table>");
                return sb.toString();
            }

            return "";

        } finally {
            if (rs != null) {
                rs.close();
            }

            if (cs != null) {
                cs.close();
            }

            if (conn != null) {
                conn.close();
            }
        }
    }

    // ============================================================
    // AUDITORÍA DEL DÍA
    // ============================================================

    private String obtenerAuditoriaHoy() throws Exception {

        StringBuilder sb = new StringBuilder();

        sb.append(
                "<table border='1' "
                + "style='border-collapse: collapse; "
                + "width: 100%; text-align: left;'>"
        );

        sb.append(
                "<tr style='background-color: #7B2D26; color: white;'>"
                + "<th style='padding: 8px;'>Acción</th>"
                + "<th style='padding: 8px;'>Descripción</th>"
                + "<th style='padding: 8px;'>Hora</th>"
                + "</tr>"
        );

        ConnectionsPool c = new ConnectionsPool();
        Connection conn = c.conectar();

        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            String sql =
                    "SELECT ACCION, DESCRIPCION, "
                    + "TO_CHAR(FECHA, 'HH24:MI') AS HORA "
                    + "FROM " + SCHEMA + ".AUDITORIA_PJM "
                    + "WHERE TRUNC(FECHA) = TRUNC(SYSDATE - (6/24)) "
                    + "ORDER BY FECHA DESC";

            ps = conn.prepareStatement(sql);
            rs = ps.executeQuery();

            boolean hayDatos = false;

            while (rs.next()) {
                hayDatos = true;

                sb.append("<tr><td style='padding: 8px;'>")
                        .append(rs.getString("ACCION"))
                        .append("</td>");

                sb.append("<td style='padding: 8px;'>")
                        .append(rs.getString("DESCRIPCION"))
                        .append("</td>");

                sb.append("<td style='padding: 8px;'>")
                        .append(rs.getString("HORA"))
                        .append("</td></tr>");
            }

            if (!hayDatos) {
                sb.append(
                        "<tr><td colspan='3' "
                        + "style='text-align: center; padding: 10px;'>"
                        + "No hubo actividad hoy."
                        + "</td></tr>"
                );
            }

        } finally {
            if (rs != null) {
                rs.close();
            }

            if (ps != null) {
                ps.close();
            }

            if (conn != null) {
                conn.close();
            }
        }

        sb.append("</table>");

        return sb.toString();
    }

    // ============================================================
    // CONFIGURACIÓN ORIGINAL DEL CORREO
    // ============================================================

    private void enviarCorreo(
            String destinatario,
            String asunto,
            String cuerpoHtml
    ) throws Exception {

        String host = "smtp.gmail.com";
        String puerto = "587";

        final String usuario = "pansancarlosumg@gmail.com";
        final String password = System.getenv("PANADERIA_SMTP_PASSWORD");

        Properties props = new Properties();

        props.put("mail.smtp.host", host);
        props.put("mail.smtp.port", puerto);
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.ssl.protocols", "TLSv1.2");

        Session session = Session.getInstance(
                props,
                new Authenticator() {
                    @Override
                    protected PasswordAuthentication
                    getPasswordAuthentication() {

                        return new PasswordAuthentication(
                                usuario,
                                password
                        );
                    }
                }
        );

        Message message = new MimeMessage(session);

        message.setFrom(new InternetAddress(usuario));

        message.setRecipients(
                Message.RecipientType.TO,
                InternetAddress.parse(destinatario)
        );

        message.setSubject(asunto);
        message.setContent(cuerpoHtml, "text/html; charset=UTF-8");

        Transport.send(message);
    }
}