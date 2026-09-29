# 👟 Desafío Técnico: Procesamiento de Inventario desde Excel (Footloose)

Sistema fullstack desarrollado en **NestJS**, **Angular** y **SQL Server** para la carga, validación, procesamiento masivo y reporte estadístico de archivos de inventario en formato Excel (`.xlsx`, `.xls`) y `.csv`.

---

## 🚀 Arquitectura y Tecnologías

- **Backend**: [NestJS](https://nestjs.com/) (TypeScript)
  - Controladores y servicios modulares (`InventarioModule`, `DatabaseModule`).
  - Procesamiento de archivos con `xlsx` (SheetJS) y `multer`.
  - Conexión a SQL Server mediante connection pool y **Transacciones Atómicas** (`msnodesqlv8` / `mssql`).
  - Mapeo inteligente y flexible de columnas (`Nombre Producto`, `SKU`, `Categoría`, `Stock`, `Color`, `Talla`, `Modelo`, `Estado`).
- **Frontend**: [Angular](https://angular.io/) (v20 Standalone Components)
  - Drag & Drop interactivo para carga de archivos.
  - Dashboard de métricas y reporte estadístico en tiempo real.
  - Desglose visual de **Insertados por Color** e **Insertados por Modelo**.
  - Visor de respuesta JSON en bruto (formato exacto solicitado).
  - Tabla interactiva con búsqueda en tiempo real, filtro por categoría y paginación.
- **Base de Datos**: [Microsoft SQL Server](https://www.microsoft.com/sql-server)
  - Base de datos: `inventario_db`.
  - Tablas: `categoria` y `producto` con índices optimizados y restricciones de clave foránea / unicidad de SKU.

---

## 📊 Reglas de Negocio Implementadas

1. **Mapeo Inteligente de Columnas**: El sistema reconoce automáticamente nombres de columnas en español, inglés o con variaciones (`nombre_productos`, `Nombre Producto`, `SKU`, `id_categoria`, `Categoría`, `stock`, `Cantidad`, `Color`, `Talla`, `Modelo`, `Activo`/`Estado`).
2. **Validación de Categorías**: 
   - Busca la categoría por **Nombre** o por **Código** en la tabla `categoria`.
   - Si no existe, registra un error detallado indicando el número exacto de fila en el archivo Excel.
3. **Control de SKU y Atomicidad**:
   - Si el `SKU` no existe en la base de datos: se inserta como un nuevo producto.
   - Si el `SKU` ya existe: se actualiza el stock y sus atributos.
   - Todo el lote se ejecuta dentro de una **Transacción SQL Server** para garantizar la integridad y atomicidad.
4. **Reporte Estadístico (JSON)**:
   Retorna exactamente la estructura solicitada:
   ```json
   {
     "mensaje": "Carga de inventario completada.",
     "totalRegistrosLeidos": 150,
     "totalRegistrosInsertados": 100,
     "totalRegistrosActualizados": 50,
     "erroresEncontrados": 0,
     "errores": [],
     "detalle": {
       "insertadosPorColor": {
         "Rojo": 40,
         "Azul": 30,
         "Verde": 30
       },
       "insertadosPorModelo": {
         "Sport-2024": 50,
         "Classic-2023": 30,
         "Urban-2024": 20
       }
     },
     "tiempoProcesamientoMs": 120
   }
   ```

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Base de Datos (SQL Server)
Ejecutar el script de inicialización en SQL Server Management Studio o vía terminal:
```bash
# Crear base de datos y tablas
sqlcmd -S . -E -C -i database/schema.sql

# Poblar categorías iniciales desde el archivo CSV
powershell -ExecutionPolicy Bypass -File database/seed_categorias.ps1
```

### 2. Backend (NestJS)
```bash
cd backend
npm install
npm run start
```
> El backend iniciará en: `http://localhost:3000`  
> Endpoint de carga: `POST http://localhost:3000/api/inventario/upload`

### 3. Frontend (Angular)
```bash
cd frontend
npm install
npm start
```
> El frontend iniciará en: `http://localhost:4200`

---

## 🧪 Pruebas Realizadas

- Carga de archivo de prueba `inventario_prueba.xlsx` con productos válidos e inválidos.
- Verificación de inserción inicial y posterior actualización de stock sobre SKUs existentes.
- Verificación del desglose por Color y Modelo en la respuesta JSON y en la interfaz.
