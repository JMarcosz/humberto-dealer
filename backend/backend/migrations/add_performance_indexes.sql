-- Indices de rendimiento para la DB existente -- MySQL 8.0
-- Ejecutar: mysql -u root -p concesionaria < add_performance_indexes.sql
--
-- CORRECCION: la version anterior usaba `CREATE INDEX IF NOT EXISTS`, que es
-- sintaxis de MariaDB y NO existe en MySQL 8 (el motor real de este proyecto,
-- ver docker-compose.yml: mysql:8.0). El script fallaba en su primera sentencia.
-- La idempotencia se obtiene ahora consultando information_schema.

DELIMITER $$

DROP PROCEDURE IF EXISTS _crear_indice_si_falta$$
CREATE PROCEDURE _crear_indice_si_falta(
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

-- vehiculos
CALL _crear_indice_si_falta('vehiculos', 'ix_vehiculos_estado',       '`estado`');
CALL _crear_indice_si_falta('vehiculos', 'ix_vehiculos_publicado_en', '`publicado_en`');
CALL _crear_indice_si_falta('vehiculos', 'ix_vehiculos_creado_en',    '`creado_en`');
CALL _crear_indice_si_falta('vehiculos', 'ix_vehiculos_anio',         '`anio`');
CALL _crear_indice_si_falta('vehiculos', 'ix_vehiculos_precio',       '`precio`');
CALL _crear_indice_si_falta('vehiculos', 'ix_vehiculos_kilometraje',  '`kilometraje`');
CALL _crear_indice_si_falta('vehiculos', 'ix_vehiculos_estado_pub',   '`estado`, `publicado_en`');

-- reservas (venta)
CALL _crear_indice_si_falta('reservas', 'ix_reservas_estado',    '`estado`');
CALL _crear_indice_si_falta('reservas', 'ix_reservas_creado_en', '`creado_en`');

-- ventas
CALL _crear_indice_si_falta('ventas', 'ix_ventas_fecha_hora', '`fecha_hora`');

-- resenas
CALL _crear_indice_si_falta('resenas', 'ix_resenas_vehiculo_id', '`vehiculo_id`');
CALL _crear_indice_si_falta('resenas', 'ix_resenas_creado_en',   '`creado_en`');

DROP PROCEDURE IF EXISTS _crear_indice_si_falta;
