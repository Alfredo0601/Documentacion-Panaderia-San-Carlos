package BACKEND.controller;

import BACKEND.manager.ProductoManager_PJM;
import BACKEND.model.Producto_PJM;
import BACKEND.model.Producto_PJM;
import BACKEND.utils.jsonResult;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;

@Path("Producto_PJM")
public class ProductoController_PJM {

    ProductoManager_PJM manager = new ProductoManager_PJM();

    // GET http://localhost:8091/BACKEND/webapi/Producto_PJM/listar
    // GET http://localhost:8091/BACKEND/webapi/Producto_PJM/listar?tipo=FINAL
    // GET http://localhost:8091/BACKEND/webapi/Producto_PJM/listar?tipo=INSUMO
    @GET
    @Path("/listar")
    @Produces("application/json")
    public Response getProductos(@QueryParam("tipo") String tipo) {
        try {
            return Response.ok(manager.getProductos_PJM(tipo)).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }

    // GET http://localhost:8091/BACKEND/webapi/Producto_PJM/obtener/1
    @GET
    @Path("/obtener/{id}")
    @Produces("application/json")
    public Response getProductoById(@PathParam("id") String idProducto) {
        try {
            return Response.ok(manager.getProductoById_PJM(idProducto)).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }

    // POST http://localhost:8091/BACKEND/webapi/Producto_PJM/insertar
    // Body FINAL:   { "NOMBRE":"CUBOS","CODIGO":"PAN01","TIPO":"FINAL","PRECIO":"1","STOCK":"0","STOCK_MINIMO":"0","UNIDAD_MEDIDA":"UNIDAD" }
    // Body INSUMO:  { "NOMBRE":"HARINA","CODIGO":"HF001","TIPO":"INSUMO","PRECIO":"8.5","STOCK":"500","STOCK_MINIMO":"100","UNIDAD_MEDIDA":"LIBRA" }
    @POST
    @Path("/insertar")
    @Consumes("application/json")
    @Produces("application/json")
    public Response insertProducto(@Context HttpServletRequest req, Producto_PJM item) {
        try {
            item.IP = req.getRemoteAddr();
            return Response.ok(manager.insertProducto_PJM(item)).build();
        } catch (Exception e) {
            e.printStackTrace();
            return Response.ok(new jsonResult(-1, "Error", e.getMessage())).build();
        }
    }
}