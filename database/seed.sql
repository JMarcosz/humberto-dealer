-- =============================================================
-- SEED — Datos de prueba
-- =============================================================
USE concesionaria;

-- Roles
INSERT INTO roles (nombre) VALUES ('ADMIN'), ('USUARIO_PUBLICO');

-- Geografía
INSERT INTO provincias (nombre) VALUES ('DISTRITO NACIONAL'), ('SANTIAGO'), ('LA ROMANA');
INSERT INTO municipios (nombre, provincia_id) VALUES
    ('SANTO DOMINGO DE GUZMAN', 1),
    ('SANTIAGO DE LOS CABALLEROS', 2),
    ('LA ROMANA', 3);
INSERT INTO sectores (nombre, municipio_id) VALUES
    ('PIANTINI', 1), ('NACO', 1), ('LOS JARDINES DEL NORTE', 2);
INSERT INTO calles (nombre, sector_id) VALUES
    ('Calle Fantino Falco', 1),
    ('Avenida Abraham Lincoln', 2),
    ('Calle del Sol', 3);

-- Marcas
INSERT INTO marcas (nombre, pais_origen) VALUES
    ('BMW', 'ALEMANIA'),
    ('MERCEDES-BENZ', 'ALEMANIA'),
    ('PORSCHE', 'ALEMANIA'),
    ('FERRARI', 'ITALIA'),
    ('LAMBORGHINI', 'ITALIA');

-- Modelos
INSERT INTO modelos (nombre, marca_id, categoria) VALUES
    ('M3 COMPETITION', 1, 'SEDAN'),
    ('X5 XDRIVE40I', 1, 'SUV'),
    ('C63 AMG', 2, 'SEDAN'),
    ('GLE 53 AMG', 2, 'SUV'),
    ('CAYENNE GTS', 3, 'SUV'),
    ('911 CARRERA 4S', 3, 'COUPE'),
    ('F8 TRIBUTO', 4, 'COUPE'),
    ('HURACAN EVO', 5, 'COUPE');

-- Vehículos
INSERT INTO vehiculos (modelo_id, anio, vin, color, precio, kilometraje, combustible, transmision, descripcion, estado, publicado_en) VALUES
    (1, 2023, 'WBS8M9C50PA123401', 'NEGRO', 85000.00, 1200, 'GASOLINA', 'AUTOMATICA', 'BMW M3 Competition con paquete carbono, 510 HP.', 'DISPONIBLE', NOW()),
    (2, 2024, 'WBA7R0C02PGJ12345', 'BLANCO ALPINO', 72000.00, 500,  'GASOLINA', 'AUTOMATICA', 'BMW X5 xDrive40i, techo panorámico, sistema HiFi Harman.', 'DISPONIBLE', NOW()),
    (3, 2022, 'WDD2050471A123456', 'GRIS SELENITA', 95000.00, 8000, 'GASOLINA', 'AUTOMATICA', 'Mercedes C63 AMG Biturbo V8 507 HP.', 'DISPONIBLE', NOW()),
    (6, 2023, 'WP0AB2A96PS123001', 'PLATA', 145000.00, 200,  'GASOLINA', 'AUTOMATICA', 'Porsche 911 Carrera 4S, PDK, paquete Sport Chrono.', 'DISPONIBLE', NOW()),
    (7, 2021, 'ZFF89GLA3M0260001', 'ROJO ROSSO CORSA', 285000.00, 3100, 'GASOLINA', 'AUTOMATICA', 'Ferrari F8 Tributo 710 HP, escape Inconel.', 'DISPONIBLE', NOW()),
    (8, 2022, 'ZHWUC1ZF2NLA12345', 'AMARILLO GIALLO', 240000.00, 1500, 'GASOLINA', 'AUTOMATICA', 'Lamborghini Huracán EVO RWD, ANIMA drive selector.', 'RESERVADO', NOW()),
    (4, 2023, 'WDD2950461A789012', 'NEGRO OBSIDIANA', 105000.00, 0,   'GASOLINA', 'AUTOMATICA', 'Mercedes GLE 53 AMG 4MATIC+, sin rodar.', 'BORRADOR', NULL),
    (5, 2024, 'WP1AE2AY5PDA00001', 'AZUL SAPPHIRE', 130000.00, 0,   'GASOLINA', 'AUTOMATICA', 'Porsche Cayenne GTS, paquete Sport Design.', 'PENDIENTE_VALIDACION', NULL);

