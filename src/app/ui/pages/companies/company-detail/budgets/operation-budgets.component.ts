import { Component, OnInit, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
  MoreVertical,
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
  private http = inject(HttpClient);
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
    MoreVertical,
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
  budgetYearModalComponent = viewChild<OperationBudgetYearModalComponent>('budgetYearModal');
  isImporting = signal(false);
  importingYearId = signal<number | null>(null);
  showImportModal = signal(false);
  importedBudgets = signal<ImportedBudget[]>([]);
  currentImportYearId = signal<number | null>(null);
  importingBudgetYear = signal<BudgetYear | null>(null);
  currentPage = signal(1);
  selectedBudget = signal<Budget | null>(null);
  selectedBudgetYear = signal<BudgetYear | null>(null);
  showConfirmDialog = signal(false);
  deletingBudget = signal<Budget | null>(null);
  deletingBudgetYear = signal<BudgetYear | null>(null);
  isDeletingBudgetYear = signal(false);
  openMenuId = signal<string | null>(null);
  openMenuTop = signal(0);
  openMenuLeft = signal(0);
  budgetModalComponent = viewChild<OperationBudgetModalComponent>('budgetModal');

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

  getMenuId(prefix: 'year' | 'budget', id: number | null | undefined): string {
    return `${prefix}-${id ?? 'unknown'}`;
  }

  toggleMenu(menuId: string, event?: MouseEvent): void {
    const current = this.openMenuId();
    if (current !== menuId && event) {
      const target = event.currentTarget as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        const menuWidth = 220;
        const menuHeight = 220;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenUp = spaceBelow < menuHeight && spaceAbove > menuHeight;
        const rawTop = shouldOpenUp ? rect.top - menuHeight - 8 : rect.bottom + 4;
        const top = Math.max(8, Math.min(rawTop, window.innerHeight - menuHeight - 8));
        const rawLeft = rect.right - menuWidth;
        const left = Math.max(8, Math.min(rawLeft, window.innerWidth - menuWidth - 8));
        this.openMenuTop.set(top);
        this.openMenuLeft.set(left);
      }
    }
    this.openMenuId.set(current === menuId ? null : menuId);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
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
    // Use absolute path starting with /assets/ to ensure it works in production
    const templatePath = '/assets/templates/plantilla-presupuesto-operaciones.xlsx';
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
        const yearSuffix = budgetYearId ? `-${budgetYearId}` : '';
        link.href = url;
        link.download = `plantilla-presupuesto-operaciones${yearSuffix}.xlsx`;
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

        // Process data starting from row 4 (index 3)
        // Columns: A=0 (Fecha/Mes), B=1 (Presupuesto)
        const processedData: ImportedBudget[] = [];

        // Helper function to parse date
        const parseDate = (dateValue: any): string | null => {
          if (dateValue === null || dateValue === undefined || dateValue === '') {
            return null;
          }
          
          try {
            if (typeof dateValue === 'number') {
              const excelDate = XLSX.SSF.parse_date_code(dateValue);
              if (excelDate) {
                const year = excelDate.y;
                const month = String(excelDate.m).padStart(2, '0');
                return `${year}-${month}`;
              } else {
                const excelEpoch = new Date(1899, 11, 30);
                const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
                if (!isNaN(jsDate.getTime())) {
                  const year = jsDate.getFullYear();
                  const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                  return `${year}-${month}`;
                }
              }
            } else if (typeof dateValue === 'string') {
              const dateStr = dateValue.trim();
              // Try different formats
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                const date = new Date(year, month - 1, day);
                if (!isNaN(date.getTime())) {
                  const yearStr = String(year);
                  const monthStr = String(month).padStart(2, '0');
                  return `${yearStr}-${monthStr}`;
                }
              }
              // Try YYYY-MM format
              if (dateStr.match(/^\d{4}-\d{2}$/)) {
                return dateStr;
              }
            }
          } catch (e) {
            console.warn('Error parsing date:', dateValue, e);
          }
          
          return null;
        };

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

        // Helper function to parse month (can be number 1-12, month name, or YYYY-MM format)
        const parseMonth = (monthValue: any, year: number): string | null => {
          if (monthValue === null || monthValue === undefined || monthValue === '') {
            return null;
          }
          
          try {
            if (typeof monthValue === 'number') {
              // If it's a number between 1-12, treat as month
              if (monthValue >= 1 && monthValue <= 12) {
                const monthStr = String(monthValue).padStart(2, '0');
                return `${year}-${monthStr}`;
              }
            } else if (typeof monthValue === 'string') {
              const monthStr = monthValue.trim();
              
              // Try YYYY-MM format
              if (monthStr.match(/^\d{4}-\d{2}$/)) {
                return monthStr;
              }
              
              // Try parsing as month number
              const monthNum = parseInt(monthStr, 10);
              if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                const monthPadded = String(monthNum).padStart(2, '0');
                return `${year}-${monthPadded}`;
              }
              
              // Try month names (Spanish)
              const monthNames: { [key: string]: number } = {
                'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
                'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
                'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
              };
              const monthLower = monthStr.toLowerCase();
              if (monthNames[monthLower]) {
                const monthPadded = String(monthNames[monthLower]).padStart(2, '0');
                return `${year}-${monthPadded}`;
              }
            }
          } catch (e) {
            console.warn('Error parsing month:', monthValue, e);
          }
          
          return null;
        };

        // Get the year from the budget year
        const currentBudgetYear = this.budgetYears().find(by => by.id === budgetYearId);
        const year = currentBudgetYear?.year || new Date().getFullYear();

        for (let i = 3; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          // A (0): Categoría
          // B (1): Mes
          // C (2): Presupuesto
          // D (3): Ejecutado
          const categoryValue = row[0];
          const monthValue = row[1];
          const budgetValue = row[2];
          const executedValue = row[3];

          const hasCategory = categoryValue !== null && categoryValue !== undefined && categoryValue !== '';
          const hasMonth = monthValue !== null && monthValue !== undefined && monthValue !== '';
          const hasBudget = budgetValue !== null && budgetValue !== undefined && budgetValue !== '';
          const hasExecuted = executedValue !== null && executedValue !== undefined && executedValue !== '';
          const hasAnyData = hasCategory || hasMonth || hasBudget || hasExecuted;

          if (!hasAnyData) {
            continue;
          }

          const categoryName = hasCategory ? String(categoryValue).trim() : null;
          const parsedMonth = parseMonth(monthValue, year);
          const parsedBudget = parseNumericValue(budgetValue);
          const parsedExecuted = parseNumericValue(executedValue);
          
          // If we have any data, include the row
          if (categoryName || parsedMonth || parsedBudget !== null || parsedExecuted !== null) {
            const budgetAmount = parsedBudget || 0;
            const executedAmount = parsedExecuted || 0;
            const difference = budgetAmount - executedAmount;
            const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

            processedData.push({
              category_name: categoryName,
              month: parsedMonth,
              budget_date: parsedMonth, // Use parsed month as budget_date
              budget_amount: parsedBudget,
              executed_amount: parsedExecuted,
              difference_amount: difference,
              percentage: percentage,
            });
          }
        }

        if (processedData.length === 0) {
          this.toastr.warning(
            'No se encontraron datos válidos en el archivo. Asegúrate de que haya datos a partir de la fila 4 (columnas A4 hasta D4: Categoría, Mes, Presupuesto, Ejecutado).',
            'Advertencia'
          );
          this.isImporting.set(false);
          this.importingYearId.set(null);
          input.value = '';
          return;
        }

        // Find the budget year to get the year value
        const budgetYear = this.budgetYears().find(by => by.id === budgetYearId);
        
        // Show import modal
        this.importedBudgets.set(processedData);
        this.currentImportYearId.set(budgetYearId);
        this.importingBudgetYear.set(budgetYear || null);
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

  async onSaveBudget(budgetData: BudgetCreate): Promise<void> {
    this.budgetService.create(budgetData).subscribe({
      next: async (createdBudget) => {
        this.toastr.success('Presupuesto creado correctamente', 'Éxito');
        
        // Upload pending files for the new budget
        const modalComponent = this.budgetModalComponent();
        if (modalComponent && createdBudget.id) {
          await modalComponent.uploadFilesForNewBudget(createdBudget.id);
        }
        
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
      next: (newBudgetYear) => {
        this.toastr.success('Presupuesto anual creado correctamente', 'Éxito');
        // Upload files after successful creation
        const modal = this.budgetYearModalComponent();
        if (modal && newBudgetYear.id) {
          modal.uploadFilesForNewBudgetYear(newBudgetYear.id);
        }
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
      next: (updatedBudgetYear) => {
        this.toastr.success('Presupuesto anual actualizado correctamente', 'Éxito');
        // Upload files after successful update
        const modal = this.budgetYearModalComponent();
        if (modal && updatedBudgetYear.id) {
          modal.uploadFilesForNewBudgetYear(updatedBudgetYear.id);
        }
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
    this.importingBudgetYear.set(null);
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

