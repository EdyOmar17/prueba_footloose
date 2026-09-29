import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InventarioService } from './inventario.service';
import { UploadResultDto } from './dto/upload-result.dto';

@Controller('api/inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  /**
   * Endpoint principal para la subida y procesamiento del archivo Excel/CSV
   * POST /api/inventario/upload
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // Soporte hasta 50MB
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<UploadResultDto> {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo Excel (.xlsx, .xls) o .csv en el campo "file".');
    }
    return this.inventarioService.procesarArchivo(file);
  }

  /**
   * Endpoint para consultar productos cargados con paginación y filtros
   * GET /api/inventario/productos
   */
  @Get('productos')
  async getProductos(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search: string = '',
    @Query('categoriaId') categoriaId?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    return this.inventarioService.getProductos(pageNum, limitNum, search, categoriaId);
  }

  /**
   * Endpoint para obtener métricas generales del inventario
   * GET /api/inventario/resumen
   */
  @Get('resumen')
  async getResumen() {
    return this.inventarioService.getResumen();
  }

  /**
   * Endpoint para listar todas las categorías disponibles
   * GET /api/inventario/categorias
   */
  @Get('categorias')
  async getCategorias() {
    return this.inventarioService.getCategorias();
  }

  /**
   * Endpoint para reiniciar la tabla de productos (útil para pruebas)
   * DELETE /api/inventario/limpiar
   */
  @Delete('limpiar')
  async limpiar() {
    return this.inventarioService.limpiarProductos();
  }
}
