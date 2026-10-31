package BACKEND.controller;

import BACKEND.manager.ProduccionManager_PJM;
import BACKEND.model.DetalleProduccion_PJM;
import BACKEND.model.Produccion_PJM;
import BACKEND.utils.jsonResult;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;

@Path("Produccion_PJM")
public class ProduccionController_PJM {

    ProduccionManager_PJM manager = new ProduccionManager_PJM();

    @GET @Path("/listar") @Produces("application/json")
    public Response getProduccion(@QueryParam("idProduccion") String idProduccion) {
        try { return Response.ok(manager.getProduccion_PJM(idProduccion)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/detalles/{id}") @Produces("application/json")
    public Response getDetalles(@PathParam("id") String idProduccion) {
        try { return Response.ok(manager.getDetalleProduccion_PJM(idProduccion)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/activas") @Produces("application/json")
    public Response getProduccionActiva() {
        try { return Response.ok(new jsonResult(1, "OK", manager.getProduccionActiva_PJM())).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @GET @Path("/anuladas") @Produces("application/json")
    public Response getProduccionAnulada() {
        try { return Response.ok(new jsonResult(1, "OK", manager.getProduccionAnulada_PJM())).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @POST @Path("/insertarEncabezado") @Consumes("application/json") @Produces("application/json")
    public Response insertEncabezado(@Context HttpServletRequest req, Produccion_PJM item) {
        try { item.IP = req.getRemoteAddr(); return Response.ok(manager.insertProduccion_PJM(item)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @POST @Path("/insertarDetalle") @Consumes("application/json") @Produces("application/json")
    public Response insertDetalle(@Context HttpServletRequest req, DetalleProduccion_PJM item) {
        try { item.IP = req.getRemoteAddr(); return Response.ok(manager.insertDetalleProduccion_PJM(item)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @DELETE @Path("/anular/{id}") @Produces("application/json")
    public Response anularProduccion(@PathParam("id") String idProduccion) {
        try { return Response.ok(manager.anularProduccion_PJM(idProduccion)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @DELETE @Path("/anularDetalle/{id}") @Produces("application/json")
    public Response anularDetalle(@PathParam("id") String idDetalle) {
        try { return Response.ok(manager.anularDetalleProduccion_PJM(idDetalle)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @POST @Path("/reabastecerAuto") @Produces("application/json")
    public Response autoReabastecer() {
        try { return Response.ok(manager.autoReabastecer_PJM()).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }   
}