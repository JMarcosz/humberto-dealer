-- =============================================================
-- FIX-ISSUES.SQL — Parche para BD ya cargada
-- =============================================================
-- Corrige dos problemas:
--   1. URLs de imágenes apuntaban a archivos inexistentes
--   2. Password hashes eran placeholders (no se podía hacer login)
--
-- Ejecutar UNA SOLA VEZ después del primer seed.sql:
--   Get-Content database\fix-issues.sql | mysql -u root -p
-- =============================================================

USE concesionaria;

-- -----------------------------------------------------------
-- 1. ARREGLAR IMÁGENES
-- -----------------------------------------------------------
-- Los URLs anteriores apuntaban a /static/img/vehiculos/... que no existen.
-- Los reemplazamos por las imágenes reales en frontend/public/imagen-X.png
-- (servidas por Next.js en http://localhost:3000/imagen-X.png)

DELETE FROM vehiculo_imagenes;

INSERT INTO vehiculo_imagenes (vehiculo_id, url, es_principal, orden) VALUES
    -- Vehículo 1: BMW M3 Competition (3 fotos)
    (1, '/imagen-2.png', 1, 0),
    (1, '/imagen-3.png', 0, 1),
    (1, '/imagen-4.png', 0, 2),
    -- Vehículo 2: BMW X5 xDrive40i (2 fotos)
    (2, '/imagen-5.png', 1, 0),
    (2, '/imagen-6.png', 0, 1),
    -- Vehículo 3: Mercedes C63 AMG (2 fotos)
    (3, '/imagen-7.png', 1, 0),
    (3, '/imagen-8.png', 0, 1),
    -- Vehículo 4: Porsche 911 Carrera 4S (2 fotos)
    (4, '/imagen-2.png', 1, 0),
    (4, '/imagen-5.png', 0, 1),
    -- Vehículo 5: Ferrari F8 Tributo (2 fotos)
    (5, '/imagen-4.png', 1, 0),
    (5, '/imagen-7.png', 0, 1),
    -- Vehículo 6: Lamborghini Huracán EVO (3 fotos)
    (6, '/imagen-3.png', 1, 0),
    (6, '/imagen-6.png', 0, 1),
    (6, '/imagen-8.png', 0, 2);

-- -----------------------------------------------------------
-- 2. ARREGLAR PASSWORD HASHES (para que el login funcione)
-- -----------------------------------------------------------
-- Hashes bcrypt reales generados con flask_bcrypt.
--   admin@concesionaria.com  →  password: admin123
--   maria@email.com          →  password: user1234
--   carlos@email.com         →  password: user1234

UPDATE usuarios
SET password_hash = '$2b$12$jy5IxcMH/U8xwBCfKJGa2OVU3iHmIEryUYY1TcuKM.Q0xS9kr4YG2'
WHERE email = 'admin@concesionaria.com';

UPDATE usuarios
SET password_hash = '$2b$12$EVugtg3m2eO1IiR/Pr/rEeG7XH5yfsME9y8tW//EkRstElejTcMDW'
WHERE email IN ('maria@email.com', 'carlos@email.com');

-- -----------------------------------------------------------
-- 3. VERIFICACIÓN
-- -----------------------------------------------------------
SELECT 'Imágenes cargadas:' AS info, COUNT(*) AS total FROM vehiculo_imagenes;
SELECT 'Usuarios con hash real:' AS info, COUNT(*) AS total
FROM usuarios
WHERE password_hash LIKE '$2b$%' AND password_hash NOT LIKE '%PLACEHOLDER%';
