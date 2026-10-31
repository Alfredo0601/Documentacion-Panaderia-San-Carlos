# PanaderiaSC: sincronización Oracle → Firebase

Esta entrega agrega sincronización a todas las operaciones que cambian las tablas
habilitadas, sin sustituir la lógica de tus managers, controllers ni modelos.
Conserva sus endpoints y contratos JSON. Oracle sigue siendo la fuente principal.
La app móvil deberá enviar sus operaciones a estos controllers; no escribir
directamente estados de negocio en Firestore. El cambio confirmado en Oracle
se replica en Firestore y los clientes pueden observarlo en tiempo real.

## Instalar sobre tu proyecto que ya funciona

1. Haz una copia de tu proyecto y una copia de seguridad de Oracle.
2. Copia la carpeta `src/main/java/BACKEND/sync` completa a tu proyecto.
3. Reemplaza `src/main/java/BACKEND/utils/FirebaseConfig_PJM.java`.
   Conserva tu ruta Windows como valor por defecto. También admite la propiedad
   Java `panaderia.firebase.credentials` o `GOOGLE_APPLICATION_CREDENTIALS`.
4. Reemplaza `src/main/webapp/WEB-INF/web.xml`: se conservaron Jersey y CORS;
   se agregó un listener. La sincronización viene desactivada hasta instalar SQL.
5. En SQL Developer, conectado al esquema de tus tablas (el mismo de config.xml),
   ejecuta con F5 `sql/01_instalar_sincronizacion.sql`.
   Requiere permisos CREATE TABLE, CREATE SEQUENCE, CREATE TRIGGER y Oracle 12.2+.
   El script crea infraestructura y triggers, NO cambia tus paquetes de negocio.
   Verifica que las nueve tablas de panadería se impriman como HABILITADA.
   Si muestra NO HABILITADA, esa tabla necesita revisar su PK real antes de continuar.
   No añade claves primarias inventadas ni intenta sincronizar tablas inexistentes.
6. Ejecuta `sql/02_carga_inicial.sql` para encolar los registros existentes.
7. En web.xml cambia el valor de `firebase.sync.enabled` de `false` a `true`.
8. Clean and Build con tu JDK 21 y vuelve a desplegar BACKEND.
9. Firestore comenzará a recibir hasta 20 eventos por lote, con una pausa de
   5 segundos entre lotes. El tiempo total depende del tamaño de la cola y la red.
10. Ejecuta `sql/03_estado.sql` para ver pendientes, errores y triggers activos.

No reemplaces tu config.xml ni tu notificador de correo al aplicar estos cuatro
archivos/carpetas: conserva tus contraseñas locales. En la copia completa de esta
entrega se retiró la contraseña Oracle y el notificador lee PANADERIA_SMTP_PASSWORD.
Ese cambio solo afecta si eliges usar la copia completa en lugar de aplicar el parche.
No se incluye el JSON privado de Firebase, ningún target ni compilado original.

## Colecciones y cobertura

| Tabla Oracle | Colección Firestore |
|---|---|
| SUCURSAL_PJM | sucursales |
| PRODUCTO_PJM | productos |
| RECETA_PJM | recetas |
| PEDIDO_PJM | pedidos |
| DETALLE_PEDIDO_PJM | detalles_pedido |
| PRODUCCION_PJM | producciones |
| DETALLE_PRODUCCION_PJM | detalles_produccion |
| INCIDENTES_RUTA_PJM | incidentes |
| AUDITORIA_PJM | auditoria |

Las tablas CLIENTE_WEB, CLIENTE_E, ORDEN_E, PRODUCTO, FACTURA y DETALLE_FACTURA
se habilitan si existen y tienen PK compatible. Se detectan además dependencias
directas de tablas del mismo esquema para los once paquetes usados por los managers.
Esas colecciones se nombran `plantilla_` + nombre de tabla en minúsculas.
El registro FB_SYNC_TABLES_PJM es la lista definitiva de cobertura instalada.
No se sincronizan credenciales ni tablas cuyo nombre indique usuarios o secretos.
Los reportes no se duplican: siguen calculándose desde las tablas Oracle.
Los módulos de correo, conversión y catálogos no crean un documento por invocación:
solo se replican sus datos persistidos en tablas habilitadas.

