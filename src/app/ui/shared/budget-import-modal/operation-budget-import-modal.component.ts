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
import { firstValueFrom } from 'rxjs';

export interface ImportedBudget {
  category_name: string | null;
  month: string | null;
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
  budgetYear = input.required<number>();
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
      const categories = this.categories();
      if (data && data.length > 0 && categories.length > 0) {
        this.initializeForm(data);
      }
    });
  }

  ngOnInit() {
    this.loadCategories();
    // Wait for categories to load before initializing form
    this.budgetCategoryService.getByCompany(this.companyId()).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.isLoadingCategories.set(false);
        // Initialize form after categories are loaded
        const data = this.importedData();
        if (data && data.length > 0) {
          this.initializeForm(data);
        }
      },
      error: (error: unknown) => {
        console.error('Error loading categories:', error);
        this.isLoadingCategories.set(false);
      },
    });
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

  // Fuzzy matching: normalize strings (lowercase, remove spaces)
  normalizeString(str: string): string {
    return str.toLowerCase().replace(/\s+/g, '').trim();
  }

  // Find similar category by name (case-insensitive, space-insensitive)
  findSimilarCategory(categoryName: string | null): BudgetCategory | null {
    if (!categoryName) return null;
    
    const normalizedSearch = this.normalizeString(categoryName);
    const allCategories = this.categories();
    
    // First try exact match (normalized)
    const exactMatch = allCategories.find(cat => 
      this.normalizeString(cat.name) === normalizedSearch
    );
    if (exactMatch) return exactMatch;
    
    // Then try contains match (normalized)
    const containsMatch = allCategories.find(cat => 
      this.normalizeString(cat.name).includes(normalizedSearch) ||
      normalizedSearch.includes(this.normalizeString(cat.name))
    );
    if (containsMatch) return containsMatch;
    
    return null;
  }

  // Create category if it doesn't exist
  async createCategoryIfNeeded(categoryName: string): Promise<BudgetCategory | null> {
    if (!categoryName || !categoryName.trim()) return null;
    
    // Check if it already exists (fuzzy match)
    const existing = this.findSimilarCategory(categoryName);
    if (existing) return existing;
    
    // Create new category
    try {
      const newCategory = await firstValueFrom(
        this.budgetCategoryService.create({
          name: categoryName.trim(),
          code: categoryName.trim().toUpperCase().substring(0, 10).replace(/\s+/g, '_'),
          company_id: this.companyId(),
        })
      );
      
      if (newCategory) {
        // Add to local list
        this.categories.set([...this.categories(), newCategory]);
        return newCategory;
      }
    } catch (error) {
      console.error('Error creating category:', error);
    }
    
    return null;
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

      // Format budget amount and executed amount with commas
      const formatAmount = (amount: number): string => {
        if (amount === null || amount === undefined || isNaN(amount)) return '';
        if (amount % 1 === 0) {
          return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
        const parts = amount.toFixed(2).split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1];
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return `${formattedInteger}.${decimalPart}`;
      };

      // Try to find similar category
      const categoryName = budget.category_name || '';
      const similarCategory = this.findSimilarCategory(categoryName);
      const selectedCategory = similarCategory || null;

      return this.fb.group({
        category_id: [selectedCategory?.id || null, Validators.required],
        category_name_text: [categoryName, Validators.required], // Keep original text for reference
        budget_date: [dateValue, Validators.required],
        budget_amount: [formatAmount(budgetAmount), [Validators.required, this.currencyValidator]],
        executed_amount: [formatAmount(executedAmount), [Validators.required, this.currencyValidator]],
        difference_amount: [{ value: formatAmount(difference), disabled: true }],
        percentage: [{ value: percentage.toFixed(2), disabled: true }],
      });
    });

    this.budgetForm = this.fb.group({
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

  currencyValidator(control: any) {
    if (!control.value) return null;
    const value = parseFloat(control.value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(value) || value < 0) {
      return { invalidCurrency: true };
    }
    return null;
  }

  formatNumberWithCommas(value: number | string): string {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    
    if (isNaN(numValue) || numValue === null || numValue === undefined) return '';
    
    if (numValue % 1 === 0) {
      return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    const parts = numValue.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return `${formattedInteger}.${decimalPart}`;
  }

  recalculateRow(index: number) {
    const control = this.budgetsArray.at(index);
    const budgetAmountStr = control.get('budget_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
    const executedAmountStr = control.get('executed_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
    const budgetAmount = parseFloat(budgetAmountStr);
    const executedAmount = parseFloat(executedAmountStr);
    const difference = budgetAmount - executedAmount;
    const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

    control.patchValue(
      {
        difference_amount: this.formatNumberWithCommas(difference),
        percentage: percentage.toFixed(2),
      },
      { emitEvent: false }
    );
  }

  formatCurrency(event: Event, index: number, field: 'budget_amount' | 'executed_amount') {
    const investmentGroup = this.budgetsArray.at(index) as FormGroup;
    if (!investmentGroup) return;
    
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');
    
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    const numValue = parseFloat(value) || 0;
    const formatted = this.formatNumberWithCommas(numValue);
    
    input.value = formatted;
    investmentGroup.patchValue({ [field]: formatted }, { emitEvent: true });
    this.recalculateRow(index);
    this.cdr.detectChanges();
  }

  formatCurrencyOnBlur(index: number, field: 'budget_amount' | 'executed_amount') {
    const investmentGroup = this.budgetsArray.at(index) as FormGroup;
    if (!investmentGroup) return;
    
    const control = investmentGroup.get(field);
    if (!control) return;
    
    let value = control.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const numValue = parseFloat(value) || 0;
    const formatted = this.formatNumberWithCommas(numValue);
    control.setValue(formatted, { emitEvent: true });
    this.recalculateRow(index);
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
      const budgetAmountStr = control.get('budget_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
      const budgetAmount = parseFloat(budgetAmountStr);
      total += budgetAmount;
    });
    return total;
  }

  getTotalExecuted(): number {
    let total = 0;
    this.budgetsArray.controls.forEach((control) => {
      const executedAmountStr = control.get('executed_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
      const executedAmount = parseFloat(executedAmountStr);
      total += executedAmount;
    });
    return total;
  }

  // Check if all required fields are filled
  areAllFieldsValid(): boolean {
    if (this.budgetsArray.length === 0) {
      return false;
    }

    return this.budgetsArray.controls.every((control) => {
      const categoryId = control.get('category_id')?.value;
      const budgetDate = control.get('budget_date')?.value;
      const budgetAmountStr = control.get('budget_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '';
      const executedAmountStr = control.get('executed_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '';

      const budgetAmount = parseFloat(budgetAmountStr);
      const executedAmount = parseFloat(executedAmountStr);

      return (
        categoryId !== null &&
        categoryId !== undefined &&
        budgetDate &&
        budgetDate.trim() !== '' &&
        !isNaN(budgetAmount) &&
        budgetAmount > 0 &&
        !isNaN(executedAmount) &&
        executedAmount >= 0
      );
    });
  }

  async onSubmit() {
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

    for (const control of this.budgetsArray.controls) {
      if (control.invalid) {
        continue; // Skip invalid rows
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
        continue; // Skip if no valid date
      }

      // Get category ID - use selected category_id or create from category_name_text
      let categoryId: number | null = null;
      
      if (budgetData.category_id) {
        // Category was selected from dropdown
        categoryId = budgetData.category_id;
      } else if (budgetData.category_name_text) {
        // Category was not selected, try to find similar or create
        const categoryName = budgetData.category_name_text.trim();
        if (categoryName) {
          // Try to find similar category first
          const similarCategory = this.findSimilarCategory(categoryName);
          if (similarCategory) {
            categoryId = similarCategory.id;
          } else {
            // Create new category
            const newCategory = await this.createCategoryIfNeeded(categoryName);
            if (newCategory) {
              categoryId = newCategory.id;
            } else {
              this.toastr.error(`No se pudo crear la categoría "${categoryName}"`, 'Error');
              this.isSubmitting.set(false);
              return;
            }
          }
        }
      }

      if (!categoryId) {
        continue; // Skip if no category
      }

      budgets.push({
        operation_budget_category_id: categoryId,
        company_id: this.companyId(),
        operation_budget_annual_id: this.budgetYearId() || null,
        budget_date: budgetDate,
        budget_amount: budgetAmount,
        executed_amount: executedAmount,
        difference_amount: differenceAmount,
        percentage: percentage,
      });
    }

    if (budgets.length === 0) {
      this.toastr.error('No hay presupuestos válidos para guardar', 'Error');
      this.isSubmitting.set(false);
      return;
    }

    this.save.emit(budgets);
  }
}

