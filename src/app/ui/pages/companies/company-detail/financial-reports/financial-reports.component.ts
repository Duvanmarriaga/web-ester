import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  FileText,
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-angular';
import {
  FinancialReportService,
  FinancialReportCreate,
} from '../../../../../infrastructure/services/financial-report.service';
import { FinancialReportModalComponent } from '../../../../shared/financial-report-modal/financial-report-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { FinancialReport } from '../../../../../infrastructure/services/financial-report.service';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-financial-reports',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, FinancialReportModalComponent, PaginationComponent, ConfirmDialogComponent],
  templateUrl: './financial-reports.component.html',
  styleUrl: './financial-reports.component.scss',
})
export class FinancialReportsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private financialReportService = inject(FinancialReportService);
  private toastr = inject(ToastrService);

  readonly icons = {
    FileText,
    Download,
    Upload,
    Plus,
    Pencil,
    Trash2,
  };

  companyId = signal<number | null>(null);
  userId = signal<number | null>(null);
  showModal = signal(false);
  isImporting = signal(false);
  reports = signal<FinancialReport[]>([]);
  pagination = signal<PaginatedResponse<FinancialReport> | null>(null);
  isLoading = signal(false);
  currentPage = signal(1);
  selectedReport = signal<FinancialReport | null>(null);
  showConfirmDialog = signal(false);
  deletingReport = signal<FinancialReport | null>(null);

  ngOnInit() {
    // Get company ID from route
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadReports();
      }
    });

    // Get user ID from auth store
    this.store.select(selectUser).subscribe((user) => {
      if (user) {
        this.userId.set(user.id);
      }
    });
  }

  loadReports(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.financialReportService.getAll(page, 15, companyId).subscribe({
      next: (response: PaginatedResponse<FinancialReport>) => {
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

  openCreateModal() {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedReport.set(null);
    this.showModal.set(true);
  }

  editReport(report: FinancialReport) {
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

  onSaveReport(reportData: FinancialReportCreate): void {
    this.financialReportService.create(reportData).subscribe({
      next: () => {
        this.toastr.success('Reporte financiero creado correctamente', 'Éxito');
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

  onUpdateReport(updateData: { id: number; data: FinancialReportCreate }): void {
    this.financialReportService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Reporte financiero actualizado correctamente', 'Éxito');
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

  downloadTemplate(): void {
    this.financialReportService.downloadTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla-reportes-financieros.csv';
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
    this.financialReportService.import(file).subscribe({
      next: () => {
        this.toastr.success(
          'Reportes financieros importados correctamente',
          'Éxito'
        );
        this.isImporting.set(false);
        // Reset input
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

  deleteReport(report: FinancialReport): void {
    this.deletingReport.set(report);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    const report = this.deletingReport();
    if (!report || !report.id) return;

    this.financialReportService.delete(report.id).subscribe({
      next: () => {
        this.toastr.success('Reporte financiero eliminado correctamente', 'Éxito');
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
    
    // Format date to MM/yyyy
    const date = new Date(report.report_date);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `¿Estás seguro de que deseas eliminar el reporte de ${month}/${year}? Esta acción no se puede deshacer.`;
  }
}
