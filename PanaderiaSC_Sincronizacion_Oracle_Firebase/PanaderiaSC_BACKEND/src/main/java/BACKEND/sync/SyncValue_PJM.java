package BACKEND.sync;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;

/** Contrato de documentos: columnas Oracle en MAYÚSCULAS y campos _sync*. */
public final class SyncValue_PJM {
    private SyncValue_PJM() { }

    public static String identifier(String value) {
        if (value == null || !value.matches("[A-Z][A-Z0-9_]{0,127}"))
            throw new IllegalArgumentException("Identificador Oracle inválido");
        return value;
    }

    public static LinkedHashMap<String, Object> keys(String json) {
        JsonObject object = JsonParser.parseString(json).getAsJsonObject();
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            identifier(entry.getKey());
            JsonElement value = entry.getValue();
            if (value.isJsonNull() || !value.isJsonPrimitive())
                throw new IllegalArgumentException("Clave primaria inválida");
            result.put(entry.getKey(), value.getAsJsonPrimitive().isNumber()
                    ? value.getAsBigDecimal() : value.getAsString());
        }
        if (result.isEmpty()) throw new IllegalArgumentException("Clave primaria vacía");
        return result;
    }

    public static String documentId(Map<String, Object> keys) throws Exception {
        if (keys.size() == 1) {
            Object value = keys.values().iterator().next();
            String id = value instanceof BigDecimal
                    ? ((BigDecimal)value).stripTrailingZeros().toPlainString() : value.toString();
            if (id.matches("[A-Za-z0-9_-]{1,200}") && !id.startsWith("__")) return id;
        }
        // Compuestas o cadenas con barras: ID estable sin colisiones de separadores.
        StringBuilder canonical = new StringBuilder();
        for (Map.Entry<String, Object> entry : new TreeMap<>(keys).entrySet()) {
            Object v = entry.getValue();
            String value = v instanceof BigDecimal
                    ? ((BigDecimal)v).stripTrailingZeros().toPlainString() : v.toString();
            canonical.append(entry.getKey().length()).append(':').append(entry.getKey())
                    .append(v instanceof BigDecimal ? 'N' : 'S')
                    .append(value.length()).append(':').append(value);
        }
        byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(canonical.toString().getBytes(StandardCharsets.UTF_8));
        StringBuilder id = new StringBuilder("pk_");
        for (byte b : hash) id.append(String.format("%02x", b & 255));
        return id.toString();
    }

    public static boolean sensitive(String column) {
        return column.toUpperCase(Locale.ROOT).matches(
                ".*(PASSWORD|CONTRASENA|CONTRASEÑA|SECRET|TOKEN|CREDENTIAL|PRIVATE_KEY|PASSWD).*"
                + "|PASS|CLAVE|PWD");
    }

    public static Object value(ResultSet rs, int index) throws Exception {
        int type = rs.getMetaData().getColumnType(index);
        if (type == Types.DATE || type == Types.TIMESTAMP) {
            Timestamp date = rs.getTimestamp(index);
            // Oracle DATE no contiene zona: se conserva la fecha/hora local.
            return date == null ? null : date.toLocalDateTime().toString();
        }
        if (type == Types.TIMESTAMP_WITH_TIMEZONE) {
            Object value = rs.getObject(index, java.time.OffsetDateTime.class);
            return value == null ? null : value.toString();
        }
        Object value = rs.getObject(index);
        if (value == null) return null;
        if (value instanceof BigDecimal) {
            BigDecimal number = (BigDecimal)value;
            try { return number.longValueExact(); }
            catch (ArithmeticException ex) {
                if (number.stripTrailingZeros().scale() <= 0) return number.toPlainString();
                double decimal = number.doubleValue();
                if (!Double.isFinite(decimal)) throw new SQLException("Número fuera de rango");
                return decimal;
            }
        }
        if (value instanceof Clob) {
            Clob clob = (Clob)value;
            try {
                if (clob.length() > 900000) throw new SQLException("CLOB supera el límite de sincronización");
                return clob.getSubString(1, (int)clob.length());
            } finally { clob.free(); }
        }
        if (value instanceof Blob || value instanceof byte[])
            throw new SQLException("Binarios requieren almacenamiento separado; evento conservado");
        if (value instanceof String || value instanceof Number || value instanceof Boolean) return value;
        throw new SQLException("Tipo no soportado: " + value.getClass().getName());
    }
}
