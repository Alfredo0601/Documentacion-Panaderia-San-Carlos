package BACKEND.controller;

import BACKEND.notificador.NotificadorCorreo_PJM;
import BACKEND.utils.jsonResult;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Response;

@Path("Correo_PJM")
public class CorreoController_PJM {

    // GET http://localhost:8091/BACKEND/webapi/Correo_PJM/enviar
    @GET
    @Path("/enviar")
    @Produces("application/json")
    public Response enviarCorreoManual() {
        try {
            NotificadorCorreo_PJM notificador = new NotificadorCorreo_PJM();
            notificador.enviarReporteDiario();
            return Response.ok(new jsonResult(1, "OK", "Correo diario enviado (revisa tu bandeja)")).build();
        } catch (Exception e) {
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }

    // GET http://localhost:8091/BACKEND/webapi/Correo_PJM/alertaStock
    @GET
    @Path("/alertaStock")
    @Produces("application/json")
    public Response enviarAlertaStock() {
        try {
            NotificadorCorreo_PJM notificador = new NotificadorCorreo_PJM();
            notificador.enviarAlertaStockBajo_PJM();
            return Response.ok(new jsonResult(1, "OK", "Alerta procesada (revisa el correo si hubo stock bajo)")).build();
        } catch (Exception e) {
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }

    // GET http://localhost:8091/BACKEND/webapi/Correo_PJM/pruebaIncidente
    @GET
    @Path("/pruebaIncidente")
    @Produces("application/json")
    public Response pruebaIncidente() {
        try {
            NotificadorCorreo_PJM notificador = new NotificadorCorreo_PJM();
            notificador.enviarAlertaIncidente(
                "Ruta 5",
                "Sucursal Zona 10",
                "Kevin Prueba",
                "Llanta pinchada",
                "Prueba manual desde el navegador para validar el envío."
            );
            return Response.ok(new jsonResult(1, "OK", "Correo de prueba de incidente enviado")).build();
        } catch (Exception e) {
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }
}