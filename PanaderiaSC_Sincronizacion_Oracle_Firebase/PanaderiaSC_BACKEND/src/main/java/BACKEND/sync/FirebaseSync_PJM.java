package BACKEND.sync;

import BACKEND.utils.Config;
import BACKEND.utils.ConnectionsPool;
import BACKEND.utils.FirebaseConfig_PJM;
import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.DocumentReference;
import java.sql.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.logging.*;

/** Proyección Oracle -> Firestore. La cola se confirma en la misma transacción de negocio. */
public final class FirebaseSync_PJM {
    private static final Logger LOG = Logger.getLogger(FirebaseSync_PJM.class.getName());

    public int processBatch() throws Exception {
        String schema = SyncValue_PJM.identifier(new Config().getDBSchema().toUpperCase(Locale.ROOT));
        try (Connection conn = new ConnectionsPool().conectar()) {
            conn.setAutoCommit(false);
            try {
                // Un solo publicador activo, incluso con dos instancias del backend.
                try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT ID FROM " + schema + ".FB_SYNC_LOCK_PJM WHERE ID=1 FOR UPDATE NOWAIT")) {
                    if (!rs.next()) throw new SQLException("Falta la fila de bloqueo de sincronización");
                }
                List<Event> events = new ArrayList<>();
                try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT ID_EVENTO,TABLA,PK_JSON,INTENTOS FROM " + schema
                        + ".FB_SYNC_OUTBOX_PJM WHERE PROXIMO_INTENTO <= SYSTIMESTAMP "
                        + "ORDER BY ID_EVENTO FETCH FIRST 20 ROWS ONLY")) {
                    while (rs.next()) events.add(new Event(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getInt(4)));
                }
                int completed = 0;
                for (Event event : events) {
                    if (Thread.currentThread().isInterrupted()) break;
                    Savepoint point = conn.setSavepoint();
                    try {
                        publish(conn, schema, event);
                        try (PreparedStatement ps = conn.prepareStatement(
                                "DELETE FROM " + schema + ".FB_SYNC_OUTBOX_PJM WHERE ID_EVENTO=?")) {
                            ps.setLong(1, event.id); ps.executeUpdate();
                        }
                        completed++;
                    } catch (InterruptedException ex) {
                        conn.rollback(); Thread.currentThread().interrupt(); throw ex;
                    } catch (Exception ex) {
                        conn.rollback(point);
                        int delay = Math.min(300, 5 * (1 << Math.min(event.attempts, 6)));
                        try (PreparedStatement ps = conn.prepareStatement(
                                "UPDATE " + schema + ".FB_SYNC_OUTBOX_PJM SET INTENTOS=INTENTOS+1, "
                                + "ULTIMO_ERROR=?,PROXIMO_INTENTO=SYSTIMESTAMP+NUMTODSINTERVAL(?,'SECOND') "
                                + "WHERE ID_EVENTO=?")) {
                            String message = ex.getClass().getSimpleName() + ": " + ex.getMessage();
                            ps.setString(1, message.substring(0, Math.min(1000, message.length())));
                            ps.setInt(2, delay); ps.setLong(3, event.id); ps.executeUpdate();
                        }
                        LOG.warning("Firebase pendiente: evento " + event.id + " tabla " + event.table
                                + " (reintento en " + delay + " s)");
                    }
                }
                conn.commit();
                return completed;
            } catch (Exception ex) {
                conn.rollback();
                if (ex instanceof SQLException && ((SQLException)ex).getErrorCode() == 54) return 0;
                throw ex;
            }
        }
    }

    private void publish(Connection conn, String schema, Event event) throws Exception {
        String table = SyncValue_PJM.identifier(event.table);
        String collection;
        String pkColumns;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COLECCION,PK_COLUMNAS FROM " + schema + ".FB_SYNC_TABLES_PJM WHERE TABLA=? AND ACTIVA=1")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) throw new SQLException("Tabla no habilitada para sincronización: " + table);
                collection = rs.getString(1); pkColumns = rs.getString(2);
            }
        }
        LinkedHashMap<String, Object> keys = SyncValue_PJM.keys(event.pk);
        if (!String.join(",", keys.keySet()).equals(pkColumns))
            throw new SQLException("Clave no coincide con metadatos instalados");
        StringJoiner where = new StringJoiner(" AND ");
        for (String key : keys.keySet()) where.add(SyncValue_PJM.identifier(key) + "=?");
        Map<String, Object> data = null;
        try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM " + schema + "." + table + " WHERE " + where)) {
            int index = 1;
            for (Object key : keys.values()) ps.setObject(index++, key);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    data = new LinkedHashMap<>();
                    ResultSetMetaData meta = rs.getMetaData();
                    for (int i = 1; i <= meta.getColumnCount(); i++) {
                        String column = meta.getColumnLabel(i);
                        if (!SyncValue_PJM.sensitive(column)) data.put(column, SyncValue_PJM.value(rs, i));
                    }
                }
            }
        }
        Firestore db = FirebaseConfig_PJM.getFirestore();
        DocumentReference document = db.collection(collection).document(SyncValue_PJM.documentId(keys));
        long version;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(
                "SELECT " + schema + ".FB_SYNC_VERSION_PJM.NEXTVAL FROM DUAL")) {
            rs.next(); version=rs.getLong(1);
        }
        // Las bajas físicas conservan una marca/version para impedir resurrecciones
        // por solicitudes antiguas que terminan después de un timeout.
        final Map<String, Object> payload = data == null ? new LinkedHashMap<>() : data;
        payload.put("_syncEliminado", data == null);
        payload.put("_syncOrigen", "ORACLE");
        payload.put("_syncTabla", table);
        payload.put("_syncEvento", event.id);
        payload.put("_syncVersion", version);
        payload.put("_syncFecha", FieldValue.serverTimestamp());
        db.runTransaction(transaction -> {
            com.google.cloud.firestore.DocumentSnapshot previous = transaction.get(document).get();
            Long lastVersion = previous.exists() ? previous.getLong("_syncVersion") : null;
            if (lastVersion == null || lastVersion < version) transaction.set(document, payload);
            return null;
        }).get(30, TimeUnit.SECONDS);
    }

    private static final class Event {
        final long id; final String table; final String pk; final int attempts;
        Event(long id, String table, String pk, int attempts) {
            this.id=id; this.table=table; this.pk=pk; this.attempts=attempts;
        }
    }
}
