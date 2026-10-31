package BACKEND.sync;

import BACKEND.utils.FirebaseConfig_PJM;

/** Ejecutar archivo en NetBeans para procesar un lote sin iniciar el servidor. */
public final class FirebaseSyncPrueba_PJM {
    public static void main(String[] args) throws Exception {
        try {
            int total = new FirebaseSync_PJM().processBatch();
            System.out.println("Eventos enviados a Firebase: " + total);
            System.out.println("Revise FB_SYNC_OUTBOX_PJM para pendientes y errores.");
        } finally { FirebaseConfig_PJM.close(); }
    }
}
