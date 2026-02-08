import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  FileText,
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
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
  private http = inject(HttpClient);
  private financialReportService = inject(FinancialReportService);
  private toastr = inject(ToastrService);

  readonly icons = {
    FileText,
    Download,
    Upload,
    Plus,
    Pencil,
    Trash2,
    MoreVertical,
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
  openMenuId = signal<number | null>(null);
  openMenuOnLeft = signal(false);
  openMenuAbove = signal(false);
  reportModalComponent = viewChild<FinancialReportModalComponent>('reportModal');

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

  toggleMenu(reportId: number | null | undefined, event?: MouseEvent): void {
    if (!reportId) return;
    const current = this.openMenuId();
    if (current !== reportId && event) {
      const target = event.currentTarget as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        const menuWidth = 160;
        const menuHeight = 120;
        const gap = 4;
        const spaceRight = window.innerWidth - rect.right;
        const spaceBelow = window.innerHeight - rect.bottom;
        this.openMenuOnLeft.set(spaceRight < menuWidth + gap);
        this.openMenuAbove.set(spaceBelow < menuHeight + gap);
      }
    }
    this.openMenuId.set(current === reportId ? null : reportId);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
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
    // Use absolute path starting with /assets/ to ensure it works in production
    const templatePath = '/assets/templates/plantilla-reportes-financieros.xlsx';
    this.http.get(templatePath, {
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob || blob.size === 0) {
          this.toastr.error('El archivo descargado está vacío o es inválido', 'Error');
          return;
        }

        // Create a new blob with the correct MIME type for Excel files
        // This ensures Excel can open the file even if the server returns wrong content-type
        const excelBlob = new Blob([blob], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = window.URL.createObjectURL(excelBlob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = 'plantilla-reportes-financieros.xlsx';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.toastr.success('Plantilla descargada correctamente', 'Éxito');
      },
      error: (error: unknown) => {
        console.error('Error downloading template:', error);
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
        // Columns: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13
        const processedData: ImportedFinancialReport[] = [];
        
        // Helper function to parse numeric values
        const parseNumericValue = (value: any): number | null => {
          if (value === null || value === undefined || value === '') {
            return null;
          }
          const num = typeof value === 'number' 
            ? value 
            : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          return !isNaN(num) ? num : null;
        };
        
        // Helper function to parse date
        const parseDate = (dateValue: any): string | null => {
          if (dateValue === null || dateValue === undefined || dateValue === '') {
            return null;
          }
          
          try {
            // Check if it's an Excel serial number (numeric value)
            if (typeof dateValue === 'number') {
              // Use XLSX to convert Excel serial date to JavaScript Date
              const excelDate = XLSX.SSF.parse_date_code(dateValue);
              if (excelDate) {
                const year = excelDate.y;
                const month = String(excelDate.m).padStart(2, '0');
                const day = String(excelDate.d).padStart(2, '0');
                return `${year}-${month}-${day}`;
              } else {
                // Fallback: manual conversion
                const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
                const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
                
                if (!isNaN(jsDate.getTime())) {
                  const year = jsDate.getFullYear();
                  const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                  const day = String(jsDate.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                }
              }
            } else if (typeof dateValue === 'string') {
              // Try to parse as string in format d/MM/yyyy or dd/MM/yyyy
              const dateStr = dateValue.trim();
              
              // Try different date formats
              const formats = [
                /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // d/M/yyyy or dd/MM/yyyy
                /^(\d{4})-(\d{2})-(\d{2})$/, // yyyy-MM-dd
                /^(\d{2})-(\d{2})-(\d{4})$/, // MM-dd-yyyy
              ];
              
              for (const format of formats) {
                const match = dateStr.match(format);
                if (match) {
                  let day: number, month: number, year: number;
                  
                  if (format === formats[0]) {
                    // d/M/yyyy format
                    day = parseInt(match[1], 10);
                    month = parseInt(match[2], 10);
                    year = parseInt(match[3], 10);
                  } else if (format === formats[1]) {
                    // yyyy-MM-dd format
                    year = parseInt(match[1], 10);
                    month = parseInt(match[2], 10);
                    day = parseInt(match[3], 10);
                  } else {
                    // MM-dd-yyyy format
                    month = parseInt(match[1], 10);
                    day = parseInt(match[2], 10);
                    year = parseInt(match[3], 10);
                  }
                  
                  const date = new Date(year, month - 1, day);
                  if (!isNaN(date.getTime())) {
                    const yearStr = String(year);
                    const monthStr = String(month).padStart(2, '0');
                    const dayStr = String(day).padStart(2, '0');
                    return `${yearStr}-${monthStr}-${dayStr}`;
                  }
                }
              }
            } else if (dateValue instanceof Date) {
              // Already a Date object
              const year = dateValue.getFullYear();
              const month = String(dateValue.getMonth() + 1).padStart(2, '0');
              const day = String(dateValue.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
          } catch (e) {
            console.warn('Error parsing date:', dateValue, e);
          }
          
          return null;
        };
        
        // Process each row starting from index 3 (row 4 in Excel)
        for (let i = 2; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          // Skip completely empty rows
          if (!row || row.length === 0 || row.every((cell: any) => cell === null || cell === undefined || cell === '')) {
            continue;
          }
          
          // A (0): Fecha reporte
          // B (1): Corriente Activo (current_asset)
          // C (2): Corriente pasivo (current_passive)
          // D (3): Inventarios (inventories)
          // E (4): Total pasivo (total_passive)
          // F (5): Total activos (total_assets)
          // G (6): Utilidad neta (net_profit)
          // H (7): Ingresos totales (total_revenue)
          // I (8): Resultado valor actual (current_value_result)
          // J (9): Valor inicial del año (initial_value_of_the_year)
          // K (10): Valor presupuestado (budgeted_value)
          // L (11): Valor ejecutado (executed_value)
          // M (12): Saldo actual de caja (current_cash_balance)
          // N (13): Consumo promedio de la caja en los ultimos 3 meses (average_consumption_of_boxes_over_the_last_3_months)
          
          const dateValue = row[0];
          const parsedDate = parseDate(dateValue);
          
          // If no date could be parsed, try to use a default date or skip
          // But first check if there's any other data in the row
          const hasOtherData = row.slice(1).some((cell: any) => 
            cell !== null && cell !== undefined && cell !== ''
          );
          
          // If we have data but no date, we still want to include it (date can be edited in modal)
          // Use a placeholder date that can be edited
          const finalDate = parsedDate || (hasOtherData ? '1900-01-01' : null);
          
          // Only skip if row is completely empty
          if (!finalDate && !hasOtherData) {
            continue;
          }
          
          // Extract all values
          const currentAssetValue = row[1];
          const currentPassiveValue = row[2];
          const inventoriesValue = row[3];
          const totalPassiveValue = row[4];
          const totalAssetsValue = row[5];
          const netProfitValue = row[6];
          const totalRevenueValue = row[7];
          const currentValueResultValue = row[8];
          const initialValueOfTheYearValue = row[9];
          const budgetedValueValue = row[10];
          const executedValueValue = row[11];
          const currentCashBalanceValue = row[12];
          const averageConsumptionValue = row[13];
          
          // Add the row to processed data
          processedData.push({
            report_date: finalDate,
            current_asset: parseNumericValue(currentAssetValue),
            current_passive: parseNumericValue(currentPassiveValue),
            inventories: parseNumericValue(inventoriesValue),
            total_passive: parseNumericValue(totalPassiveValue),
            total_assets: parseNumericValue(totalAssetsValue),
            net_profit: parseNumericValue(netProfitValue),
            total_revenue: parseNumericValue(totalRevenueValue),
            current_value_result: parseNumericValue(currentValueResultValue),
            initial_value_of_the_year: parseNumericValue(initialValueOfTheYearValue),
            budgeted_value: parseNumericValue(budgetedValueValue),
            executed_value: parseNumericValue(executedValueValue),
            current_cash_balance: parseNumericValue(currentCashBalanceValue),
            average_consumption_of_boxes_over_the_last_3_months: parseNumericValue(averageConsumptionValue),
          });
        }
        
        if (processedData.length === 0) {
          this.toastr.warning(
            'No se encontraron datos válidos en el archivo. Asegúrate de que haya datos a partir de la fila 4 (columnas A4 hasta N4).',
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
