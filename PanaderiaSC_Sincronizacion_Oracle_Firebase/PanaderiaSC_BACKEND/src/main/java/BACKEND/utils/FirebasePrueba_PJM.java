package BACKEND.utils;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;

import java.util.concurrent.TimeUnit;

public class FirebasePrueba_PJM {

    public static void main(String[] args) {

        Firestore db = null;

        try {
            System.out.println("Conectando con Firebase...");

            db = FirebaseConfig_PJM.getFirestore();

            // Lectura de prueba: no crea ni modifica documentos.
            DocumentSnapshot documento = db
                    .collection("pruebas")
                    .document("conexion")
                    .get()
                    .get(30, TimeUnit.SECONDS);

            System.out.println(
                    "CONEXIÓN CORRECTA CON FIRESTORE"
            );

            System.out.println(
                    "Proyecto: panaderiasc-1ee88"
            );

            if (documento.exists()) {
                System.out.println(
                        "El documento de prueba existe."
                );
            } else {
                System.out.println(
                        "El documento no existe, "
                        + "pero la lectura se completó correctamente."
                );
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("La prueba fue interrumpida.");

        } catch (Exception e) {
            System.err.println(
                    "ERROR DE CONEXIÓN: " + e.getMessage()
            );

            e.printStackTrace();

        } finally {
            if (db != null) {
                try {
                    FirebaseConfig_PJM.close();
                } catch (Exception e) {
                    System.err.println(
                            "Error al cerrar la prueba: "
                            + e.getMessage()
                    );
                }
            }
        }
    }
}