-- Imágenes (representativas)
INSERT INTO vehiculo_imagenes (vehiculo_id, url, es_principal, orden) VALUES
    (1, 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&q=80', 1, 0),
    (1, 'https://images.unsplash.com/photo-1617654112368-307921291f42?w=1200&q=80', 0, 1),
    (2, 'https://images.unsplash.com/photo-1520050206274-a1ae44613e6d?w=1200&q=80', 1, 0),
    (4, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80', 1, 0),
    (5, 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=1200&q=80', 1, 0);

-- Imágenes adicionales
INSERT INTO vehiculo_imagenes (vehiculo_id, url, es_principal, orden) VALUES
    (3, 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&q=80', 1, 0),
    (6, 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=80', 1, 0);

-- Usuarios
-- Contraseñas en texto plano SOLO para seed/docs. En app se hashean con bcrypt.
-- admin123  →  se hashea al crear; aquí placeholder
INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES
    ('Rafael Admin',   'admin@concesionaria.com',  '$2b$12$PLACEHOLDER_ADMIN_HASH',  1),
    ('María González', 'maria@email.com',           '$2b$12$PLACEHOLDER_USER_HASH',   2),
    ('Carlos Pérez',   'carlos@email.com',          '$2b$12$PLACEHOLDER_USER_HASH2',  2);

-- Clientes
INSERT INTO clientes (usuario_id, nombre, apellido, cedula, telefono, email, calle_id) VALUES
    (2, 'MARÍA',   'GONZÁLEZ', '001-1234567-8', '809-555-0001', 'maria@email.com',  1),
    (3, 'CARLOS',  'PÉREZ',    '001-7654321-9', '809-555-0002', 'carlos@email.com', 2);

-- Empleados
INSERT INTO empleados (usuario_id, nombre, apellido, cedula, cargo) VALUES
    (1, 'RAFAEL', 'ADMIN', '001-0000000-1', 'GERENTE GENERAL');

-- Tipos de cita
INSERT INTO tipos_cita (nombre) VALUES
    ('PRUEBA DE MANEJO'), ('VALORACION'), ('ENTREGA'), ('MANTENIMIENTO');

-- Reserva
INSERT INTO reservas (vehiculo_id, cliente_id, estado, notas) VALUES
    (6, 1, 'CONFIRMADA', 'Cliente interesado en financiamiento');

-- Venta de prueba
INSERT INTO ventas (vehiculo_id, cliente_id, empleado_id, precio_final, ubicacion_lat, ubicacion_lng, ubicacion_desc) VALUES
    (3, 2, 1, 95000.00, 18.4861, -69.9312, 'Sucursal Piantini, Santo Domingo');

-- Pagos
INSERT INTO pagos (venta_id, metodo, monto, referencia) VALUES
    (1, 'TRANSFERENCIA', 95000.00, 'TRF-2024-00001');

-- Reseñas
INSERT INTO resenas (usuario_id, estrellas, comentario, google_verified) VALUES
    (2, 5, 'Servicio impecable. El mejor dealer del país.', 1),
    (3, 4, 'Excelente atención, proceso de compra muy transparente.', 1);

-- Proveedores
INSERT INTO proveedores (nombre, rnc, telefono, email) VALUES
    ('AUTO IMPORT RD SRL',    '130-12345-6', '809-555-1000', 'ventas@autoimportrd.com'),
    ('PREMIUM MOTORS CARIBE', '130-98765-4', '809-555-2000', 'info@premiummc.com');
