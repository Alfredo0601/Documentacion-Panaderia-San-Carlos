package BACKEND.utils;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;

import java.io.FileInputStream;
import java.io.IOException;

public final class FirebaseConfig_PJM {

    private static final String APP_NAME = "PanaderiaSC";

    private static final String PROJECT_ID = "panaderiasc-1ee88";

    private static final String CREDENTIALS_PATH =
            "C:/Users/juan6/Documents/UMG/8vo.Semestre/"
            + "Desarrollo web/WebProyecto/"
            + "panaderiasc-1ee88-firebase-adminsdk-fbsvc-48ec33926a.json";

    private FirebaseConfig_PJM() {
    }

    private static Firestore firestore;

    public static synchronized Firestore getFirestore()
            throws IOException {

        if (firestore != null) return firestore;

        FirebaseApp app;

        try {
            app = FirebaseApp.getInstance(APP_NAME);

        } catch (IllegalStateException ex) {

            String ruta = System.getProperty("panaderia.firebase.credentials");
            if (ruta == null || ruta.isBlank()) ruta = System.getenv("GOOGLE_APPLICATION_CREDENTIALS");
            if (ruta == null || ruta.isBlank()) ruta = CREDENTIALS_PATH;

            try (FileInputStream archivo = new FileInputStream(ruta)) {

                FirebaseOptions opciones = FirebaseOptions.builder()
                        .setCredentials(
                                GoogleCredentials.fromStream(archivo)
                        )
                        .setProjectId(PROJECT_ID)
                        .build();

                app = FirebaseApp.initializeApp(
                        opciones,
                        APP_NAME
                );
            }
        }

        firestore = FirestoreClient.getFirestore(app);
        return firestore;
    }

    public static synchronized void close() throws Exception {
        if (firestore != null) {
            firestore.close();
            firestore = null;
        }
        try { FirebaseApp.getInstance(APP_NAME).delete(); }
        catch (IllegalStateException ignored) { }
    }
}
