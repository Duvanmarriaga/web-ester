import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  FinancialReportService,
  FinancialReportCreate,
  FinancialReport,
} from '../../../infrastructure/services/financial-report.service';
import { LucideAngularModule, X } from 'lucide-angular';

@Component({
  selector: 'app-financial-report-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './financial-report-modal.component.html',
  styleUrl: './financial-report-modal.component.scss',
})
export class FinancialReportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financialReportService = inject(FinancialReportService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  report = input<FinancialReport | null>(null);

  // Outputs
  close = output<void>();
  save = output<FinancialReportCreate>();
  update = output<{ id: number; data: FinancialReportCreate }>();

  reportForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);

  isEditMode = signal(false);

  constructor() {
    // Watch for report and visibility changes to populate form in edit mode
    effect(() => {
      const currentReport = this.report();
      const isVisible = this.isVisible();

      if (isVisible && currentReport) {
        this.isEditMode.set(true);
        // Use setTimeout to ensure form is initialized
        setTimeout(() => {
          if (this.reportForm) {
            this.populateForm(currentReport);
          }
        }, 0);
      } else if (isVisible && !currentReport) {
        this.isEditMode.set(false);
        setTimeout(() => {
          if (this.reportForm) {
            this.reportForm.reset({
              report_date: '',
              income: '0',
              expenses: '0',
              profit: 0,
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.reportForm = this.fb.group({
      report_date: ['', [Validators.required]],
      income: ['0', [Validators.required, this.currencyValidator]],
      expenses: ['0', [Validators.required, this.currencyValidator]],
      profit: [0, [Validators.required]],
    });

    // Calculate profit when income or expenses change
    this.reportForm.get('income')?.valueChanges.subscribe(() => {
      this.calculateProfit();
    });

    this.reportForm.get('expenses')?.valueChanges.subscribe(() => {
      this.calculateProfit();
    });

    // Initialize form if report is already set
    if (this.report() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.report()!);
    }
  }

  currencyValidator(control: any) {
    if (!control.value) return null;
    const value = parseFloat(control.value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(value) || value < 0) {
      return { invalidCurrency: true };
    }
    return null;
  }

  formatCurrency(event: Event, fieldName: 'income' | 'expenses'): void {
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
    this.reportForm.patchValue(
      { [fieldName]: formatted },
      { emitEvent: false }
    );
  }

  formatCurrencyOnBlur(fieldName: 'income' | 'expenses'): void {
    const control = this.reportForm.get(fieldName);
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

  populateForm(report: FinancialReport): void {
    // Convert date (YYYY-MM-DD) to month format (YYYY-MM)
    const reportDate = report.report_date
      ? report.report_date.substring(0, 7)
      : '';

    // Ensure income and expenses are numbers
    const income =
      typeof report.income === 'number'
        ? report.income
        : parseFloat(report.income) || 0;
    const expenses =
      typeof report.expenses === 'number'
        ? report.expenses
        : parseFloat(report.expenses) || 0;

    this.reportForm.patchValue(
      {
        report_date: reportDate,
        income: this.formatNumberWithCommas(income),
        expenses: this.formatNumberWithCommas(expenses),
        profit:
          typeof report.profit === 'number'
            ? report.profit
            : parseFloat(report.profit) || 0,
      },
      { emitEvent: false }
    );
  }

  calculateProfit() {
    const incomeValue =
      this.reportForm
        .get('income')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    const expensesValue =
      this.reportForm
        .get('expenses')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    const income = parseFloat(incomeValue) || 0;
    const expenses = parseFloat(expensesValue) || 0;
    const profit = income - expenses;
    this.reportForm.patchValue({ profit }, { emitEvent: false });
  }

  onSubmit() {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const formValue = this.reportForm.value;

    // Convert month/year format (YYYY-MM) to full date (YYYY-MM-01)
    // Using the first day of the selected month
    const reportDate = formValue.report_date
      ? `${formValue.report_date}-01`
      : '';

    // Parse currency values
    const incomeValue =
      formValue.income?.toString().replace(/[^0-9.]/g, '') || '0';
    const expensesValue =
      formValue.expenses?.toString().replace(/[^0-9.]/g, '') || '0';

    const reportData: FinancialReportCreate = {
      company_id: this.companyId(),
      report_date: reportDate,
      income: parseFloat(incomeValue) || 0,
      expenses: parseFloat(expensesValue) || 0,
      profit: parseFloat(formValue.profit) || 0,
      user_id: this.userId(),
      document_origin: '', // Always send empty string as requested
    };

    if (this.isEditMode() && this.report()?.id) {
      this.update.emit({
        id: this.report()!.id!,
        data: reportData,
      });
    } else {
      this.save.emit(reportData);
    }

    this.isSubmitting.set(false);
  }

  onClose() {
    this.reportForm.reset();
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
