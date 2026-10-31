package BACKEND.controller;

import BACKEND.manager.ReporteManager_PJM;
import BACKEND.utils.jsonResult;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Response;

@Path("Reporte_PJM")
public class ReporteController_PJM {

    ReporteManager_PJM manager = new ReporteManager_PJM();

    @GET @Path("/pedidosPorSucursal") @Produces("application/json")
    public Response getPedidosPorSucursal(@QueryParam("idSucursal") String idSucursal, @QueryParam("fecha") String fecha) {
        try { return Response.ok(manager.getPedidosPorSucursal_PJM(idSucursal, fecha)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/pedidosCancelados") @Produces("application/json")
    public Response getPedidosCancelados(@QueryParam("idSucursal") String idSucursal, @QueryParam("fecha") String fecha) {
        try { return Response.ok(manager.getPedidosCancelados_PJM(idSucursal, fecha)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/pedidosEntregados") @Produces("application/json")
    public Response getPedidosEntregados(@QueryParam("idSucursal") String idSucursal, @QueryParam("fecha") String fecha) {
        try { return Response.ok(manager.getPedidosEntregados_PJM(idSucursal, fecha)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/produccion") @Produces("application/json")
    public Response getProduccion(@QueryParam("idProduccion") String idProduccion, @QueryParam("fecha") String fecha) {
        try { return Response.ok(manager.getProduccionReporte_PJM(idProduccion, fecha)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/produccionCancelada") @Produces("application/json")
    public Response getProduccionCancelada(@QueryParam("idProduccion") String idProduccion, @QueryParam("fecha") String fecha) {
        try { return Response.ok(manager.getProduccionCancelada_PJM(idProduccion, fecha)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/stockBajo") @Produces("application/json")
    public Response getStockBajo() {
        try { return Response.ok(manager.getStockBajo_PJM()).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/graficas") @Produces("application/json")
    public Response getDatosGraficas() {
        try { return Response.ok(manager.getDatosGraficas_PJM()).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }
}