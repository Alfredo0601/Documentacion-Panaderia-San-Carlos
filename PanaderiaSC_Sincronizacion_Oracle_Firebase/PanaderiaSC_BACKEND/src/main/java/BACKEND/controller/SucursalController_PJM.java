package BACKEND.controller;

import BACKEND.manager.SucursalManager_PJM;
import BACKEND.model.Sucursal_PJM;
import BACKEND.model.Sucursal_PJM;
import BACKEND.utils.jsonResult;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;

@Path("Sucursal_PJM")
public class SucursalController_PJM {

    SucursalManager_PJM manager = new SucursalManager_PJM();

    // GET http://localhost:8091/BACKEND/webapi/Sucursal_PJM/listar
    @GET
    @Path("/listar")
    @Produces("application/json")
    public Response getSucursales() {
        try {
            return Response.ok(manager.getSucursales_PJM()).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }

    // POST http://localhost:8091/BACKEND/webapi/Sucursal_PJM/insertar
    // Body: { "NOMBRE":"CENTRAL", "DIRECCION":"Zona 1", "TELEFONO":"2222-1111", "RUTA":"RUTA 3" }
    @POST
    @Path("/insertar")
    @Consumes("application/json")
    @Produces("application/json")
    public Response insertSucursal(@Context HttpServletRequest req, Sucursal_PJM item) {
        try {
            item.IP = req.getRemoteAddr();
            return Response.ok(manager.insertSucursal_PJM(item)).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }
}