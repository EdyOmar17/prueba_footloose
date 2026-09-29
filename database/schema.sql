-- Script de Creación y Carga Inicial de Categorías
USE inventario_db;
GO

-- Recrear tablas para estructura óptima
IF OBJECT_ID('producto', 'U') IS NOT NULL DROP TABLE producto;
IF OBJECT_ID('categoria', 'U') IS NOT NULL DROP TABLE categoria;
GO

CREATE TABLE categoria (
    id INT IDENTITY(1,1) PRIMARY KEY,
    id_categoria VARCHAR(50) NOT NULL,
    nombre_categoria VARCHAR(255) NOT NULL,
    activo INT DEFAULT 1
);
CREATE NONCLUSTERED INDEX IX_categoria_code ON categoria(id_categoria);
CREATE NONCLUSTERED INDEX IX_categoria_nombre ON categoria(nombre_categoria);
GO

CREATE TABLE producto (
    id_producto INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    id_categoria VARCHAR(50) NOT NULL,
    stock INT NOT NULL,
    color VARCHAR(100) NOT NULL,
    talla VARCHAR(50) NULL,
    modelo VARCHAR(100) NOT NULL,
    estado BIT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT GETDATE(),
    fecha_actualizacion DATETIME DEFAULT GETDATE()
);
CREATE UNIQUE NONCLUSTERED INDEX IX_producto_sku ON producto(sku);
CREATE NONCLUSTERED INDEX IX_producto_categoria ON producto(id_categoria);
CREATE NONCLUSTERED INDEX IX_producto_color ON producto(color);
CREATE NONCLUSTERED INDEX IX_producto_modelo ON producto(modelo);
GO
