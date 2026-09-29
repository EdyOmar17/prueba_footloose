import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

export interface ErrorFila {
  fila: number;
  sku?: string;
  error: string;
}

export interface DetalleReporte {
  insertadosPorColor: Record<string, number>;
  insertadosPorModelo: Record<string, number>;
}

export interface UploadResult {
  mensaje: string;
  totalRegistrosLeidos: number;
  totalRegistrosInsertados: number;
  totalRegistrosActualizados: number;
  erroresEncontrados: number;
  errores?: ErrorFila[];
  detalle: DetalleReporte;
  tiempoProcesamientoMs?: number;
}

export interface Producto {
  id_producto: number;
  nombre: string;
  sku: string;
  id_categoria: string;
  nombre_categoria?: string;
  stock: number;
  color: string;
  talla: string | null;
  modelo: string;
  estado: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/inventario';

  selectedFile: File | null = null;
  isDragging = false;
  isUploading = false;
  uploadProgress = 0;
  uploadSuccess = false;
  errorMessage = '';

  lastReport: UploadResult | null = null;
  rawJsonView = false;

  // Productos & Filtros
  productos: Producto[] = [];
  totalProductos = 0;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  searchQuery = '';
  selectedCategoria = '';
  categorias: Array<{ id_categoria: string; nombre_categoria: string }> = [];
  isLoadingProducts = false;

  // Resumen / KPIs
  resumen: any = null;

  ngOnInit() {
    this.cargarCategorias();
    this.cargarResumen();
    this.cargarProductos();
  }

  // --- Manejo de Archivo & Drag and Drop ---
  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.validateAndSetFile(file);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.validateAndSetFile(file);
    }
  }

  validateAndSetFile(file: File) {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      this.errorMessage = 'Formato inválido. Seleccione un archivo Excel (.xlsx, .xls) o CSV (.csv).';
      this.selectedFile = null;
      return;
    }

    this.errorMessage = '';
    this.selectedFile = file;
  }

  clearSelectedFile() {
    this.selectedFile = null;
    this.errorMessage = '';
  }

  // --- Subida de Archivo ---
  subirArchivo() {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.uploadSuccess = false;
    this.errorMessage = '';
    this.lastReport = null;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<UploadResult>(`${this.apiUrl}/upload`, formData).subscribe({
      next: (res) => {
        this.isUploading = false;
        this.uploadSuccess = true;
        this.lastReport = res;
        this.cargarResumen();
        this.cargarProductos();
      },
      error: (err) => {
        this.isUploading = false;
        this.errorMessage =
          err.error?.message || 'Ocurrió un error al subir y procesar el archivo.';
      },
    });
  }

  // --- Consulta de Datos ---
  cargarProductos() {
    this.isLoadingProducts = true;
    let url = `${this.apiUrl}/productos?page=${this.currentPage}&limit=${this.pageSize}`;
    if (this.searchQuery) {
      url += `&search=${encodeURIComponent(this.searchQuery)}`;
    }
    if (this.selectedCategoria) {
      url += `&categoriaId=${encodeURIComponent(this.selectedCategoria)}`;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.productos = res.data;
        this.totalProductos = res.total;
        this.totalPages = res.totalPages;
        this.isLoadingProducts = false;
      },
      error: () => {
        this.isLoadingProducts = false;
      },
    });
  }

  cargarCategorias() {
    this.http.get<any[]>(`${this.apiUrl}/categorias`).subscribe({
      next: (res) => {
        this.categorias = res;
      },
    });
  }

  cargarResumen() {
    this.http.get<any>(`${this.apiUrl}/resumen`).subscribe({
      next: (res) => {
        this.resumen = res;
      },
    });
  }

  limpiarProductos() {
    if (confirm('¿Está seguro de que desea limpiar todos los productos de la base de datos para nuevas pruebas?')) {
      this.http.delete(`${this.apiUrl}/limpiar`).subscribe({
        next: () => {
          this.lastReport = null;
          this.cargarResumen();
          this.cargarProductos();
        },
      });
    }
  }

  onSearch() {
    this.currentPage = 1;
    this.cargarProductos();
  }

  onCategoryChange() {
    this.currentPage = 1;
    this.cargarProductos();
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPages) {
      this.currentPage = nuevaPagina;
      this.cargarProductos();
    }
  }

  getColorKeys(): string[] {
    return this.lastReport?.detalle?.insertadosPorColor
      ? Object.keys(this.lastReport.detalle.insertadosPorColor)
      : [];
  }

  getModeloKeys(): string[] {
    return this.lastReport?.detalle?.insertadosPorModelo
      ? Object.keys(this.lastReport.detalle.insertadosPorModelo)
      : [];
  }

  copyJson() {
    if (this.lastReport) {
      navigator.clipboard.writeText(JSON.stringify(this.lastReport, null, 2));
      alert('Reporte JSON copiado al portapapeles.');
    }
  }
}
