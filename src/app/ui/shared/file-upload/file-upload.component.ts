import { Component, input, output, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, FileText, File, X, Upload, Download } from 'lucide-angular';
import { FileService, ReportFile } from '../../../infrastructure/services/file.service';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';

interface PendingFile {
  file: File;
  id: string; // temporary ID for tracking
}

@Component({
  selector: 'app-file-upload',
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent {
  // Inputs
  tableName = input.required<string>();
  recordId = input<number | null>(null);
  disabled = input<boolean>(false);

  // Outputs
  filesChanged = output<{ existingFiles: ReportFile[], pendingFiles: File[] }>();

  // Services
  private fileService = inject(FileService);
  private toastr = inject(ToastrService);

  // State
  existingFiles = signal<ReportFile[]>([]);
  pendingFiles = signal<PendingFile[]>([]);
  isLoading = signal(false);
  isUploading = signal(false);

  // Icons
  readonly icons = {
    FileText,
    File,
    X,
    Upload,
    Download
  };

  // Allowed file types
  private readonly allowedExtensions = ['xlsx', 'pdf', 'csv'];
  private readonly allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'text/csv'
  ];

  constructor() {
    // Load existing files when recordId changes
    effect(() => {
      const id = this.recordId();
      if (id) {
        this.loadExistingFiles(id);
      }
    });
  }

  async loadExistingFiles(recordId: number) {
    this.isLoading.set(true);
    try {
      const files = await firstValueFrom(
        this.fileService.getAll(this.tableName(), recordId)
      );
      this.existingFiles.set(files);
      this.emitFilesChanged();
    } catch (error) {
      console.error('Error loading files:', error);
      this.toastr.error('Error al cargar los archivos', 'Error');
    } finally {
      this.isLoading.set(false);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const validFiles: File[] = [];

    for (const file of files) {
      if (this.isValidFile(file)) {
        validFiles.push(file);
      } else {
        this.toastr.warning(
          `El archivo ${file.name} no es válido. Solo se permiten archivos XLSX, PDF y CSV.`,
          'Archivo no válido'
        );
      }
    }

    if (validFiles.length > 0) {
      const newPendingFiles = validFiles.map(file => ({
        file,
        id: this.generateTempId()
      }));

      this.pendingFiles.update(current => [...current, ...newPendingFiles]);
      this.emitFilesChanged();
    }

    // Reset input
    input.value = '';
  }

  private isValidFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return (
      extension !== undefined &&
      this.allowedExtensions.includes(extension) &&
      this.allowedMimeTypes.includes(file.type)
    );
  }

  private generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async removePendingFile(tempId: string) {
    this.pendingFiles.update(files => files.filter(f => f.id !== tempId));
    this.emitFilesChanged();
  }

  async removeExistingFile(fileId: number) {
    if (!confirm('¿Está seguro de que desea eliminar este archivo?')) {
      return;
    }

    this.isLoading.set(true);
    try {
      await firstValueFrom(
        this.fileService.delete(this.tableName(), fileId)
      );
      this.existingFiles.update(files => files.filter(f => f.id !== fileId));
      this.toastr.success('Archivo eliminado correctamente', 'Éxito');
      this.emitFilesChanged();
    } catch (error) {
      console.error('Error deleting file:', error);
      this.toastr.error('Error al eliminar el archivo', 'Error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async downloadFile(fileId: number, fileName: string) {
    this.isLoading.set(true);
    try {
      const blob = await firstValueFrom(
        this.fileService.download(this.tableName(), fileId)
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      this.toastr.success('Archivo descargado correctamente', 'Éxito');
    } catch (error) {
      console.error('Error downloading file:', error);
      this.toastr.error('Error al descargar el archivo', 'Error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async uploadPendingFiles(recordId: number): Promise<boolean> {
    const pending = this.pendingFiles();
    if (pending.length === 0) return true;

    this.isUploading.set(true);
    try {
      for (const pendingFile of pending) {
        await firstValueFrom(
          this.fileService.upload(this.tableName(), recordId, pendingFile.file)
        );
      }
      
      this.pendingFiles.set([]);
      await this.loadExistingFiles(recordId);
      this.toastr.success('Archivos cargados correctamente', 'Éxito');
      return true;
    } catch (error) {
      console.error('Error uploading files:', error);
      this.toastr.error('Error al cargar los archivos', 'Error');
      return false;
    } finally {
      this.isUploading.set(false);
    }
  }

  getFileIcon(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return this.icons.File;
      case 'xlsx':
        return this.icons.File;
      case 'csv':
        return this.icons.FileText;
      default:
        return this.icons.FileText;
    }
  }

  getFileIconColor(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '#dc3545'; // red
      case 'xlsx':
        return '#28a745'; // green
      case 'csv':
        return '#007bff'; // blue
      default:
        return '#6c757d'; // gray
    }
  }

  private emitFilesChanged() {
    this.filesChanged.emit({
      existingFiles: this.existingFiles(),
      pendingFiles: this.pendingFiles().map(pf => pf.file)
    });
  }

  // Public method to get pending files (for parent component to upload after creation)
  getPendingFiles(): File[] {
    return this.pendingFiles().map(pf => pf.file);
  }

  // Public method to clear pending files
  clearPendingFiles() {
    this.pendingFiles.set([]);
    this.emitFilesChanged();
  }
}
