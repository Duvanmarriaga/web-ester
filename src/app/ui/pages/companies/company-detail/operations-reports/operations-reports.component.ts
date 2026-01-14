import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  TrendingUp,
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-angular';
import {
  OperationReportService,
  OperationReportCreate,
  OperationReport,
} from '../../../../../infrastructure/services/operation-report.service';
import {
  OperationCategoryService,
  OperationCategory,
} from '../../../../../infrastructure/services/operation-category.service';
import { OperationReportModalComponent } from '../../../../shared/operation-report-modal/operation-report-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-operations-reports',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PaginationComponent, OperationReportModalComponent, ConfirmDialogComponent],
  templateUrl: './operations-reports.component.html',
  styleUrl: './operations-reports.component.scss',
})
export class OperationsReportsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private operationReportService = inject(OperationReportService);
  private operationCategoryService = inject(OperationCategoryService);
  private toastr = inject(ToastrService);

  readonly icons = {
    TrendingUp,
    Download,
    Upload,
    Plus,
    Pencil,
    Trash2,
  };

  companyId = signal<number | null>(null);
  userId = signal<number | null>(null);
  showModal = signal(false);
  reports = signal<OperationReport[]>([]);
  categories = signal<OperationCategory[]>([]);
  pagination = signal<PaginatedResponse<OperationReport> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  currentPage = signal(1);
  selectedReport = signal<OperationReport | null>(null);
  showConfirmDialog = signal(false);
  deletingReport = signal<OperationReport | null>(null);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadReports();
        this.loadCategories();
      }
    });

    this.store.select(selectUser).subscribe((user) => {
      if (user) {
        this.userId.set(user.id);
      }
    });
  }

  loadCategories(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.operationCategoryService.getByCompany(companyId).subscribe({
      next: (categories) => {
        this.categories.set(categories);
      },
      error: () => {
        this.toastr.error('Error al cargar las categorías', 'Error');
      },
    });
  }

  getCategoryName(categoryId: number): string {
    const category = this.categories().find((c) => c.id === categoryId);
    return category?.name || 'Sin categoría';
  }

  loadReports(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.operationReportService.getAll(page, 15, companyId).subscribe({
      next: (response: PaginatedResponse<OperationReport>) => {
        this.reports.set(response.data);
        this.pagination.set(response);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los reportes';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  onPageChange(page: number): void {
    this.loadReports(page);
  }

  downloadTemplate(): void {
    this.operationReportService.downloadTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla-reportes-operaciones.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.toastr.success('Plantilla descargada correctamente', 'Éxito');
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al descargar la plantilla';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isImporting.set(true);
    this.operationReportService.import(file).subscribe({
      next: () => {
        this.toastr.success(
          'Reportes de operaciones importados correctamente',
          'Éxito'
        );
        this.isImporting.set(false);
        input.value = '';
        this.loadReports(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al importar el archivo';
        this.toastr.error(errorMessage, 'Error');
        this.isImporting.set(false);
        input.value = '';
      },
    });
  }

  triggerFileInput(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => this.onFileSelected(e);
    input.click();
  }

  openCreateModal() {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedReport.set(null);
    this.showModal.set(true);
  }

  editReport(report: OperationReport) {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedReport.set(report);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedReport.set(null);
  }

  onSaveReport(reportData: OperationReportCreate): void {
    this.operationReportService.create(reportData).subscribe({
      next: () => {
        this.toastr.success('Reporte de operación creado correctamente', 'Éxito');
        this.closeModal();
        this.loadReports(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el reporte';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateReport(updateData: { id: number; data: OperationReportCreate }): void {
    this.operationReportService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Reporte de operación actualizado correctamente', 'Éxito');
        this.closeModal();
        this.loadReports(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el reporte';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  deleteReport(report: OperationReport): void {
    this.deletingReport.set(report);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    const report = this.deletingReport();
    if (!report || !report.id) return;

    this.operationReportService.delete(report.id).subscribe({
      next: () => {
        this.toastr.success('Reporte de operación eliminado correctamente', 'Éxito');
        this.showConfirmDialog.set(false);
        this.deletingReport.set(null);
        this.loadReports(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al eliminar el reporte';
        this.toastr.error(errorMessage, 'Error');
        this.showConfirmDialog.set(false);
        this.deletingReport.set(null);
      },
    });
  }

  onCancelDelete(): void {
    this.showConfirmDialog.set(false);
    this.deletingReport.set(null);
  }

  getDeleteMessage(): string {
    const report = this.deletingReport();
    if (!report) return '';
    
    const date = new Date(report.budget_date);
    const formattedDate = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    
    return `¿Estás seguro de que deseas eliminar el reporte de operación del ${formattedDate}? Esta acción no se puede deshacer.`;
  }
}

