package BACKEND.controller;

import BACKEND.manager.PedidoManager_PJM;
import BACKEND.model.DetallePedido_PJM;
import BACKEND.model.Pedido_PJM;
import BACKEND.utils.jsonResult;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;

@Path("Pedido_PJM")
public class PedidoController_PJM {

    PedidoManager_PJM manager = new PedidoManager_PJM();

    @GET @Path("/listar") @Produces("application/json")
    public Response getPedidos(@QueryParam("idSucursal") String idSucursal, @QueryParam("idPedido") String idPedido) {
        try { return Response.ok(manager.getPedidos_PJM(idSucursal, idPedido)).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @GET @Path("/detalles/{id}") @Produces("application/json")
    public Response getDetalles(@PathParam("id") String idPedido) {
        try { return Response.ok(manager.getDetallePedido_PJM(idPedido)).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @GET @Path("/total/{id}") @Produces("application/json")
    public Response getTotal(@PathParam("id") String idPedido) {
        try { return Response.ok(new jsonResult(1, "OK", manager.getTotalPedido_PJM(idPedido))).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @GET @Path("/activos") @Produces("application/json")
    public Response getPedidosActivos() {
        try { return Response.ok(new jsonResult(1, "OK", manager.getPedidosActivos_PJM())).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @GET @Path("/anulados") @Produces("application/json")
    public Response getPedidosAnulados() {
        try { return Response.ok(new jsonResult(1, "OK", manager.getPedidosAnulados_PJM())).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @GET @Path("/entregadosCount") @Produces("application/json")
    public Response getPedidosEntregadosCount() {
        try { return Response.ok(new jsonResult(1, "OK", manager.getPedidosEntregadosCount_PJM())).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @POST @Path("/insertarEncabezado") @Consumes("application/json") @Produces("application/json")
    public Response insertEncabezado(@Context HttpServletRequest req, Pedido_PJM item) {
        try { 
            item.IP = req.getRemoteAddr(); 
            return Response.ok(manager.insertPedido_PJM(item)).build(); 
        }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @POST @Path("/insertarDetalle") @Consumes("application/json") @Produces("application/json")
    public Response insertDetalle(@Context HttpServletRequest req, DetallePedido_PJM item) {
        try { 
            item.IP = req.getRemoteAddr(); 
            return Response.ok(manager.insertDetallePedido_PJM(item)).build(); 
        }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    // ============================================================
    // ENDPOINTS DEL VENDEDOR (PUT)
    // ============================================================

    @PUT @Path("/tomar/{id}") @Produces("application/json")
    public Response tomarPedido(@PathParam("id") String idPedido, @QueryParam("vendedor") String vendedor) {
        try { 
            return Response.ok(manager.tomarPedido_PJM(idPedido, vendedor)).build(); 
        } catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @PUT @Path("/entregar/{id}") @Produces("application/json")
    public Response entregarPedido(@PathParam("id") String idPedido, @QueryParam("vendedor") String vendedor) {
        try { 
            return Response.ok(manager.entregarPedido_PJM(idPedido, vendedor)).build(); 
        } catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @DELETE @Path("/anular/{id}") @Produces("application/json")
    public Response anularPedido(@PathParam("id") String idPedido) {
        try { return Response.ok(manager.anularPedido_PJM(idPedido)).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }

    @DELETE @Path("/anularDetalle/{id}") @Produces("application/json")
    public Response anularDetalle(@PathParam("id") String idDetalle) {
        try { return Response.ok(manager.anularDetallePedido_PJM(idDetalle)).build(); }
        catch (Exception e) { 
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build(); 
        }
    }
}