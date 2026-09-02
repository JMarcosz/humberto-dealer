-- ===========================================================================
-- Blindaje del modulo de Renta -- MySQL 8.0
-- ===========================================================================
-- Ejecutar:  mysql -u root -p concesionaria < 2026_01_renta_hardening.sql
--
-- IDEMPOTENTE: MySQL 8 no soporta `ADD COLUMN IF NOT EXISTS` (eso es sintaxis
-- de MariaDB), asi que la idempotencia se logra consultando information_schema
-- mediante los procedimientos auxiliares de abajo. El script puede reejecutarse
-- sin error.
--
-- `db.create_all()` NO altera tablas existentes: sobre una base ya poblada las
-- columnas nuevas solo aparecen ejecutando este archivo.
-- ===========================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS _add_column_if_missing$$
CREATE PROCEDURE _add_column_if_missing(
    IN p_tabla VARCHAR(64), IN p_columna VARCHAR(64), IN p_definicion TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_tabla
          AND COLUMN_NAME  = p_columna
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_tabla, '` ADD COLUMN `',
                          p_columna, '` ', p_definicion);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS _add_index_if_missing$$
CREATE PROCEDURE _add_index_if_missing(
    IN p_tabla VARCHAR(64), IN p_indice VARCHAR(64), IN p_columnas TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_tabla
          AND INDEX_NAME   = p_indice
    ) THEN
        SET @ddl = CONCAT('CREATE INDEX `', p_indice, '` ON `',
                          p_tabla, '` (', p_columnas, ')');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- ---------------------------------------------------------------------------
-- 1. reservas_renta -- columnas nuevas (todas con DEFAULT: no rompen filas
--    existentes)
-- ---------------------------------------------------------------------------

-- Prueba de aceptacion del contrato: antes vivia solo en el estado de React
-- y venia pre-marcada, asi que no habia constancia de nada.
CALL _add_column_if_missing('reservas_renta', 'terminos_aceptados',
     'TINYINT(1) NOT NULL DEFAULT 0');
CALL _add_column_if_missing('reservas_renta', 'terminos_aceptados_en', 'DATETIME NULL');
CALL _add_column_if_missing('reservas_renta', 'terminos_version',      'VARCHAR(20) NULL');
CALL _add_column_if_missing('reservas_renta', 'terminos_ip',           'VARCHAR(45) NULL');

-- Regla 2: snapshot de la edad a la fecha de recogida y recargo aplicado.
CALL _add_column_if_missing('reservas_renta', 'edad_conductor',
     'SMALLINT UNSIGNED NULL');
CALL _add_column_if_missing('reservas_renta', 'recargo_young_driver',
     'DECIMAL(10,2) NOT NULL DEFAULT 0.00');

-- Cancelacion y no-show: el estado CANCELADA existia sin ningun productor.
CALL _add_column_if_missing('reservas_renta', 'cancelada_en',       'DATETIME NULL');
CALL _add_column_if_missing('reservas_renta', 'cancelacion_motivo', 'VARCHAR(255) NULL');
CALL _add_column_if_missing('reservas_renta', 'cancelado_por',
     "ENUM('CLIENTE','ADMIN','SISTEMA') NULL");

-- Liquidacion de mostrador (Reglas 1 y 5 al cierre).
CALL _add_column_if_missing('reservas_renta', 'fecha_recogida_real',   'DATETIME NULL');
CALL _add_column_if_missing('reservas_renta', 'fecha_devolucion_real', 'DATETIME NULL');
CALL _add_column_if_missing('reservas_renta', 'horas_retraso',
     'DECIMAL(6,2) NOT NULL DEFAULT 0.00');
