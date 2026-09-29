-- Script de Inicialización de Base de Datos para Sistema de Inventario Footloose
USE inventario_db;
GO

-- 1. Crear tabla categoria si no existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categoria')
BEGIN
    CREATE TABLE categoria (
        id_categoria VARCHAR(50) NOT NULL PRIMARY KEY,
        nombre_categoria VARCHAR(255) NOT NULL,
        activo INT DEFAULT 1
    );
    CREATE UNIQUE NONCLUSTERED INDEX IX_categoria_nombre ON categoria(nombre_categoria);
    PRINT 'Tabla categoria creada correctamente.';
END
GO

-- 2. Crear tabla producto si no existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'producto')
BEGIN
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
        fecha_actualizacion DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_producto_categoria FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
    );
    CREATE UNIQUE NONCLUSTERED INDEX IX_producto_sku ON producto(sku);
    CREATE NONCLUSTERED INDEX IX_producto_categoria ON producto(id_categoria);
    CREATE NONCLUSTERED INDEX IX_producto_color ON producto(color);
    CREATE NONCLUSTERED INDEX IX_producto_modelo ON producto(modelo);
    PRINT 'Tabla producto creada correctamente.';
END
GO
