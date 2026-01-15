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
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { LucideAngularModule, X, Trash2 } from 'lucide-angular';
import { FinancialReportService, FinancialReportCreate } from '../../../infrastructure/services/financial-report.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, of } from 'rxjs';
import { map, catchError, debounceTime, switchMap } from 'rxjs/operators';

export interface ImportedFinancialReport {
  report_date: string | null;
  income: number | null;
  expenses: number | null;
  profit: number | null;
}

@Component({
  selector: 'app-financial-report-import-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './financial-report-import-modal.component.html',
  styleUrl: './financial-report-import-modal.component.scss',
})
export class FinancialReportImportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private financialReportService = inject(FinancialReportService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  importedData = input.required<ImportedFinancialReport[]>();

  // Outputs
  close = output<void>();
  save = output<FinancialReportCreate[]>();

  reportForm!: FormGroup;
  readonly icons = { X, Trash2 };
  isSubmitting = signal(false);
  dateErrors = signal<Map<number, string>>(new Map());

  get reportsArray(): FormArray {
    return this.reportForm.get('reports') as FormArray;
  }

  constructor() {
    // Watch for importedData changes
    effect(() => {
      const importedData = this.importedData();
      const isVisible = this.isVisible();
      
      if (isVisible && importedData.length > 0 && this.reportForm) {
        // Clear existing form array
        while (this.reportsArray.length !== 0) {
          this.reportsArray.removeAt(0);
        }
        
        // Populate form with imported data
        importedData.forEach((data) => {
          this.addReportRow(data);
        });
      }
    });
  }

  ngOnInit() {
    this.reportForm = this.fb.group({
      reports: this.fb.array([]),
    });

    // Populate form with imported data if already available
    const importedData = this.importedData();
    if (importedData.length > 0) {
      importedData.forEach((data) => {
        this.addReportRow(data);
      });
    }
  }

  addReportRow(data: ImportedFinancialReport): void {
    // Ensure values are properly formatted
    // Date should already be in YYYY-MM format from the parser
    let dateValue = data.report_date || '';
    
    // If date is in YYYY-MM-DD format, convert to YYYY-MM
    if (dateValue && dateValue.length === 10 && dateValue.includes('-')) {
      dateValue = dateValue.substring(0, 7); // Take YYYY-MM part
    }
    
    
    // Format income and expenses as currency strings
    const incomeValue = data.income !== null && data.income !== undefined && !isNaN(data.income) 
      ? this.formatNumberWithCommas(data.income) 
      : '';
    const expensesValue = data.expenses !== null && data.expenses !== undefined && !isNaN(data.expenses) 
      ? this.formatNumberWithCommas(data.expenses) 
      : '';
    const profitValue = this.calculateProfit(data.income, data.expenses);

    const index = this.reportsArray.length;
    const reportGroup = this.fb.group({
      report_date: [
        dateValue,
        [Validators.required],
        [this.createDateExistsValidator(index)],
      ],
      income: [incomeValue, [Validators.required, this.currencyValidator]],
      expenses: [expensesValue, [Validators.required, this.currencyValidator]],
      profit: [{ value: profitValue, disabled: true }],
    });

    // Calculate profit when income or expenses change
    reportGroup.get('income')?.valueChanges.subscribe(() => {
      this.updateProfit(reportGroup);
      // Trigger change detection for totals
      this.reportForm.updateValueAndValidity({ emitEvent: false });
    });

    reportGroup.get('expenses')?.valueChanges.subscribe(() => {
      this.updateProfit(reportGroup);
      // Trigger change detection for totals
      this.reportForm.updateValueAndValidity({ emitEvent: false });
    });

    // Watch for date validation errors
    reportGroup.get('report_date')?.statusChanges.subscribe(() => {
      const control = reportGroup.get('report_date');
      const errors = this.dateErrors();
      if (control?.hasError('dateExists')) {
        errors.set(index, 'Ya existe un reporte financiero para esta fecha');
      } else {
        errors.delete(index);
      }
      this.dateErrors.set(new Map(errors));
      this.cdr.detectChanges();
    });

    this.reportsArray.push(reportGroup);
  }

  createDateExistsValidator(initialIndex: number) {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      // Find the current index of this control in the FormArray
      const currentIndex = this.reportsArray.controls.findIndex(c => c === control);
      const index = currentIndex >= 0 ? currentIndex : initialIndex;

      const dateValue = control.value;
      // Convert YYYY-MM to YYYY-MM-01
      const reportDate = `${dateValue}-01`;

      return of(null).pipe(
        debounceTime(500),
        switchMap(() => {
          return this.financialReportService.checkDateExists(
            this.companyId(),
            reportDate
          ).pipe(
            map((exists) => {
              if (exists) {
                // Update error map
                const errors = this.dateErrors();
                errors.set(index, 'Ya existe un reporte financiero para esta fecha');
                this.dateErrors.set(new Map(errors));
                this.cdr.detectChanges();
                return { dateExists: true };
              } else {
                // Clear error for this index
                const errors = this.dateErrors();
                errors.delete(index);
                this.dateErrors.set(new Map(errors));
                this.cdr.detectChanges();
                return null;
              }
            }),
            catchError(() => of(null))
          );
        })
      );
    };
  }

  currencyValidator(control: any) {
    if (!control.value) return null;
    const value = parseFloat(control.value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(value) || value < 0) {
      return { invalidCurrency: true };
    }
    return null;
  }

  formatCurrency(event: Event, index: number, fieldName: 'income' | 'expenses'): void {
    const reportGroup = this.reportsArray.at(index) as FormGroup;
    if (!reportGroup) return;
    
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
    
    // Format with thousand separators
    const numValue = parseFloat(value) || 0;
    const formatted = this.formatNumberWithCommas(numValue);
    
    // Update input display
    input.value = formatted;
    
    // Store formatted value in form and trigger change detection
    reportGroup.patchValue({ [fieldName]: formatted }, { emitEvent: true });
    
    // Manually trigger profit calculation
    this.updateProfit(reportGroup);
    
    // Force change detection to update totals
    this.cdr.detectChanges();
  }

  formatCurrencyOnBlur(index: number, fieldName: 'income' | 'expenses'): void {
    const reportGroup = this.reportsArray.at(index) as FormGroup;
    if (!reportGroup) return;
    
    const control = reportGroup.get(fieldName);
    if (!control) return;
    
    let value = control.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const numValue = parseFloat(value) || 0;
    
    // Format with thousand separators (without forcing .00 if it's a whole number)
    const formatted = this.formatNumberWithCommas(numValue);
    control.setValue(formatted, { emitEvent: true });
  }

  formatNumberWithCommas(value: number | string): string {
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    
    if (isNaN(numValue) || numValue === null || numValue === undefined) return '';
    
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

  removeReport(index: number): void {
    if (index >= 0 && index < this.reportsArray.length) {
      // Remove the report from the array
      this.reportsArray.removeAt(index);
      
      // Clear all date errors and re-validate remaining rows
      this.dateErrors.set(new Map());
      
      // Re-validate all remaining date fields
      this.reportsArray.controls.forEach((control, idx) => {
        const dateControl = (control as FormGroup).get('report_date');
        if (dateControl) {
          dateControl.updateValueAndValidity();
        }
      });
      
      // Force change detection to update the view
      this.cdr.detectChanges();
    }
  }

  updateProfit(reportGroup: FormGroup): void {
    const incomeValue = reportGroup.get('income')?.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const expensesValue = reportGroup.get('expenses')?.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const income = parseFloat(incomeValue) || 0;
    const expenses = parseFloat(expensesValue) || 0;
    const profit = income - expenses;
    reportGroup.patchValue({ profit }, { emitEvent: false });
  }

  calculateProfit(income: number | null, expenses: number | null): number {
    const incomeValue = income !== null && income !== undefined ? income : 0;
    const expensesValue = expenses !== null && expenses !== undefined ? expenses : 0;
    return incomeValue - expensesValue;
  }

  getTotalProfit(): number {
    let total = 0;
    this.reportsArray.controls.forEach((control) => {
      const profit = control.get('profit')?.value || 0;
      total += profit;
    });
    return total;
  }

  getTotalIncome(): number {
    let total = 0;
    this.reportsArray.controls.forEach((control) => {
      const incomeValue = control.get('income')?.value?.toString().replace(/[^0-9.]/g, '') || '0';
      const income = parseFloat(incomeValue) || 0;
      total += income;
    });
    return total;
  }

  getTotalExpenses(): number {
    let total = 0;
    this.reportsArray.controls.forEach((control) => {
      const expensesValue = control.get('expenses')?.value?.toString().replace(/[^0-9.]/g, '') || '0';
      const expenses = parseFloat(expensesValue) || 0;
      total += expenses;
    });
    return total;
  }

  onSubmit() {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      this.toastr.error('Por favor, completa todos los campos requeridos', 'Error');
      return;
    }

    if (this.reportsArray.length === 0) {
      this.toastr.error('Debe haber al menos un reporte para guardar', 'Error');
      return;
    }

    this.isSubmitting.set(true);

    const reports: FinancialReportCreate[] = [];

    this.reportsArray.controls.forEach((control) => {
      if (control.invalid) {
        return; // Skip invalid rows
      }
      
      const reportData = control.value;
      
      // Convert date from YYYY-MM (month input) to YYYY-MM-01 format for backend
      let reportDate = '';
      if (reportData.report_date) {
        // Input type="month" returns YYYY-MM format
        if (typeof reportData.report_date === 'string' && reportData.report_date.match(/^\d{4}-\d{2}$/)) {
          // Add -01 to make it a full date (first day of the month)
          reportDate = `${reportData.report_date}-01`;
        } else if (typeof reportData.report_date === 'string' && reportData.report_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in YYYY-MM-DD format
          reportDate = reportData.report_date;
        } else {
          // Try to parse as date
          const date = new Date(reportData.report_date);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            reportDate = `${year}-${month}-01`;
          }
        }
      }

      // Parse currency values
      const incomeValue = reportData.income?.toString().replace(/[^0-9.]/g, '') || '0';
      const expensesValue = reportData.expenses?.toString().replace(/[^0-9.]/g, '') || '0';
      const income = parseFloat(incomeValue) || 0;
      const expenses = parseFloat(expensesValue) || 0;
      const profit = income - expenses;

      if (!reportDate) {
        this.toastr.error('Todas las fechas deben estar completas', 'Error');
        this.isSubmitting.set(false);
        return;
      }

      reports.push({
        company_id: this.companyId(),
        financial_report_category_id: null,
        report_date: reportDate,
        total_revenue: income,
        net_profit: profit,
      });
    });

    if (reports.length === 0) {
      this.toastr.error('No hay reportes válidos para guardar', 'Error');
      this.isSubmitting.set(false);
      return;
    }

    this.save.emit(reports);
    this.isSubmitting.set(false);
  }

  onClose() {
    this.reportForm.reset();
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }
}

