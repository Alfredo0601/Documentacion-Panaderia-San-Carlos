package BACKEND.controller;

import BACKEND.manager.RecetaManager_PJM;
import BACKEND.model.Receta_PJM;
import BACKEND.utils.jsonResult;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;

@Path("Receta_PJM")
public class RecetaController_PJM {

    RecetaManager_PJM manager = new RecetaManager_PJM();

    // GET http://localhost:8091/BACKEND/webapi/Receta_PJM/listar/11
    @GET
    @Path("/listar/{idProducto}")
    @Produces("application/json")
    public Response getReceta(@PathParam("idProducto") String idProducto) {
        try {
            return Response.ok(manager.getReceta_PJM(idProducto)).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }

    // POST http://localhost:8091/BACKEND/webapi/Receta_PJM/insertar
    // Body: { "ID_PRODUCTO":"11", "ID_INSUMO":"1", "CANTIDAD":"5" }
    @POST
    @Path("/insertar")
    @Consumes("application/json")
    @Produces("application/json")
    public Response insertReceta(@Context HttpServletRequest req, Receta_PJM item) {
        try {
            item.IP = req.getRemoteAddr();
            return Response.ok(manager.insertReceta_PJM(item)).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }

    // DELETE http://localhost:8091/BACKEND/webapi/Receta_PJM/eliminar/1
    @DELETE
    @Path("/eliminar/{id}")
    @Produces("application/json")
    public Response eliminarReceta(@PathParam("id") String idReceta) {
        try {
            return Response.ok(manager.eliminarReceta_PJM(idReceta)).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }
}