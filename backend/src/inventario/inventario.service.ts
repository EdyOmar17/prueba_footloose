import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as sql from 'mssql/msnodesqlv8';
import { DatabaseService } from '../database/database.service';
import { UploadResultDto, ErrorFila } from './dto/upload-result.dto';

interface RowData {
  fila: number;
  nombre: string;
  sku: string;
  categoriaRaw: string;
  stock: number;
  color: string;
  talla: string | null;
  modelo: string;
  estado: boolean;
}

@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Procesa el archivo Excel o CSV subido, realiza validaciones,
   * gestiona la transacción con SQL Server y devuelve el reporte estadístico.
   */
  async procesarArchivo(file: Express.Multer.File): Promise<UploadResultDto> {
    const startTime = Date.now();
    if (!file || !file.buffer) {
      throw new BadRequestException('Debe proporcionar un archivo válido.');
    }

    this.logger.log(`Iniciando lectura de archivo: ${file.originalname} (${file.size} bytes)`);

    // 1. Lectura del archivo Excel/CSV con XLSX
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer', raw: false });
    } catch (err) {
      this.logger.error('Error al parsear el archivo Excel/CSV:', err);
      throw new BadRequestException('El archivo no tiene un formato Excel/CSV válido o está corrupto.');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('El archivo Excel no contiene hojas de cálculo.');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    // Convertir hoja a matriz de objetos JSON
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawRows.length === 0) {
      return {
        mensaje: 'El archivo está vacío o no contiene registros.',
        totalRegistrosLeidos: 0,
        totalRegistrosInsertados: 0,
        totalRegistrosActualizados: 0,
        erroresEncontrados: 0,
        errores: [],
        detalle: {
          insertadosPorColor: {},
          insertadosPorModelo: {},
        },
        tiempoProcesamientoMs: Date.now() - startTime,
      };
    }

    const pool = this.dbService.getPool();

    // 2. Cargar mapa de categorías para validación rápida O(1)
    const { catByName, catById } = await this.cargarMapaCategorias(pool);

    // 3. Normalizar y estructurar filas leídas
    const totalRegistrosLeidos = rawRows.length;
    let totalRegistrosInsertados = 0;
    let totalRegistrosActualizados = 0;
    const errores: ErrorFila[] = [];
    const insertadosPorColor: Record<string, number> = {};
    const insertadosPorModelo: Record<string, number> = {};

    // 4. Iniciar transacción en SQL Server para garantizar atomicidad e integridad
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Obtenemos lista actual de SKUs existentes en BD para determinar si es INSERT o UPDATE
      const skuResult = await new sql.Request(transaction).query<{ sku: string }>(
        'SELECT sku FROM producto'
      );
      const existingSkus = new Set<string>(skuResult.recordset.map((r) => r.sku.trim().toUpperCase()));

      // Preparar consultas de inserción y actualización
      const insertRequest = new sql.Request(transaction);
      const updateRequest = new sql.Request(transaction);

      for (let i = 0; i < rawRows.length; i++) {
        const rawRow = rawRows[i];
        const numeroFila = i + 2; // Fila 1 = encabezados en Excel

        const parsed = this.mapearFila(rawRow, numeroFila);

        // Validaciones de Reglas de Negocio
        if (!parsed.nombre || parsed.nombre.trim() === '') {
          errores.push({ fila: numeroFila, sku: parsed.sku, error: 'El Nombre Producto es requerido.' });
          continue;
        }

        if (!parsed.sku || parsed.sku.trim() === '') {
          errores.push({ fila: numeroFila, error: 'El SKU es requerido.' });
          continue;
        }

        if (isNaN(parsed.stock) || parsed.stock < 0) {
          errores.push({
            fila: numeroFila,
            sku: parsed.sku,
            error: `La Cantidad/Stock debe ser un número entero positivo (Valor actual: '${rawRow.stock || rawRow.Cantidad || rawRow.cantidad}').`,
          });
          continue;
        }

        if (!parsed.color || parsed.color.trim() === '') {
          errores.push({ fila: numeroFila, sku: parsed.sku, error: 'El Color es requerido.' });
          continue;
        }

        if (!parsed.modelo || parsed.modelo.trim() === '') {
          errores.push({ fila: numeroFila, sku: parsed.sku, error: 'El Modelo es requerido.' });
          continue;
        }

        // Búsqueda de Categoría por nombre o por código
        const catKeyName = parsed.categoriaRaw.trim().toUpperCase();
        const catKeyId = parsed.categoriaRaw.trim();

        let idCategoriaFinal: string | null = null;

        if (catByName.has(catKeyName)) {
          idCategoriaFinal = catByName.get(catKeyName)!;
        } else if (catById.has(catKeyId)) {
          idCategoriaFinal = catById.get(catKeyId)!;
        } else if (catById.has(catKeyId.padStart(4, '0'))) {
          idCategoriaFinal = catById.get(catKeyId.padStart(4, '0'))!;
        }

        if (!idCategoriaFinal) {
          errores.push({
            fila: numeroFila,
            sku: parsed.sku,
            error: `Categoría '${parsed.categoriaRaw}' no encontrada en la base de datos.`,
          });
          continue;
        }

        const skuUpper = parsed.sku.trim().toUpperCase();

        if (existingSkus.has(skuUpper)) {
          // ACTUALIZAR PRODUCTO (Actualiza stock y datos relacionados)
          const req = new sql.Request(transaction);
          req.input('sku', sql.VarChar(100), parsed.sku.trim());
          req.input('nombre', sql.VarChar(255), parsed.nombre.trim());
          req.input('id_categoria', sql.VarChar(50), idCategoriaFinal);
          req.input('stock', sql.Int, parsed.stock);
          req.input('color', sql.VarChar(100), parsed.color.trim());
          req.input('talla', sql.VarChar(50), parsed.talla);
          req.input('modelo', sql.VarChar(100), parsed.modelo.trim());
          req.input('estado', sql.Bit, parsed.estado ? 1 : 0);

          await req.query(`
            UPDATE producto
            SET nombre = @nombre,
                id_categoria = @id_categoria,
                stock = @stock,
                color = @color,
                talla = @talla,
                modelo = @modelo,
                estado = @estado,
                fecha_actualizacion = GETDATE()
            WHERE UPPER(sku) = UPPER(@sku)
          `);

          totalRegistrosActualizados++;
        } else {
          // INSERTAR NUEVO PRODUCTO
          const req = new sql.Request(transaction);
          req.input('sku', sql.VarChar(100), parsed.sku.trim());
          req.input('nombre', sql.VarChar(255), parsed.nombre.trim());
          req.input('id_categoria', sql.VarChar(50), idCategoriaFinal);
          req.input('stock', sql.Int, parsed.stock);
          req.input('color', sql.VarChar(100), parsed.color.trim());
          req.input('talla', sql.VarChar(50), parsed.talla);
          req.input('modelo', sql.VarChar(100), parsed.modelo.trim());
          req.input('estado', sql.Bit, parsed.estado ? 1 : 0);

          await req.query(`
            INSERT INTO producto (nombre, sku, id_categoria, stock, color, talla, modelo, estado, fecha_creacion, fecha_actualizacion)
            VALUES (@nombre, @sku, @id_categoria, @stock, @color, @talla, @modelo, @estado, GETDATE(), GETDATE())
          `);

          existingSkus.add(skuUpper);
          totalRegistrosInsertados++;

          // Conteo para detalle estadístico
          const colorKey = parsed.color.trim();
          insertadosPorColor[colorKey] = (insertadosPorColor[colorKey] || 0) + 1;

          const modeloKey = parsed.modelo.trim();
          insertadosPorModelo[modeloKey] = (insertadosPorModelo[modeloKey] || 0) + 1;
        }
      }

      // Confirmar transacción
      await transaction.commit();
      this.logger.log(
        `Carga completada: ${totalRegistrosLeidos} leídos, ${totalRegistrosInsertados} insertados, ${totalRegistrosActualizados} actualizados, ${errores.length} errores.`
      );
    } catch (err) {
      this.logger.error('Error durante la transacción en SQL Server, realizando ROLLBACK...', err);
      try {
        await transaction.rollback();
      } catch (rbErr) {
        this.logger.error('Error durante el rollback:', rbErr);
      }
      throw new BadRequestException(`Error al procesar la carga en la base de datos: ${err.message}`);
    }

    const response: UploadResultDto = {
      mensaje: 'Carga de inventario completada.',
      totalRegistrosLeidos,
      totalRegistrosInsertados,
      totalRegistrosActualizados,
      erroresEncontrados: errores.length,
      detalle: {
        insertadosPorColor,
        insertadosPorModelo,
      },
    };

    if (errores.length > 0) {
      response.errores = errores;
    }

    return response;
  }

  /**
   * Mapeo flexible e inteligente de nombres de columnas en el archivo Excel/CSV
   */
  private mapearFila(row: any, fila: number): RowData {
    const keys = Object.keys(row);

    const findVal = (possibleNames: string[]): any => {
      for (const name of possibleNames) {
        for (const key of keys) {
          const cleanKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const cleanTarget = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (cleanKey === cleanTarget) {
            return row[key];
          }
        }
      }
      return undefined;
    };

    const nombreVal = findVal(['nombre_productos', 'nombre_producto', 'nombre producto', 'nombre', 'producto', 'name', 'articulo']) ?? '';
    const skuVal = findVal(['sku', 'codigo', 'cod_producto', 'codigo_sku', 'code']) ?? '';
    const catVal = findVal(['id_categoria', 'categoria', 'categoria_nombre', 'nombre_categoria', 'category', 'linea']) ?? '';
    const stockVal = findVal(['stock', 'cantidad', 'qty', 'cant', 'existencias', 'inventory']) ?? '0';
    const colorVal = findVal(['color', 'color_producto', 'colour']) ?? '';
    const tallaVal = findVal(['talla', 'size', 'medida']) ?? null;
    const modeloVal = findVal(['modelo', 'model', 'tipo_modelo']) ?? '';
    const estadoVal = findVal(['estado', 'activo', 'status', 'is_active']) ?? '1';

    // Parsear stock
    let stockNum = 0;
    if (typeof stockVal === 'number') {
      stockNum = Math.floor(stockVal);
    } else {
      const parsedInt = parseInt(String(stockVal).trim(), 10);
      stockNum = isNaN(parsedInt) ? -1 : parsedInt;
    }

    // Parsear estado (por defecto ACTIVO / true)
    let estadoBool = true;
    if (estadoVal !== undefined && estadoVal !== null && estadoVal !== '') {
      const estadoStr = String(estadoVal).trim().toUpperCase();
      if (['0', 'FALSE', 'INACTIVO', 'NO', 'OFF'].includes(estadoStr)) {
        estadoBool = false;
      }
    }

    return {
      fila,
      nombre: String(nombreVal).trim(),
      sku: String(skuVal).trim(),
      categoriaRaw: String(catVal).trim(),
      stock: stockNum,
      color: String(colorVal).trim(),
      talla: tallaVal !== null && tallaVal !== undefined && String(tallaVal).trim() !== '' ? String(tallaVal).trim() : null,
      modelo: String(modeloVal).trim(),
      estado: estadoBool,
    };
  }

  /**
   * Carga todas las categorías de SQL Server en memoria para consultas ultra rápidas
   */
  private async cargarMapaCategorias(pool: sql.ConnectionPool) {
    const result = await pool.request().query<{ id_categoria: string; nombre_categoria: string; activo: number }>(
      'SELECT id_categoria, nombre_categoria, activo FROM categoria'
    );

    const catByName = new Map<string, string>();
    const catById = new Map<string, string>();

    for (const r of result.recordset) {
      const code = String(r.id_categoria).trim();
      const name = String(r.nombre_categoria).trim().toUpperCase();
      catByName.set(name, code);
      catById.set(code, code);
      // Soporte para IDs numéricos sin padding de ceros
      const numCode = parseInt(code, 10);
      if (!isNaN(numCode)) {
        catById.set(String(numCode), code);
      }
    }

    return { catByName, catById };
  }

  /**
   * Obtiene la lista paginada de productos para la interfaz
   */
  async getProductos(page: number = 1, limit: number = 20, search: string = '', categoriaId?: string) {
    const pool = this.dbService.getPool();
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const request = pool.request();

    if (search && search.trim() !== '') {
      request.input('search', sql.VarChar(100), `%${search.trim()}%`);
      whereClause += ' AND (p.nombre LIKE @search OR p.sku LIKE @search OR p.color LIKE @search OR p.modelo LIKE @search)';
    }

    if (categoriaId && categoriaId.trim() !== '') {
      request.input('catId', sql.VarChar(50), categoriaId.trim());
      whereClause += ' AND p.id_categoria = @catId';
    }

    const countQuery = `SELECT COUNT(*) AS total FROM producto p ${whereClause}`;
    const totalResult = await request.query<{ total: number }>(countQuery);
    const total = totalResult.recordset[0]?.total || 0;

    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const dataQuery = `
      SELECT 
        p.id_producto,
        p.nombre,
        p.sku,
        p.id_categoria,
        ISNULL(c.nombre_categoria, p.id_categoria) AS nombre_categoria,
        p.stock,
        p.color,
        p.talla,
        p.modelo,
        p.estado,
        p.fecha_creacion,
        p.fecha_actualizacion
      FROM producto p
      LEFT JOIN (
        SELECT id_categoria, MIN(nombre_categoria) AS nombre_categoria
        FROM categoria
        GROUP BY id_categoria
      ) c ON p.id_categoria = c.id_categoria
      ${whereClause}
      ORDER BY p.fecha_actualizacion DESC, p.id_producto DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const dataResult = await request.query(dataQuery);

    return {
      data: dataResult.recordset,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene resumen de métricas del inventario
   */
  async getResumen() {
    const pool = this.dbService.getPool();

    const stats = await pool.request().query(`
      SELECT 
        COUNT(*) AS totalProductos,
        ISNULL(SUM(stock), 0) AS totalStock,
        COUNT(DISTINCT id_categoria) AS totalCategoriasUsadas,
        COUNT(DISTINCT modelo) AS totalModelos,
        COUNT(DISTINCT color) AS totalColores
      FROM producto;
    `);

    const topColores = await pool.request().query(`
      SELECT TOP 5 color, COUNT(*) as cantidad, SUM(stock) as totalStock
      FROM producto
      GROUP BY color
      ORDER BY cantidad DESC;
    `);

    const topModelos = await pool.request().query(`
      SELECT TOP 5 modelo, COUNT(*) as cantidad, SUM(stock) as totalStock
      FROM producto
      GROUP BY modelo
      ORDER BY cantidad DESC;
    `);

    return {
      metricas: stats.recordset[0],
      topColores: topColores.recordset,
      topModelos: topModelos.recordset,
    };
  }

  /**
   * Obtiene la lista de categorías
   */
  async getCategorias() {
    const pool = this.dbService.getPool();
    const result = await pool.request().query('SELECT id_categoria, nombre_categoria, activo FROM categoria ORDER BY nombre_categoria ASC');
    return result.recordset;
  }

  /**
   * Limpia la tabla de productos (útil para pruebas)
   */
  async limpiarProductos() {
    const pool = this.dbService.getPool();
    await pool.request().query('TRUNCATE TABLE producto');
    return { mensaje: 'Todos los productos han sido eliminados correctamente.' };
  }
}
