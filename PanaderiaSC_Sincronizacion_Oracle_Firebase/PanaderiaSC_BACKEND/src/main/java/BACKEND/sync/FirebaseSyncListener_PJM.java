package BACKEND.sync;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import java.util.concurrent.*;
import java.util.logging.*;

/** Registrado explícitamente en web.xml: no depende de EJB ni @Schedule. */
public class FirebaseSyncListener_PJM implements ServletContextListener {
    private ScheduledExecutorService executor;
    private static final Logger LOG = Logger.getLogger(FirebaseSyncListener_PJM.class.getName());

    @Override public void contextInitialized(ServletContextEvent event) {
        if (!"true".equalsIgnoreCase(event.getServletContext().getInitParameter("firebase.sync.enabled"))) {
            LOG.info("Firebase sync deshabilitado. Instale SQL y habilite firebase.sync.enabled."); return;
        }
        executor = Executors.newSingleThreadScheduledExecutor(task -> {
            Thread thread = new Thread(task, "PanaderiaSC-FirebaseSync");
            thread.setDaemon(true); return thread;
        });
        executor.scheduleWithFixedDelay(() -> {
            try {
                int total = new FirebaseSync_PJM().processBatch();
                if (total > 0) LOG.info("Firebase: " + total + " eventos confirmados");
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            } catch (Exception ex) {
                LOG.log(Level.WARNING, "Sincronización pendiente; se reintentará", ex);
            }
        }, 5, 5, TimeUnit.SECONDS);
    }

    @Override public void contextDestroyed(ServletContextEvent event) {
        if (executor != null) executor.shutdownNow();
        try { BACKEND.utils.FirebaseConfig_PJM.close(); }
        catch (Exception ex) { LOG.log(Level.WARNING, "Cierre de Firebase", ex); }
    }
}
