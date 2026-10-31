package BACKEND.controller;

import BACKEND.manager.IncidenteManager_PJM;
import BACKEND.model.Incidente_PJM;
import BACKEND.utils.jsonResult;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;

@Path("Incidente_PJM")
public class IncidenteController_PJM {

    IncidenteManager_PJM manager = new IncidenteManager_PJM();

    @GET @Path("/listar") @Produces("application/json")
    public Response getIncidentes(@QueryParam("fecha") String fecha) {
        try { return Response.ok(manager.getIncidentes_PJM(fecha)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @POST @Path("/insertar") @Consumes("application/json") @Produces("application/json")
    public Response insertIncidente(@Context HttpServletRequest req, Incidente_PJM item) {
        try { item.IP = req.getRemoteAddr(); return Response.ok(manager.insertIncidente_PJM(item)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }

    @PUT @Path("/resolver/{id}") @Produces("application/json")
    public Response resolverIncidente(@PathParam("id") String idIncidente) {
        try { return Response.ok(manager.resolverIncidente_PJM(idIncidente)).build(); }
        catch (Exception e) { return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); }
    }
}

