import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
  effect,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { LucideAngularModule, X, Trash2 } from 'lucide-angular';
import { BudgetService, BudgetCreate } from '../../../infrastructure/services/budget.service';
import { BudgetCategoryService, BudgetCategory } from '../../../infrastructure/services/budget-category.service';
import { ToastrService } from 'ngx-toastr';
import { NgSelectModule } from '@ng-select/ng-select';

export interface ImportedBudget {
  budget_date: string | null;
  budget_amount: number | null;
  executed_amount: number | null;
  difference_amount: number | null;
  percentage: number | null;
}

@Component({
  selector: 'app-operation-budget-import-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgSelectModule],
  templateUrl: './operation-budget-import-modal.component.html',
  styleUrl: './operation-budget-import-modal.component.scss',
})
export class OperationBudgetImportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private budgetService = inject(BudgetService);
  private budgetCategoryService = inject(BudgetCategoryService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  budgetYearId = input.required<number>();
  importedData = input.required<ImportedBudget[]>();

  // Outputs
  close = output<void>();
  save = output<BudgetCreate[]>();

  budgetForm!: FormGroup;
  readonly icons = { X, Trash2 };
  isSubmitting = signal(false);
  dateErrors = signal<Map<number, string>>(new Map());
  categories = signal<BudgetCategory[]>([]);
  isLoadingCategories = signal(false);

  get budgetsArray(): FormArray {
    return this.budgetForm.get('budgets') as FormArray;
  }

  constructor() {
    // Watch for importedData changes
    effect(() => {
      const data = this.importedData();
      if (data && data.length > 0) {
        this.initializeForm(data);
      }
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.initializeForm(this.importedData());
  }

  loadCategories(): void {
    this.isLoadingCategories.set(true);
    this.budgetCategoryService.getByCompany(this.companyId()).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.isLoadingCategories.set(false);
      },
      error: (error: unknown) => {
        console.error('Error loading categories:', error);
        this.isLoadingCategories.set(false);
      },
    });
  }

  initializeForm(data: ImportedBudget[]) {
    const budgetGroups = data.map((budget) => {
      // Calculate difference and percentage
      const budgetAmount = budget.budget_amount || 0;
      const executedAmount = budget.executed_amount || 0;
      const difference = budgetAmount - executedAmount;
      const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

      // Format date to YYYY-MM format for month input
      let dateValue = '';
      if (budget.budget_date) {
        const dateStr = budget.budget_date;
        if (dateStr.match(/^\d{4}-\d{2}$/)) {
          dateValue = dateStr;
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateValue = dateStr.substring(0, 7);
        } else {
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              dateValue = `${year}-${month}`;
            }
          } catch (e) {
            console.warn('Error parsing date:', dateStr);
          }
        }
      }

      return this.fb.group({
        budget_date: [dateValue, Validators.required],
        budget_amount: [budgetAmount, [Validators.required, Validators.min(0)]],
        executed_amount: [executedAmount, [Validators.required, Validators.min(0)]],
        difference_amount: [{ value: difference, disabled: true }],
        percentage: [{ value: percentage.toFixed(2), disabled: true }],
      });
    });

    this.budgetForm = this.fb.group({
      default_category_id: [null, Validators.required],
      budgets: this.fb.array(budgetGroups),
    });

    // Watch for changes to recalculate difference and percentage
    this.budgetsArray.controls.forEach((control, index) => {
      control.get('budget_amount')?.valueChanges.subscribe(() => {
        this.recalculateRow(index);
      });
      control.get('executed_amount')?.valueChanges.subscribe(() => {
        this.recalculateRow(index);
      });
    });
  }

  recalculateRow(index: number) {
    const control = this.budgetsArray.at(index);
    const budgetAmount = parseFloat(control.get('budget_amount')?.value || '0');
    const executedAmount = parseFloat(control.get('executed_amount')?.value || '0');
    const difference = budgetAmount - executedAmount;
    const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

    control.patchValue(
      {
        difference_amount: difference,
        percentage: percentage.toFixed(2),
      },
      { emitEvent: false }
    );
  }

  formatCurrency(event: Event, index: number, field: 'budget_amount' | 'executed_amount') {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');
    const control = this.budgetsArray.at(index).get(field);
    if (control) {
      control.setValue(value, { emitEvent: false });
      this.recalculateRow(index);
    }
  }

  formatCurrencyOnBlur(index: number, field: 'budget_amount' | 'executed_amount') {
    const control = this.budgetsArray.at(index).get(field);
    if (control) {
      const value = parseFloat(control.value || '0');
      if (!isNaN(value)) {
        control.setValue(value.toFixed(2), { emitEvent: false });
        this.recalculateRow(index);
      }
    }
  }

  removeBudget(index: number) {
    this.budgetsArray.removeAt(index);
    this.cdr.detectChanges();
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      if (!this.isSubmitting()) {
        this.onClose();
      }
    }
  }

  onClose() {
    this.close.emit();
  }

  getTotalBudget(): number {
    let total = 0;
    this.budgetsArray.controls.forEach((control) => {
      const budgetAmount = parseFloat(control.get('budget_amount')?.value || '0');
      total += budgetAmount;
    });
    return total;
  }

  getTotalExecuted(): number {
    let total = 0;
    this.budgetsArray.controls.forEach((control) => {
      const executedAmount = parseFloat(control.get('executed_amount')?.value || '0');
      total += executedAmount;
    });
    return total;
  }

  onSubmit() {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      this.toastr.error('Por favor, completa todos los campos requeridos', 'Error');
      return;
    }

    if (this.budgetsArray.length === 0) {
      this.toastr.error('Debe haber al menos un presupuesto para guardar', 'Error');
      return;
    }

    this.isSubmitting.set(true);

    const budgets: BudgetCreate[] = [];

    this.budgetsArray.controls.forEach((control) => {
      if (control.invalid) {
        return; // Skip invalid rows
      }

      const budgetData = control.value;

      // Convert date from YYYY-MM (month input) to YYYY-MM-01 format for backend
      let budgetDate = '';
      if (budgetData.budget_date) {
        if (typeof budgetData.budget_date === 'string' && budgetData.budget_date.match(/^\d{4}-\d{2}$/)) {
          budgetDate = `${budgetData.budget_date}-01`;
        } else if (typeof budgetData.budget_date === 'string' && budgetData.budget_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          budgetDate = budgetData.budget_date;
        } else {
          const date = new Date(budgetData.budget_date);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            budgetDate = `${year}-${month}-01`;
          }
        }
      }

      // Parse currency values
      const budgetAmountValue = budgetData.budget_amount?.toString().replace(/[^0-9.]/g, '') || '0';
      const executedAmountValue = budgetData.executed_amount?.toString().replace(/[^0-9.]/g, '') || '0';
      const budgetAmount = parseFloat(budgetAmountValue) || 0;
      const executedAmount = parseFloat(executedAmountValue) || 0;
      const differenceAmount = budgetAmount - executedAmount;
      const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

      if (!budgetDate) {
        return; // Skip if no valid date
      }

      const defaultCategoryId = this.budgetForm.get('default_category_id')?.value;
      if (!defaultCategoryId) {
        this.toastr.error('Debe seleccionar una categoría por defecto', 'Error');
        this.isSubmitting.set(false);
        return;
      }

      budgets.push({
        operation_budget_category_id: defaultCategoryId,
        company_id: this.companyId(),
        operation_budget_annual_id: this.budgetYearId() || null,
        budget_date: budgetDate,
        budget_amount: budgetAmount,
        executed_amount: executedAmount,
        difference_amount: differenceAmount,
        percentage: percentage,
      });
    });

    if (budgets.length === 0) {
      this.toastr.error('No hay presupuestos válidos para guardar', 'Error');
      this.isSubmitting.set(false);
      return;
    }

    this.save.emit(budgets);
  }
}

