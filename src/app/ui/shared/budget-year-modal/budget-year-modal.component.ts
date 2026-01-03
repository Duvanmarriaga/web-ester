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

@Component({
  selector: 'app-budget-year-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './budget-year-modal.component.html',
  styleUrl: './budget-year-modal.component.scss',
})
export class BudgetYearModalComponent implements OnInit {
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

    if (this.budgetYear() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.budgetYear()!);
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

  onSubmit(): void {
    if (this.budgetYearForm.invalid || this.isSubmitting()) {
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
    } else {
      const createData: BudgetYearCreate = {
        company_id: this.companyId(),
        year: parseInt(formValue.year),
        amount,
      };
      this.save.emit(createData);
    }

    this.isSubmitting.set(false);
  }

  onClose(): void {
    this.close.emit();
  }
}