Con ID_PEDIDO=55, el documento será `pedidos/55`. Las columnas se conservan en
MAYÚSCULAS como en Oracle. Las claves compuestas usan hash SHA-256 estable.
Los números se envían como enteros o decimales; enteros fuera de int64 se conservan
como texto para no perder precisión. Oracle DATE/TIMESTAMP se envía en texto ISO
local sin inventar zona horaria. No se cambia tu regla actual de fechas.

Los campos `_syncOrigen`, `_syncTabla`, `_syncEvento`, `_syncVersion`, `_syncFecha`
y `_syncEliminado` son metadatos. Filtra `_syncEliminado == false` en la app.
Una anulación lógica conserva ESTADO=0. Una baja física elimina los campos de
negocio y deja una marca `_syncEliminado=true` para proteger contra envíos tardíos.
Las colecciones son propiedad del sincronizador: una escritura reemplaza todos
los campos; la app no debe agregar datos propios dentro de esos documentos.

## Reintentos y consistencia

El trigger inserta la clave del registro en la cola dentro de la misma transacción
Oracle. Si se hace ROLLBACK, también se revierte el evento. No hay llamada de red
desde los triggers ni desde los managers. Si Firebase falla, Oracle sigue operando
y el evento permanece con su error y reintento (5 s hasta 5 min).

Un bloqueo Oracle limita el envío a una instancia a la vez. Firestore se actualiza
por ID estable y versión monotónica en una transacción para que un envío atrasado
no sobrescriba uno posterior. El evento solo se borra tras la confirmación remota.
Se relee el estado actual del registro: se sincroniza el estado final, no cada
estado intermedio. No es una transacción distribuida ni sincronización instantánea.

Si se borra la base Oracle o se reinicia su secuencia de versión, se necesita
reconciliar las colecciones/versiones antes de reactivar. No uses TRUNCATE sobre
tablas sincronizadas: los triggers son por fila. Para bajas físicas usa DELETE.

Columnas con contraseñas, tokens y secretos se excluyen. Un tipo binario, un CLOB
demasiado grande o un documento sobre el límite Firestore queda pendiente con error;
no se trunca información para aparentar éxito. Revisa 03_estado.sql periódicamente.

## Verificar en tu equipo

1. Antes de desplegar, puedes ejecutar Run File sobre
   `BACKEND.sync.FirebaseSyncPrueba_PJM`: procesa un lote y cierra la conexión.
2. Comprueba un producto y su STOCK en Oracle y `productos/{ID_PRODUCTO}`.
3. Crea/toma/entrega/cancela un pedido por tus endpoints actuales; verifica
   ESTADO en `pedidos/{ID_PEDIDO}` y los detalles/stock relacionados.
4. Reporta un incidente; verifica `incidentes`, `pedidos`, `productos` y `auditoria`.
   Se conserva tu regla existente de cancelar/devolver stock; reasignación es otro cambio.
5. Detén internet, modifica un producto y verifica que quede en la cola.
   Reconecta: debe enviarse sin crear un segundo documento.
6. Prueba el rollback con el backend detenido usando `sql/04_prueba_rollback.sql`.
7. Repite la carga inicial: no deben aparecer IDs duplicados.

## Validación realizada y límites

Se compilaron las clases nuevas y FirebaseConfig con el compilador disponible
(Java 17, sintaxis compatible con Java 21) y los JAR reales del ZIP. Para los APIs
provided del servlet y la conexión Oracle se usaron stubs de compilación; no es
un build Maven completo ni una prueba del servidor. Se ejecutaron pruebas locales
de IDs, PK compuestas, precisión numérica, fechas y exclusión de secretos.
Oracle y Firestore no fueron accesibles: los scripts y el flujo completo deben
validarse en tu entorno. Los paquetes PL/SQL y DDL originales no venían en el ZIP.

Esta entrega no crea todavía la app Android, Firebase Authentication ni alertas
FCM. Las reglas incluidas mantienen bloqueado el acceso cliente hasta definir
roles; el backend accede mediante su cuenta de servicio. La autenticación y
autorización de los endpoints existentes debe integrarse antes de publicar la app.
