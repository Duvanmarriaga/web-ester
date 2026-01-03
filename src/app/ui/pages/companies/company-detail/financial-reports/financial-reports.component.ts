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
  FinancialReport,
} from '../../../../../infrastructure/services/financial-report.service';
import { FinancialReportModalComponent } from '../../../../shared/financial-report-modal/financial-report-modal.component';
import { FinancialReportImportModalComponent, ImportedFinancialReport } from '../../../../shared/financial-report-import-modal/financial-report-import-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-financial-reports',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, FinancialReportModalComponent, FinancialReportImportModalComponent, PaginationComponent, ConfirmDialogComponent],
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
  showImportModal = signal(false);
  importedReports = signal<ImportedFinancialReport[]>([]);

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
    this.financialReportService.getAll(page, 20, companyId).subscribe({
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

    // Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      this.toastr.error('Por favor, selecciona un archivo Excel (.xls o .xlsx)', 'Error');
      input.value = '';
      return;
    }

    this.isImporting.set(true);

    // Read Excel file
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('No se pudo leer el archivo');
        }

        // Parse Excel file
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON (starting from row 4, index 3)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        
        // Process data starting from row 4 (index 3)
        const processedData: ImportedFinancialReport[] = [];
        
        for (let i = 3; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          // Column 0: Date (format: 1/01/2025)
          // Column 1: Income
          // Column 2: Expenses
          const dateValue = row[0];
          const incomeValue = row[1];
          const expensesValue = row[2];
          
          // Check if at least one field is filled
          const hasDate = dateValue !== null && dateValue !== undefined && dateValue !== '';
          const hasIncome = incomeValue !== null && incomeValue !== undefined && incomeValue !== '';
          const hasExpenses = expensesValue !== null && expensesValue !== undefined && expensesValue !== '';
          
          if (!hasDate && !hasIncome && !hasExpenses) {
            continue; // Skip empty rows
          }
          
          // Parse date - Excel stores dates as serial numbers or in format d/MM/yyyy
          let parsedDate: string | null = null;
          if (hasDate) {
            try {
              // Check if it's an Excel serial number (numeric value)
              if (typeof dateValue === 'number') {
                // Use XLSX to convert Excel serial date to JavaScript Date
                const excelDate = XLSX.SSF.parse_date_code(dateValue);
                if (excelDate) {
                  const year = excelDate.y;
                  const month = String(excelDate.m).padStart(2, '0');
                  parsedDate = `${year}-${month}`;
                } else {
                  // Fallback: manual conversion
                  const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
                  const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
                  
                  if (!isNaN(jsDate.getTime())) {
                    const year = jsDate.getFullYear();
                    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                    parsedDate = `${year}-${month}`;
                  }
                }
              } else {
                // Try to parse as string in format d/MM/yyyy or dd/MM/yyyy
                const dateStr = String(dateValue).trim();
                
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10);
                  const year = parseInt(parts[2], 10);
                  const date = new Date(year, month - 1, day);
                  if (!isNaN(date.getTime())) {
                    const monthStr = String(month).padStart(2, '0');
                    parsedDate = `${year}-${monthStr}`;
                  }
                }
              }
            } catch (e) {
              console.warn('Error parsing date:', dateValue, e);
            }
          }
          
          // Parse income
          let parsedIncome: number | null = null;
          if (hasIncome) {
            const incomeNum = typeof incomeValue === 'number' 
              ? incomeValue 
              : parseFloat(String(incomeValue).replace(/[^0-9.-]/g, ''));
            if (!isNaN(incomeNum)) {
              parsedIncome = incomeNum;
            }
          }
          
          // Parse expenses
          let parsedExpenses: number | null = null;
          if (hasExpenses) {
            const expensesNum = typeof expensesValue === 'number'
              ? expensesValue
              : parseFloat(String(expensesValue).replace(/[^0-9.-]/g, ''));
            if (!isNaN(expensesNum)) {
              parsedExpenses = expensesNum;
            }
          }
          
          processedData.push({
            report_date: parsedDate,
            income: parsedIncome,
            expenses: parsedExpenses,
            profit: (parsedIncome || 0) - (parsedExpenses || 0),
          });
        }
        
        if (processedData.length === 0) {
          this.toastr.warning(
            'No se encontraron datos válidos en el archivo. Asegúrate de que haya datos a partir de la fila 4.',
            'Advertencia'
          );
          this.isImporting.set(false);
          input.value = '';
          return;
        }
        
        // Show import modal
        this.importedReports.set(processedData);
        this.showImportModal.set(true);
        this.isImporting.set(false);
        input.value = '';
      } catch (error) {
        console.error('Error al leer el archivo Excel:', error);
        this.toastr.error(
          'Error al leer el archivo Excel. Asegúrate de que el archivo sea válido.',
          'Error'
        );
        this.isImporting.set(false);
        input.value = '';
      }
    };

    reader.onerror = () => {
      this.toastr.error('Error al leer el archivo', 'Error');
      this.isImporting.set(false);
      input.value = '';
    };

    // Read file as binary string
    reader.readAsBinaryString(file);
  }

  triggerFileInput(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
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

  onCloseImportModal(): void {
    this.showImportModal.set(false);
    this.importedReports.set([]);
  }

  onSaveImportedReports(reports: FinancialReportCreate[]): void {
    if (!reports || reports.length === 0) {
      this.toastr.error('No hay reportes para guardar', 'Error');
      return;
    }

    this.isImporting.set(true);
    this.financialReportService.createMultiple(reports).subscribe({
      next: () => {
        this.toastr.success(
          `${reports.length} reporte(s) financiero(s) importado(s) correctamente`,
          'Éxito'
        );
        this.showImportModal.set(false);
        this.importedReports.set([]);
        this.isImporting.set(false);
        this.loadReports(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al importar los reportes';
        this.toastr.error(errorMessage, 'Error');
        this.isImporting.set(false);
      },
    });
  }
}
