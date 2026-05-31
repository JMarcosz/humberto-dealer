-- =============================================================
-- CONCESIONARIA DE ALTA GAMA — SCHEMA SQL
-- Motor: MySQL 8.x
-- Normalización: 3FN
-- Nomenclatura: snake_case
-- =============================================================

CREATE DATABASE IF NOT EXISTS concesionaria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE concesionaria;

-- -----------------------------------------------------------
-- GEOGRAFÍA
-- -----------------------------------------------------------
CREATE TABLE provincias (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    CONSTRAINT chk_prov_upper CHECK (nombre = UPPER(nombre))
);

CREATE TABLE municipios (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    provincia_id  INT UNSIGNED NOT NULL,
    CONSTRAINT fk_mun_prov FOREIGN KEY (provincia_id) REFERENCES provincias(id),
    CONSTRAINT chk_mun_upper CHECK (nombre = UPPER(nombre))
);

CREATE TABLE sectores (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    municipio_id  INT UNSIGNED NOT NULL,
    CONSTRAINT fk_sec_mun FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    CONSTRAINT chk_sec_upper CHECK (nombre = UPPER(nombre))
);

CREATE TABLE calles (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    sector_id     INT UNSIGNED NOT NULL,
    CONSTRAINT fk_cal_sec FOREIGN KEY (sector_id) REFERENCES sectores(id)
);

-- -----------------------------------------------------------
-- JERARQUÍA DE VEHÍCULOS
-- -----------------------------------------------------------
CREATE TABLE marcas (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(80) NOT NULL UNIQUE,
    pais_origen   VARCHAR(80),
    logo_url      VARCHAR(500),
    CONSTRAINT chk_marca_upper CHECK (nombre = UPPER(nombre))
);

CREATE TABLE modelos (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    marca_id      INT UNSIGNED NOT NULL,
    categoria     ENUM('SEDAN','SUV','COUPE','CONVERTIBLE','PICKUP','VAN','OTRO') NOT NULL DEFAULT 'OTRO',
    CONSTRAINT fk_mod_marca FOREIGN KEY (marca_id) REFERENCES marcas(id),
    CONSTRAINT uq_modelo_marca UNIQUE (nombre, marca_id),
    CONSTRAINT chk_modelo_upper CHECK (nombre = UPPER(nombre))
);

-- -----------------------------------------------------------
-- VEHÍCULOS
-- -----------------------------------------------------------
CREATE TABLE vehiculos (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    modelo_id           INT UNSIGNED NOT NULL,
    anio                YEAR NOT NULL,
    vin                 VARCHAR(17) NOT NULL UNIQUE,
    color               VARCHAR(50) NOT NULL,
    precio              DECIMAL(12,2) NOT NULL,
    kilometraje         INT UNSIGNED NOT NULL DEFAULT 0,
    combustible         ENUM('GASOLINA','DIESEL','HIBRIDO','ELECTRICO','GAS') NOT NULL,
    transmision        ENUM('AUTOMATICA','MANUAL','CVT') NOT NULL,
    descripcion         TEXT,
    estado              ENUM('DISPONIBLE','RESERVADO','VENDIDO','BORRADOR','PENDIENTE_VALIDACION') NOT NULL DEFAULT 'BORRADOR',
    importado_excel     TINYINT(1) NOT NULL DEFAULT 0,
    publicado_en        DATETIME,
    creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_veh_modelo FOREIGN KEY (modelo_id) REFERENCES modelos(id),
    CONSTRAINT chk_veh_color_upper CHECK (color = UPPER(color)),
    CONSTRAINT chk_precio_pos CHECK (precio > 0)
);