CALL _add_column_if_missing('reservas_renta', 'cargo_retraso',
     'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
CALL _add_column_if_missing('reservas_renta', 'cargo_combustible',
     'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
CALL _add_column_if_missing('reservas_renta', 'cargo_danos',
     'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
CALL _add_column_if_missing('reservas_renta', 'total_penalidades',
     'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
-- NULL = renta aun no liquidada. Un DEFAULT 0.00 haria indistinguible una
-- reserva en curso de una cerrada sin cargos.
CALL _add_column_if_missing('reservas_renta', 'total_final', 'DECIMAL(10,2) NULL');


-- ---------------------------------------------------------------------------
-- 2. Estados nuevos de la reserva (MODIFY es idempotente por naturaleza)
-- ---------------------------------------------------------------------------
ALTER TABLE reservas_renta
    MODIFY COLUMN estado
    ENUM('CONFIRMADA','EN_CURSO','COMPLETADA','CANCELADA','NO_SHOW','EXPIRADA')
    NOT NULL DEFAULT 'CONFIRMADA';


-- ---------------------------------------------------------------------------
-- 3. Estado RENTADO del vehiculo
-- ---------------------------------------------------------------------------
-- Cierra el hueco mas agudo de la reconciliacion venta<->renta: hasta ahora un
-- auto entregado a un turista seguia figurando DISPONIBLE y podia venderse.
ALTER TABLE vehiculos
    MODIFY COLUMN estado
    ENUM('DISPONIBLE','RESERVADO','RENTADO','VENDIDO','BORRADOR','PENDIENTE_VALIDACION')
    NOT NULL DEFAULT 'BORRADOR';


-- ---------------------------------------------------------------------------
-- 4. Regla 4 -- el deposito escala con el vehiculo, la cobertura lo reduce
-- ---------------------------------------------------------------------------
CALL _add_column_if_missing('coberturas_seguro', 'reduccion_deposito_pct',
     'DECIMAL(5,2) NOT NULL DEFAULT 0.00');

-- Backfill: los porcentajes se eligen para que la fianza resultante quede en el
-- mismo orden de magnitud que los absolutos actuales y ningun cliente vea un
-- salto brusco de precio.
UPDATE coberturas_seguro SET reduccion_deposito_pct =   0.00 WHERE codigo = 'TPL_BASICO';
UPDATE coberturas_seguro SET reduccion_deposito_pct =  50.00 WHERE codigo = 'CDW_ESTANDAR';
UPDATE coberturas_seguro SET reduccion_deposito_pct = 100.00 WHERE codigo IN
       ('TOTAL_PROTECTION', 'PROTECCION_TOTAL', 'TOTAL');

-- NOTA: `deposito_requerido` se CONSERVA en esta migracion. Queda huerfano pero
-- presente, de modo que revertir el despliegue sea trivial. Su DROP va en un PR
-- posterior, tras un ciclo en produccion.


-- ---------------------------------------------------------------------------
-- 5. Indices
-- ---------------------------------------------------------------------------
-- El compuesto cubre exactamente el predicado de colision de calendario
-- (vehiculo + estado + rango), que antes solo tenia indices sueltos.
CALL _add_index_if_missing('reservas_renta', 'ix_reservas_renta_veh_estado_fechas',
     '`vehiculo_id`, `estado`, `fecha_inicio`, `fecha_fin`');
-- Soportan el tope de reservas activas por conductor y la busqueda del admin.
CALL _add_index_if_missing('reservas_renta', 'ix_reservas_renta_documento',
     '`conductor_documento`');
CALL _add_index_if_missing('reservas_renta', 'ix_reservas_renta_email',
     '`conductor_email`');


-- ---------------------------------------------------------------------------
-- 6. Limpieza y verificacion
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS _add_column_if_missing;
DROP PROCEDURE IF EXISTS _add_index_if_missing;

SELECT COUNT(*) AS columnas_nuevas_en_reservas_renta
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'reservas_renta'
  AND COLUMN_NAME IN ('terminos_aceptados','terminos_aceptados_en','terminos_version',
                      'terminos_ip','edad_conductor','recargo_young_driver',
                      'cancelada_en','cancelacion_motivo','cancelado_por',
                      'fecha_recogida_real','fecha_devolucion_real','horas_retraso',
                      'cargo_retraso','cargo_combustible','cargo_danos',
                      'total_penalidades','total_final');
-- Debe devolver 17.

SELECT codigo, reduccion_deposito_pct FROM coberturas_seguro ORDER BY costo_dia;
