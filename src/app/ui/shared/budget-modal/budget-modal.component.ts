import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  BudgetService,
  BudgetCreate,
  Budget,
} from '../../../infrastructure/services/budget.service';
import { BudgetCategoryService, BudgetCategory } from '../../../infrastructure/services/budget-category.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { Observable, of } from 'rxjs';
import { map, catchError, debounceTime, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-budget-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './budget-modal.component.html',
  styleUrl: './budget-modal.component.scss',
})
export class BudgetModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private budgetService = inject(BudgetService);
  private budgetCategoryService = inject(BudgetCategoryService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  budget = input<Budget | null>(null);

  // Outputs
  close = output<void>();
  save = output<BudgetCreate>();
  update = output<{ id: number; data: BudgetCreate }>();

  budgetForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  dateExistsError = signal<string | null>(null);
  isEditMode = signal(false);
  categories = signal<BudgetCategory[]>([]);
  
  // Computed signal to ensure it's always an array
  categoriesList = computed(() => {
    const cats = this.categories();
    return Array.isArray(cats) ? cats : [];
  });

  constructor() {
    effect(() => {
      const currentBudget = this.budget();
      const isVisible = this.isVisible();

      if (isVisible && currentBudget) {
        this.isEditMode.set(true);
        setTimeout(() => {
          if (this.budgetForm) {
            this.populateForm(currentBudget);
          }
        }, 0);
      } else if (isVisible && !currentBudget) {
        this.isEditMode.set(false);
        setTimeout(() => {
          if (this.budgetForm) {
            this.budgetForm.reset({
              budget_category_id: '',
              budget_date: '',
              budget_amount: '0',
              executed_amount: '0',
              difference_amount: 0,
              percentage: 0,
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    if (!Array.isArray(this.categories())) {
      this.categories.set([]);
    }
    
    this.loadCategories();
    
    this.budgetForm = this.fb.group({
      budget_category_id: ['', [Validators.required]],
      budget_date: [
        '',
        [Validators.required],
        [this.dateExistsValidator.bind(this)],
      ],
      budget_amount: ['0', [Validators.required, this.currencyValidator]],
      executed_amount: ['0', [Validators.required, this.currencyValidator]],
      difference_amount: [{ value: 0, disabled: true }],
      percentage: [{ value: 0, disabled: true }],
    });

    // Calculate difference and percentage when amounts change
    this.budgetForm.get('budget_amount')?.valueChanges.subscribe(() => {
      this.calculateDifferenceAndPercentage();
    });

    this.budgetForm.get('executed_amount')?.valueChanges.subscribe(() => {
      this.calculateDifferenceAndPercentage();
    });

    // Watch for date validation errors
    this.budgetForm.get('budget_date')?.statusChanges.subscribe(() => {
      const control = this.budgetForm.get('budget_date');
      if (control?.hasError('dateExists')) {
        this.dateExistsError.set('Ya existe un presupuesto para esta fecha');
      } else {
        this.dateExistsError.set(null);
      }
    });

    if (this.budget() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.budget()!);
    }
  }

  loadCategories(): void {
    const companyId = this.companyId();
    if (!companyId) {
      this.categories.set([]);
      return;
    }
    
    this.budgetCategoryService.getByCompany(companyId).subscribe({
      next: (categories) => {
        this.categories.set(Array.isArray(categories) ? categories : []);
      },
      error: () => {
        this.categories.set([]);
      },
    });
  }

  dateExistsValidator(control: AbstractControl): Observable<ValidationErrors | null> {
    if (!control.value) {
      return of(null);
    }

    const dateValue = control.value;
    const budgetDate = `${dateValue}-01`;

    return of(null).pipe(
      debounceTime(500),
      switchMap(() => {
        const excludeId = this.isEditMode() && this.budget()?.id ? this.budget()!.id : undefined;
        return this.budgetService.checkDateExists(
          this.companyId(),
          budgetDate,
          excludeId
        ).pipe(
          map((exists) => {
            if (exists) {
              return { dateExists: true };
            }
            return null;
          }),
          catchError(() => of(null))
        );
      })
    );
  }

  currencyValidator(control: any) {
    if (!control.value) return null;
    const value = parseFloat(control.value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(value) || value < 0) {
      return { invalidCurrency: true };
    }
    return null;
  }

  formatCurrency(event: Event, fieldName: 'budget_amount' | 'executed_amount'): void {
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

    this.budgetForm.patchValue(
      { [fieldName]: formatted },
      { emitEvent: false }
    );
  }

  formatCurrencyOnBlur(fieldName: 'budget_amount' | 'executed_amount'): void {
    const control = this.budgetForm.get(fieldName);
    if (!control) return;

    let value = control.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const numValue = parseFloat(value) || 0;

    const formatted = this.formatNumberWithCommas(numValue);
    control.setValue(formatted, { emitEvent: true });
  }

  formatNumberWithCommas(value: number | string): string {
    const numValue =
      typeof value === 'string'
        ? parseFloat(value.replace(/[^0-9.-]/g, ''))
        : value;

    if (isNaN(numValue) || numValue === null || numValue === undefined)
      return '0';

    if (numValue % 1 === 0) {
      return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    const parts = numValue.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `${formattedInteger}.${decimalPart}`;
  }

  calculateDifferenceAndPercentage() {
    const budgetValue =
      this.budgetForm
        .get('budget_amount')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    const executedValue =
      this.budgetForm
        .get('executed_amount')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    
    const budget = parseFloat(budgetValue) || 0;
    const executed = parseFloat(executedValue) || 0;
    const difference = executed - budget;
    
    let percentage = 0;
    if (budget > 0) {
      percentage = (executed / budget) * 100;
    }
    
    this.budgetForm.patchValue(
      { 
        difference_amount: difference,
        percentage: percentage
      },
      { emitEvent: false }
    );
  }

  populateForm(budget: Budget): void {
    const budgetDate = budget.budget_date
      ? budget.budget_date.substring(0, 7)
      : '';

    const budgetAmount =
      typeof budget.budget_amount === 'number'
        ? budget.budget_amount
        : parseFloat(budget.budget_amount) || 0;
    const executedAmount =
      typeof budget.executed_amount === 'number'
        ? budget.executed_amount
        : parseFloat(budget.executed_amount) || 0;

    this.budgetForm.patchValue(
      {
        budget_category_id: budget.budget_category_id.toString(),
        budget_date: budgetDate,
        budget_amount: this.formatNumberWithCommas(budgetAmount),
        executed_amount: this.formatNumberWithCommas(executedAmount),
        difference_amount:
          typeof budget.difference_amount === 'number'
            ? budget.difference_amount
            : parseFloat(budget.difference_amount) || 0,
        percentage:
          typeof budget.percentage === 'number'
            ? budget.percentage
            : parseFloat(budget.percentage) || 0,
      },
      { emitEvent: false }
    );
  }

  onSubmit() {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const formValue = this.budgetForm.value;

    const budgetDate = formValue.budget_date
      ? `${formValue.budget_date}-01`
      : '';

    const budgetAmountValue =
      formValue.budget_amount?.toString().replace(/[^0-9.]/g, '') || '0';
    const executedAmountValue =
      formValue.executed_amount?.toString().replace(/[^0-9.]/g, '') || '0';

    const budgetAmount = parseFloat(budgetAmountValue) || 0;
    const executedAmount = parseFloat(executedAmountValue) || 0;
    const difference = executedAmount - budgetAmount;
    const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

    const budgetData: BudgetCreate = {
      budget_category_id: parseInt(formValue.budget_category_id, 10),
      company_id: this.companyId(),
      budget_date: budgetDate,
      budget_amount: budgetAmount,
      executed_amount: executedAmount,
      difference_amount: difference,
      percentage: percentage,
      user_id: this.userId(),
      document_origin: '',
    };

    if (this.isEditMode() && this.budget()?.id) {
      this.update.emit({
        id: this.budget()!.id!,
        data: budgetData,
      });
    } else {
      this.save.emit(budgetData);
    }

    this.isSubmitting.set(false);
  }

  onClose() {
    this.budgetForm.reset();
    this.isEditMode.set(false);
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }
}

