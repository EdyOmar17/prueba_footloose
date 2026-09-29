export interface DetalleReporte {
  insertadosPorColor: Record<string, number>;
  insertadosPorModelo: Record<string, number>;
}

export interface ErrorFila {
  fila: number;
  sku?: string;
  error: string;
}

export interface UploadResultDto {
  mensaje: string;
  totalRegistrosLeidos: number;
  totalRegistrosInsertados: number;
  totalRegistrosActualizados: number;
  erroresEncontrados: number;
  errores?: ErrorFila[];
  detalle: DetalleReporte;
  tiempoProcesamientoMs?: number;
}
