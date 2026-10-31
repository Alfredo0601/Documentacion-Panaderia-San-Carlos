-- Ejecutar una vez DESPUÉS de 01. Encola datos existentes, incluso anulados.
-- Puede repetirse: los IDs estables evitan documentos duplicados (consume escrituras).
SET SERVEROUTPUT ON;
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK;
DECLARE
  v_expr VARCHAR2(16000);
  v_column VARCHAR2(128);
  v_pos NUMBER;
  v_count NUMBER;
BEGIN
  FOR t IN (SELECT TABLA,PK_COLUMNAS FROM FB_SYNC_TABLES_PJM WHERE ACTIVA=1 ORDER BY TABLA) LOOP
    v_expr:=NULL; v_pos:=1;
    LOOP
      v_column:=REGEXP_SUBSTR(t.PK_COLUMNAS,'[^,]+',1,v_pos);
      EXIT WHEN v_column IS NULL;
      IF v_expr IS NOT NULL THEN v_expr:=v_expr||','; END IF;
      v_expr:=v_expr||''''||v_column||''' VALUE '||DBMS_ASSERT.SIMPLE_SQL_NAME(v_column);
      v_pos:=v_pos+1;
    END LOOP;
    EXECUTE IMMEDIATE 'INSERT INTO FB_SYNC_OUTBOX_PJM(TABLA,PK_JSON) SELECT '''||t.TABLA||
      ''', JSON_OBJECT('||v_expr||' RETURNING VARCHAR2(4000)) FROM '||DBMS_ASSERT.SIMPLE_SQL_NAME(t.TABLA);
    v_count:=SQL%ROWCOUNT;
    DBMS_OUTPUT.PUT_LINE(t.TABLA||': '||v_count||' filas encoladas');
  END LOOP;
  COMMIT;
END;
/
