import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  DollarSign,
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-angular';
import {
  BudgetService,
  BudgetCreate,
  Budget,
} from '../../../../../infrastructure/services/budget.service';
import {
  BudgetYearService,
  BudgetYear,
  BudgetYearCreate,
  BudgetYearUpdate,
} from '../../../../../infrastructure/services/budget-year.service';
import { OperationBudgetModalComponent } from '../../../../shared/budget-modal/operation-budget-modal.component';
import { OperationBudgetYearModalComponent } from '../../../../shared/budget-year-modal/operation-budget-year-modal.component';
import { OperationBudgetImportModalComponent, ImportedBudget } from '../../../../shared/budget-import-modal/operation-budget-import-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import * as XLSX from 'xlsx';

interface BudgetYearWithBudgets extends BudgetYear {
  budgets: Budget[];
  isExpanded: boolean;
}

@Component({
  selector: 'app-operation-budgets',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, OperationBudgetModalComponent, OperationBudgetYearModalComponent, ConfirmDialogComponent, OperationBudgetImportModalComponent],
  templateUrl: './operation-budgets.component.html',
  styleUrl: './operation-budgets.component.scss',
})
export class OperationBudgetsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private budgetService = inject(BudgetService);
  private budgetYearService = inject(BudgetYearService);
  private toastr = inject(ToastrService);

  readonly icons = {
    DollarSign,
    Download,
    Upload,
    Plus,
    Pencil,
    Trash2,
    ChevronDown,
    ChevronUp,
  };

  companyId = signal<number | null>(null);
  userId = signal<number | null>(null);
  showModal = signal(false);
  showBudgetYearModal = signal(false);
  budgets = signal<Budget[]>([]);
  budgetYears = signal<BudgetYear[]>([]);
  budgetYearsWithBudgets = signal<BudgetYearWithBudgets[]>([]);
  budgetsWithoutYear = signal<Budget[]>([]);
  pagination = signal<PaginatedResponse<Budget> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  importingYearId = signal<number | null>(null);
  showImportModal = signal(false);
  importedBudgets = signal<ImportedBudget[]>([]);
  currentImportYearId = signal<number | null>(null);
  currentPage = signal(1);
  selectedBudget = signal<Budget | null>(null);
  selectedBudgetYear = signal<BudgetYear | null>(null);
  showConfirmDialog = signal(false);
  deletingBudget = signal<Budget | null>(null);
  deletingBudgetYear = signal<BudgetYear | null>(null);
  isDeletingBudgetYear = signal(false);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadBudgetYears();
        this.loadBudgets();
      }
    });

    this.store.select(selectUser).subscribe((user) => {
      if (user) {
        this.userId.set(user.id);
      }
    });
  }

  loadBudgetYears(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.budgetYearService.getAll(companyId).subscribe({
      next: (budgetYears) => {
        this.budgetYears.set(budgetYears);
        this.groupBudgetsByYear();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los presupuestos anuales';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  loadBudgets(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.budgetService.getAll(page, 1000, companyId).subscribe({
      next: (response: PaginatedResponse<Budget>) => {
        this.budgets.set(response.data);
        this.pagination.set(response);
        this.groupBudgetsByYear();
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los presupuestos';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  groupBudgetsByYear(): void {
    const budgets = this.budgets();
    const budgetYears = this.budgetYears();

    // Agrupar budgets por operation_budget_annual_id
    const budgetsByYear = new Map<number, Budget[]>();
    const budgetsWithoutYear: Budget[] = [];

    budgets.forEach((budget) => {
      if (budget.operation_budget_annual_id) {
        if (!budgetsByYear.has(budget.operation_budget_annual_id)) {
          budgetsByYear.set(budget.operation_budget_annual_id, []);
        }
        budgetsByYear.get(budget.operation_budget_annual_id)!.push(budget);
      } else {
        budgetsWithoutYear.push(budget);
      }
    });

    // Crear array de BudgetYearWithBudgets
    const budgetYearsWithBudgets: BudgetYearWithBudgets[] = budgetYears.map((year) => ({
      ...year,
      budgets: budgetsByYear.get(year.id) || [],
      isExpanded: false,
    }));

    this.budgetYearsWithBudgets.set(budgetYearsWithBudgets);
    this.budgetsWithoutYear.set(budgetsWithoutYear);
  }

  toggleBudgetYear(year: BudgetYearWithBudgets): void {
    const current = this.budgetYearsWithBudgets();
    const index = current.findIndex((y) => y.id === year.id);
    if (index !== -1) {
      current[index].isExpanded = !current[index].isExpanded;
      this.budgetYearsWithBudgets.set([...current]);
    }
  }

  onPageChange(page: number): void {
    this.loadBudgets(page);
  }

  downloadTemplate(budgetYearId?: number): void {
    this.budgetService.downloadTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const yearSuffix = budgetYearId ? `-${budgetYearId}` : '';
        link.href = url;
        link.download = `plantilla-presupuestos${yearSuffix}.xls`;
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

  onFileSelected(event: Event, budgetYearId?: number): void {
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

    if (!budgetYearId) {
      this.toastr.error('No se pudo determinar el año del presupuesto', 'Error');
      input.value = '';
      return;
    }

    this.isImporting.set(true);
    this.importingYearId.set(budgetYearId);

    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('No se pudo leer el archivo');
        }

        // Read Excel file
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (jsonData.length < 2) {
          this.toastr.warning(
            'El archivo no contiene datos válidos. Asegúrate de que tenga al menos una fila de datos.',
            'Advertencia'
          );
          this.isImporting.set(false);
          this.importingYearId.set(null);
          input.value = '';
          return;
        }

        // Find header row (usually first row)
        const headerRow = jsonData[0] as any[];
        const headerMap: { [key: string]: number } = {};
        
        // Map common column names
        headerRow.forEach((header, index) => {
          const headerStr = String(header || '').toLowerCase().trim();
          if (headerStr.includes('fecha') || headerStr.includes('date')) {
            headerMap['date'] = index;
          } else if (headerStr.includes('presupuesto') || headerStr.includes('budget')) {
            headerMap['budget'] = index;
          } else if (headerStr.includes('ejecutado') || headerStr.includes('executed')) {
            headerMap['executed'] = index;
          }
        });

        const hasDate = 'date' in headerMap;
        const hasBudget = 'budget' in headerMap;
        const hasExecuted = 'executed' in headerMap;

        if (!hasDate || !hasBudget || !hasExecuted) {
          this.toastr.warning(
            'El archivo no contiene las columnas requeridas: Fecha, Presupuesto, Ejecutado',
            'Advertencia'
          );
          this.isImporting.set(false);
          this.importingYearId.set(null);
          input.value = '';
          return;
        }

        // Process data rows (skip header row)
        const processedData: ImportedBudget[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const dateValue = row[headerMap['date']];
          const budgetValue = row[headerMap['budget']];
          const executedValue = row[headerMap['executed']];

          // Skip empty rows
          if (!dateValue && !budgetValue && !executedValue) continue;

          // Parse date
          let parsedDate: string | null = null;
          if (hasDate && dateValue) {
            try {
              if (typeof dateValue === 'number') {
                const excelDate = XLSX.SSF.parse_date_code(dateValue);
                if (excelDate) {
                  const year = excelDate.y;
                  const month = String(excelDate.m).padStart(2, '0');
                  parsedDate = `${year}-${month}`;
                } else {
                  const excelEpoch = new Date(1899, 11, 30);
                  const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
                  if (!isNaN(jsDate.getTime())) {
                    const year = jsDate.getFullYear();
                    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                    parsedDate = `${year}-${month}`;
                  }
                }
              } else {
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

          // Parse budget amount
          let parsedBudget: number | null = null;
          if (hasBudget && budgetValue !== null && budgetValue !== undefined) {
            const budgetNum = typeof budgetValue === 'number'
              ? budgetValue
              : parseFloat(String(budgetValue).replace(/[^0-9.-]/g, ''));
            if (!isNaN(budgetNum)) {
              parsedBudget = budgetNum;
            }
          }

          // Parse executed amount
          let parsedExecuted: number | null = null;
          if (hasExecuted && executedValue !== null && executedValue !== undefined) {
            const executedNum = typeof executedValue === 'number'
              ? executedValue
              : parseFloat(String(executedValue).replace(/[^0-9.-]/g, ''));
            if (!isNaN(executedNum)) {
              parsedExecuted = executedNum;
            }
          }

          if (parsedDate && (parsedBudget !== null || parsedExecuted !== null)) {
            const budgetAmount = parsedBudget || 0;
            const executedAmount = parsedExecuted || 0;
            const difference = budgetAmount - executedAmount;
            const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

            processedData.push({
              budget_date: parsedDate,
              budget_amount: parsedBudget,
              executed_amount: parsedExecuted,
              difference_amount: difference,
              percentage: percentage,
            });
          }
        }

        if (processedData.length === 0) {
          this.toastr.warning(
            'No se encontraron datos válidos en el archivo.',
            'Advertencia'
          );
          this.isImporting.set(false);
          this.importingYearId.set(null);
          input.value = '';
          return;
        }

        // Show import modal
        this.importedBudgets.set(processedData);
        this.currentImportYearId.set(budgetYearId);
        this.showImportModal.set(true);
        this.isImporting.set(false);
        this.importingYearId.set(null);
        input.value = '';
      } catch (error) {
        console.error('Error al leer el archivo Excel:', error);
        this.toastr.error(
          'Error al leer el archivo Excel. Asegúrate de que el archivo sea válido.',
          'Error'
        );
        this.isImporting.set(false);
        this.importingYearId.set(null);
        input.value = '';
      }
    };

    reader.onerror = () => {
      this.toastr.error('Error al leer el archivo', 'Error');
      this.isImporting.set(false);
      this.importingYearId.set(null);
      input.value = '';
    };

    // Read file as binary string
    reader.readAsBinaryString(file);
  }

  triggerFileInput(budgetYearId?: number): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = (e) => this.onFileSelected(e, budgetYearId);
    input.click();
  }

  openCreateModal(budgetYearId?: number) {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedBudget.set(null);
    if (budgetYearId) {
      // Si se pasa budgetYearId, crear un budget temporal con ese año para pre-seleccionarlo
      const tempBudget: Budget = {
        operation_budget_annual_id: budgetYearId,
        operation_budget_category_id: 0,
        company_id: this.companyId()!,
        budget_date: '',
        budget_amount: 0,
        executed_amount: 0,
        difference_amount: 0,
        percentage: 0,
        user_id: this.userId()!,
      };
      this.selectedBudget.set(tempBudget);
    }
    this.showModal.set(true);
  }

  openCreateBudgetYearModal() {
    if (!this.companyId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedBudgetYear.set(null);
    this.showBudgetYearModal.set(true);
  }

  editBudget(budget: Budget) {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedBudget.set(budget);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedBudget.set(null);
  }

  closeBudgetYearModal() {
    this.showBudgetYearModal.set(false);
    this.selectedBudgetYear.set(null);
  }

  onSaveBudget(budgetData: BudgetCreate): void {
    this.budgetService.create(budgetData).subscribe({
      next: () => {
        this.toastr.success('Presupuesto creado correctamente', 'Éxito');
        this.closeModal();
        this.loadBudgets(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el presupuesto';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateBudget(updateData: { id: number; data: BudgetCreate }): void {
    this.budgetService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Presupuesto actualizado correctamente', 'Éxito');
        this.closeModal();
        this.loadBudgets(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el presupuesto';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onSaveBudgetYear(budgetYearData: BudgetYearCreate): void {
    this.budgetYearService.create(budgetYearData).subscribe({
      next: () => {
        this.toastr.success('Presupuesto anual creado correctamente', 'Éxito');
        this.closeBudgetYearModal();
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el presupuesto anual';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateBudgetYear(updateData: { id: number; data: BudgetYearUpdate }): void {
    this.budgetYearService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Presupuesto anual actualizado correctamente', 'Éxito');
        this.closeBudgetYearModal();
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el presupuesto anual';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  editBudgetYear(budgetYear: BudgetYear): void {
    this.selectedBudgetYear.set(budgetYear);
    this.showBudgetYearModal.set(true);
  }

  deleteBudgetYear(budgetYear: BudgetYear): void {
    // Verificar si tiene budgets asociados
    const budgetYearWithBudgets = this.budgetYearsWithBudgets().find(
      (by) => by.id === budgetYear.id
    );
    
    if (budgetYearWithBudgets && budgetYearWithBudgets.budgets.length > 0) {
      this.toastr.warning(
        'No se puede eliminar un presupuesto anual que tiene presupuestos mensuales asociados',
        'Advertencia'
      );
      return;
    }

    this.deletingBudgetYear.set(budgetYear);
    this.isDeletingBudgetYear.set(true);
    this.showConfirmDialog.set(true);
  }

  onConfirmDeleteBudgetYear(): void {
    const budgetYear = this.deletingBudgetYear();
    if (!budgetYear || !budgetYear.id) return;

    // Verificar nuevamente antes de eliminar
    const budgetYearWithBudgets = this.budgetYearsWithBudgets().find(
      (by) => by.id === budgetYear.id
    );
    
    if (budgetYearWithBudgets && budgetYearWithBudgets.budgets.length > 0) {
      this.toastr.warning(
        'No se puede eliminar un presupuesto anual que tiene presupuestos mensuales asociados',
        'Advertencia'
      );
      this.showConfirmDialog.set(false);
      this.deletingBudgetYear.set(null);
      this.isDeletingBudgetYear.set(false);
      return;
    }

    // Aquí necesitaríamos un método delete en el servicio, pero no está en la API
    // Por ahora solo mostramos un mensaje
    this.toastr.info('La funcionalidad de eliminar presupuesto anual estará disponible próximamente', 'Info');
    this.showConfirmDialog.set(false);
    this.deletingBudgetYear.set(null);
    this.isDeletingBudgetYear.set(false);
  }

  deleteBudget(budget: Budget): void {
    this.deletingBudget.set(budget);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    if (this.isDeletingBudgetYear()) {
      this.onConfirmDeleteBudgetYear();
      return;
    }

    const budget = this.deletingBudget();
    if (!budget || !budget.id) return;

    this.budgetService.delete(budget.id).subscribe({
      next: () => {
        this.toastr.success('Presupuesto eliminado correctamente', 'Éxito');
        this.showConfirmDialog.set(false);
        this.deletingBudget.set(null);
        this.loadBudgets(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al eliminar el presupuesto';
        this.toastr.error(errorMessage, 'Error');
        this.showConfirmDialog.set(false);
        this.deletingBudget.set(null);
      },
    });
  }

  onCancelDelete(): void {
    this.showConfirmDialog.set(false);
    this.deletingBudget.set(null);
    this.deletingBudgetYear.set(null);
    this.isDeletingBudgetYear.set(false);
  }

  getDeleteMessage(): string {
    if (this.isDeletingBudgetYear()) {
      const budgetYear = this.deletingBudgetYear();
      if (!budgetYear) return '';
      return `¿Estás seguro de que deseas eliminar el presupuesto anual ${budgetYear.year}? Esta acción no se puede deshacer.`;
    }

    const budget = this.deletingBudget();
    if (!budget) return '';
    
    const date = new Date(budget.budget_date);
    const formattedDate = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    
    return `¿Estás seguro de que deseas eliminar el presupuesto de ${formattedDate}? Esta acción no se puede deshacer.`;
  }

  canDeleteBudgetYear(budgetYear: BudgetYear): boolean {
    const budgetYearWithBudgets = this.budgetYearsWithBudgets().find(
      (by) => by.id === budgetYear.id
    );
    return !budgetYearWithBudgets || budgetYearWithBudgets.budgets.length === 0;
  }

  onCloseImportModal(): void {
    this.showImportModal.set(false);
    this.importedBudgets.set([]);
    this.currentImportYearId.set(null);
  }

  onSaveImportedBudgets(budgets: BudgetCreate[]): void {
    if (budgets.length === 0) {
      this.toastr.error('No hay presupuestos para guardar', 'Error');
      return;
    }

    this.budgetService.createMultiple(budgets).subscribe({
      next: () => {
        this.toastr.success(
          `${budgets.length} presupuesto(s) importado(s) correctamente`,
          'Éxito'
        );
        this.onCloseImportModal();
        this.loadBudgets(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al importar los presupuestos';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }
}