CREATE TABLE vehiculo_imagenes (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vehiculo_id   INT UNSIGNED NOT NULL,
    url           VARCHAR(500) NOT NULL,
    es_principal  TINYINT(1) NOT NULL DEFAULT 0,
    orden         TINYINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT fk_img_veh FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------
-- USUARIOS Y ROLES
-- -----------------------------------------------------------
CREATE TABLE roles (
    id     TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre ENUM('ADMIN','USUARIO_PUBLICO') NOT NULL UNIQUE
);

CREATE TABLE usuarios (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    email           VARCHAR(254) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),
    rol_id          TINYINT UNSIGNED NOT NULL DEFAULT 2,
    google_id       VARCHAR(128) UNIQUE,
    avatar_url      VARCHAR(500),
    activo          TINYINT(1) NOT NULL DEFAULT 1,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usr_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- -----------------------------------------------------------
-- CLIENTES Y EMPLEADOS
-- -----------------------------------------------------------
CREATE TABLE clientes (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id    INT UNSIGNED UNIQUE,
    nombre        VARCHAR(120) NOT NULL,
    apellido      VARCHAR(120) NOT NULL,
    cedula        VARCHAR(20) UNIQUE,
    telefono      VARCHAR(20),
    email         VARCHAR(254),
    calle_id      INT UNSIGNED,
    creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cli_usr  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_cli_cal  FOREIGN KEY (calle_id)   REFERENCES calles(id)
);

CREATE TABLE empleados (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id    INT UNSIGNED NOT NULL UNIQUE,
    nombre        VARCHAR(120) NOT NULL,
    apellido      VARCHAR(120) NOT NULL,
    cedula        VARCHAR(20) UNIQUE,
    cargo         VARCHAR(80) NOT NULL,
    telefono      VARCHAR(20),
    activo        TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_emp_usr FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- -----------------------------------------------------------
-- PROVEEDORES
-- -----------------------------------------------------------
CREATE TABLE proveedores (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    rnc           VARCHAR(20) UNIQUE,
    telefono      VARCHAR(20),
    email         VARCHAR(254),
    calle_id      INT UNSIGNED,
    CONSTRAINT fk_prov_cal FOREIGN KEY (calle_id) REFERENCES calles(id)
);

-- -----------------------------------------------------------
-- RESERVAS (CARRITO)
-- -----------------------------------------------------------
CREATE TABLE reservas (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vehiculo_id   INT UNSIGNED NOT NULL,
    cliente_id    INT UNSIGNED NOT NULL,
    estado        ENUM('EN_PROCESO','CONFIRMADA','CANCELADA') NOT NULL DEFAULT 'EN_PROCESO',
    notas         TEXT,
    creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_res_veh FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id),
    CONSTRAINT fk_res_cli FOREIGN KEY (cliente_id)  REFERENCES clientes(id)
);

-- -----------------------------------------------------------
-- CITAS
-- -----------------------------------------------------------
CREATE TABLE tipos_cita (
    id     TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE citas (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id      INT UNSIGNED NOT NULL,
    vehiculo_id     INT UNSIGNED,
    tipo_cita_id    TINYINT UNSIGNED NOT NULL,
    empleado_id     INT UNSIGNED,
    fecha_hora      DATETIME NOT NULL,
    estado          ENUM('PENDIENTE','CONFIRMADA','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    notas           TEXT,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cit_cli  FOREIGN KEY (cliente_id)   REFERENCES clientes(id),
    CONSTRAINT fk_cit_veh  FOREIGN KEY (vehiculo_id)  REFERENCES vehiculos(id),
    CONSTRAINT fk_cit_tipo FOREIGN KEY (tipo_cita_id) REFERENCES tipos_cita(id),
    CONSTRAINT fk_cit_emp  FOREIGN KEY (empleado_id)  REFERENCES empleados(id)
);

-- -----------------------------------------------------------
-- VENTAS
-- -----------------------------------------------------------
CREATE TABLE ventas (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vehiculo_id     INT UNSIGNED NOT NULL,
    cliente_id      INT UNSIGNED NOT NULL,
    empleado_id     INT UNSIGNED,
    reserva_id      INT UNSIGNED UNIQUE,
    precio_final    DECIMAL(12,2) NOT NULL,
    fecha_hora      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ubicacion_lat   DECIMAL(10,7),
    ubicacion_lng   DECIMAL(10,7),
    ubicacion_desc  VARCHAR(300),
    notas           TEXT,
    CONSTRAINT fk_ven_veh FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id),
    CONSTRAINT fk_ven_cli FOREIGN KEY (cliente_id)  REFERENCES clientes(id),
    CONSTRAINT fk_ven_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id),
    CONSTRAINT fk_ven_res FOREIGN KEY (reserva_id)  REFERENCES reservas(id)
);

-- -----------------------------------------------------------
-- PAGOS
-- -----------------------------------------------------------
CREATE TABLE pagos (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    venta_id        INT UNSIGNED NOT NULL,
    metodo          ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','FINANCIAMIENTO','OTRO') NOT NULL,
    monto           DECIMAL(12,2) NOT NULL,
    referencia      VARCHAR(100),
    fecha_hora      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pag_ven FOREIGN KEY (venta_id) REFERENCES ventas(id),
    CONSTRAINT chk_monto_pos CHECK (monto > 0)
);

-- -----------------------------------------------------------
-- RESEÑAS
-- -----------------------------------------------------------
CREATE TABLE resenas (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id      INT UNSIGNED NOT NULL,
    vehiculo_id     INT UNSIGNED,
    estrellas       TINYINT UNSIGNED NOT NULL,
    comentario      TEXT,
    google_verified TINYINT(1) NOT NULL DEFAULT 0,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_res2_usr FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_res2_veh FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id),
    CONSTRAINT chk_estrellas CHECK (estrellas BETWEEN 1 AND 5)
);

-- -----------------------------------------------------------
-- ÍNDICES ADICIONALES
-- -----------------------------------------------------------
CREATE INDEX idx_veh_estado    ON vehiculos(estado);
CREATE INDEX idx_veh_modelo    ON vehiculos(modelo_id);
CREATE INDEX idx_res_cliente   ON reservas(cliente_id);
CREATE INDEX idx_ven_vehiculo  ON ventas(vehiculo_id);
CREATE INDEX idx_ven_fecha     ON ventas(fecha_hora);
CREATE INDEX idx_usr_email     ON usuarios(email);
