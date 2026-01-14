import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  BudgetYearService,
  BudgetYearCreate,
  BudgetYearUpdate,
  BudgetYear,
} from '../../../infrastructure/services/budget-year.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-operation-budget-year-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './operation-budget-year-modal.component.html',
  styleUrl: './operation-budget-year-modal.component.scss',
})
export class OperationBudgetYearModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private budgetYearService = inject(BudgetYearService);
  private toastr = inject(ToastrService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  budgetYear = input<BudgetYear | null>(null);

  // Outputs
  close = output<void>();
  save = output<BudgetYearCreate>();
  update = output<{ id: number; data: BudgetYearUpdate }>();

  budgetYearForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  isEditMode = signal(false);
  yearExistsError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const currentBudgetYear = this.budgetYear();
      const isVisible = this.isVisible();

      if (isVisible && currentBudgetYear) {
        this.isEditMode.set(true);
        setTimeout(() => {
          if (this.budgetYearForm) {
            this.populateForm(currentBudgetYear);
          }
        }, 0);
      } else if (isVisible && !currentBudgetYear) {
        this.isEditMode.set(false);
        this.yearExistsError.set(null);
        setTimeout(() => {
          if (this.budgetYearForm) {
            this.budgetYearForm.reset({
              year: new Date().getFullYear(),
              amount: '0',
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.budgetYearForm = this.fb.group({
      year: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
      amount: ['0', [Validators.required, this.currencyValidator]],
    });

    // Watch for year changes to validate if it exists (only in create mode)
    this.budgetYearForm.get('year')?.valueChanges.subscribe((year) => {
      if (!this.isEditMode() && year && this.companyId()) {
        this.validateYearExists(year);
      } else {
        this.yearExistsError.set(null);
      }
    });

    if (this.budgetYear() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.budgetYear()!);
    }
  }

  async validateYearExists(year: number): Promise<void> {
    if (!year || this.isEditMode()) {
      this.yearExistsError.set(null);
      return;
    }

    try {
      const existingYears = await firstValueFrom(
        this.budgetYearService.getAll(this.companyId(), year)
      );
      
      if (existingYears && existingYears.length > 0) {
        this.yearExistsError.set(`Ya existe un presupuesto para el año ${year}`);
      } else {
        this.yearExistsError.set(null);
      }
    } catch (error) {
      console.error('Error validating year:', error);
      // Don't set error on validation error, only on submit
    }
  }

  populateForm(budgetYear: BudgetYear): void {
    const amount =
      typeof budgetYear.amount === 'number'
        ? budgetYear.amount
        : parseFloat(budgetYear.amount) || 0;

    this.budgetYearForm.patchValue({
      year: budgetYear.year,
      amount: this.formatNumberWithCommas(amount),
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

  formatCurrency(event: Event, fieldName: 'amount'): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');

    // Remove multiple dots
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }

    // Store raw numeric value for calculations
    const numValue = parseFloat(value) || 0;

    // Format with thousand separators for display
    const formatted = this.formatNumberWithCommas(numValue);

    // Update input display
    input.value = formatted;

    // Store formatted value in form
    this.budgetYearForm.patchValue(
      { [fieldName]: formatted },
      { emitEvent: false }
    );
  }

  formatCurrencyOnBlur(fieldName: 'amount'): void {
    const control = this.budgetYearForm.get(fieldName);
    if (!control) return;

    let value = control.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const numValue = parseFloat(value) || 0;

    // Format with thousand separators (without forcing .00 if it's a whole number)
    const formatted = this.formatNumberWithCommas(numValue);
    control.setValue(formatted, { emitEvent: true });
  }

  formatNumberWithCommas(value: number | string): string {
    // Convert to number if it's a string
    const numValue =
      typeof value === 'string'
        ? parseFloat(value.replace(/[^0-9.-]/g, ''))
        : value;

    if (isNaN(numValue) || numValue === null || numValue === undefined)
      return '0';

    // Check if it's a whole number
    if (numValue % 1 === 0) {
      // It's a whole number, format without decimals
      return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Has decimals, format with 2 decimal places
    const parts = numValue.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    // Add thousand separators
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `${formattedInteger}.${decimalPart}`;
  }

  async onSubmit(): Promise<void> {
    if (this.budgetYearForm.invalid || this.isSubmitting()) {
      this.budgetYearForm.markAllAsTouched();
      return;
    }

    // If there's a year exists error, don't allow submission
    if (this.yearExistsError()) {
      this.toastr.error(this.yearExistsError()!, 'Error');
      return;
    }

    this.isSubmitting.set(true);

    const formValue = this.budgetYearForm.value;
    
    // Parse currency value
    const amountValue =
      formValue.amount?.toString().replace(/[^0-9.]/g, '') || '0';
    const amount = parseFloat(amountValue) || 0;

    if (this.isEditMode() && this.budgetYear()?.id) {
      const updateData: BudgetYearUpdate = {
        amount,
      };
      this.update.emit({ id: this.budgetYear()!.id!, data: updateData });
      this.isSubmitting.set(false);
    } else {
      // Final validation: Check if year already exists before creating
      const year = parseInt(formValue.year);
      
      try {
        const existingYears = await firstValueFrom(
          this.budgetYearService.getAll(this.companyId(), year)
        );
        
        if (existingYears && existingYears.length > 0) {
          this.yearExistsError.set(`Ya existe un presupuesto para el año ${year}`);
          this.toastr.error(`Ya existe un presupuesto para el año ${year}`, 'Error');
          this.isSubmitting.set(false);
          return;
        }

        // Year doesn't exist, proceed with creation
        const createData: BudgetYearCreate = {
          company_id: this.companyId(),
          year,
          amount,
        };
        this.save.emit(createData);
        this.isSubmitting.set(false);
      } catch (error) {
        console.error('Error checking if year exists:', error);
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al verificar si el año ya existe';
        this.toastr.error(errorMessage, 'Error');
        this.isSubmitting.set(false);
      }
    }
  }

  onClose(): void {
    this.yearExistsError.set(null);
    this.close.emit();
  }
}





