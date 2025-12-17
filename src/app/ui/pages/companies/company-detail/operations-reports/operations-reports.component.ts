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
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';

@Component({
  selector: 'app-operations-reports',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PaginationComponent],
  templateUrl: './operations-reports.component.html',
  styleUrl: './operations-reports.component.scss',
})
export class OperationsReportsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private operationReportService = inject(OperationReportService);
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
  reports = signal<OperationReport[]>([]);
  pagination = signal<PaginatedResponse<OperationReport> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  currentPage = signal(1);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadReports();
      }
    });
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
}

