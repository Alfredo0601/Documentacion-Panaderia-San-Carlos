-- Prueba manual opcional. Pausar backend para que no drene la cola durante la prueba.
-- No confirma cambios de inventario. Requiere al menos un producto existente.
SET SERVEROUTPUT ON;
DECLARE
  v_id PRODUCTO_PJM.ID_PRODUCTO%TYPE;
  v_stock PRODUCTO_PJM.STOCK%TYPE;
  v_after PRODUCTO_PJM.STOCK%TYPE;
  v_before NUMBER;
  v_during NUMBER;
  v_final NUMBER;
BEGIN
  SELECT ID_PRODUCTO,STOCK INTO v_id,v_stock FROM PRODUCTO_PJM WHERE ROWNUM=1;
  SELECT COUNT(*) INTO v_before FROM FB_SYNC_OUTBOX_PJM;
  SAVEPOINT prueba_fb;
  UPDATE PRODUCTO_PJM SET STOCK=STOCK WHERE ID_PRODUCTO=v_id;
  SELECT COUNT(*) INTO v_during FROM FB_SYNC_OUTBOX_PJM;
  ROLLBACK TO prueba_fb;
  SELECT COUNT(*) INTO v_final FROM FB_SYNC_OUTBOX_PJM;
  SELECT STOCK INTO v_after FROM PRODUCTO_PJM WHERE ID_PRODUCTO=v_id;
  IF v_during<=v_before OR v_final<>v_before OR NVL(v_stock,-1)<>NVL(v_after,-1) THEN
    RAISE_APPLICATION_ERROR(-20002,'Prueba fallida: revisar trigger y transacción.');
  END IF;
  DBMS_OUTPUT.PUT_LINE('OK: cambio encolado y revertido junto con Oracle. Stock preservado.');
END;
/
