-- Índices de rendimiento para la DB existente
-- Ejecutar UNA vez en producción: mysql -u root -p concesionaria < add_performance_indexes.sql
-- Todos usan IF NOT EXISTS para ser idempotentes (MySQL 8+)

-- vehiculos
CREATE INDEX IF NOT EXISTS ix_vehiculos_estado        ON vehiculos (estado);
CREATE INDEX IF NOT EXISTS ix_vehiculos_publicado_en  ON vehiculos (publicado_en);
CREATE INDEX IF NOT EXISTS ix_vehiculos_creado_en     ON vehiculos (creado_en);
CREATE INDEX IF NOT EXISTS ix_vehiculos_anio          ON vehiculos (anio);
CREATE INDEX IF NOT EXISTS ix_vehiculos_precio        ON vehiculos (precio);
CREATE INDEX IF NOT EXISTS ix_vehiculos_kilometraje   ON vehiculos (kilometraje);
CREATE INDEX IF NOT EXISTS ix_vehiculos_estado_pub    ON vehiculos (estado, publicado_en);

-- reservas
CREATE INDEX IF NOT EXISTS ix_reservas_estado         ON reservas (estado);
CREATE INDEX IF NOT EXISTS ix_reservas_creado_en      ON reservas (creado_en);

-- ventas
CREATE INDEX IF NOT EXISTS ix_ventas_fecha_hora       ON ventas (fecha_hora);

-- resenas
CREATE INDEX IF NOT EXISTS ix_resenas_vehiculo_id     ON resenas (vehiculo_id);
CREATE INDEX IF NOT EXISTS ix_resenas_creado_en       ON resenas (creado_en);
