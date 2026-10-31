import BACKEND.sync.SyncValue_PJM;
import java.math.BigDecimal;
import java.lang.reflect.Proxy;
import java.sql.*;
import java.util.*;

public class SyncValueTest {
    public static void main(String[] args) throws Exception {
        Map<String,Object> numeric = SyncValue_PJM.keys("{\"ID_PEDIDO\":55}");
        check("55".equals(SyncValue_PJM.documentId(numeric)), "ID Oracle estable");
        check("55".equals(SyncValue_PJM.documentId(SyncValue_PJM.keys("{\"ID_PEDIDO\":55.0}"))), "Número normalizado");
        Map<String,Object> first = SyncValue_PJM.keys("{\"A\":1,\"B\":\"x/y\"}");
        Map<String,Object> reordered = SyncValue_PJM.keys("{\"B\":\"x/y\",\"A\":1.0}");
        check(SyncValue_PJM.documentId(first).equals(SyncValue_PJM.documentId(reordered)), "PK compuesta estable");
        check(!SyncValue_PJM.documentId(first).contains("/"), "Sin barras en ID");
        check(!SyncValue_PJM.documentId(first).equals(SyncValue_PJM.documentId(
            SyncValue_PJM.keys("{\"A\":\"1\",\"B\":\"x/y\"}"))), "Tipos de PK distintos");
        check(SyncValue_PJM.sensitive("PASSWORD") && SyncValue_PJM.sensitive("ACCESS_TOKEN"), "Secretos excluidos");
        check(!SyncValue_PJM.sensitive("STOCK_MINIMO"), "Stock incluido");
        try { SyncValue_PJM.identifier("PEDIDO;DROP TABLE X"); throw new AssertionError("SQL inseguro"); }
        catch (IllegalArgumentException expected) { }
        Object decimal = SyncValue_PJM.value(row(new BigDecimal("0.0008"), Types.NUMERIC), 1);
        check(decimal instanceof Double && ((Double)decimal)==0.0008, "Decimales de receta");
        Object large = SyncValue_PJM.value(row(new BigDecimal("99999999999999999999999"), Types.NUMERIC), 1);
        check(large.equals("99999999999999999999999"), "Enteros grandes sin pérdida");
        Object date = SyncValue_PJM.value(row(Timestamp.valueOf("2026-10-30 23:15:00"), Types.TIMESTAMP), 1);
        check(date.equals("2026-10-30T23:15"), "Fecha local preservada");
        check(SyncValue_PJM.value(row(null, Types.NUMERIC), 1)==null, "NULL preservado");
        System.out.println("OK: 12 comprobaciones de identidad, precisión, fechas y exclusión de secretos.");
    }
    static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    static ResultSet row(Object value, int type) {
        ResultSetMetaData metadata = (ResultSetMetaData)Proxy.newProxyInstance(
            SyncValueTest.class.getClassLoader(),new Class[]{ResultSetMetaData.class},
            (p,m,a)-> {if (m.getName().equals("getColumnType")) return type; throw new UnsupportedOperationException();});
        return (ResultSet)Proxy.newProxyInstance(SyncValueTest.class.getClassLoader(),new Class[]{ResultSet.class},
            (p,m,a)-> {switch(m.getName()) {
                case "getMetaData": return metadata;
                case "getObject": case "getTimestamp": return value;
                default: throw new UnsupportedOperationException();
            }});
    }
}
