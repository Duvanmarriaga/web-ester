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
  current_asset: number | null;
  current_passive: number | null;
  inventories: number | null;
  total_passive: number | null;
  total_assets: number | null;
  net_profit: number | null;
  total_revenue: number | null;
  current_value_result: number | null;
  initial_value_of_the_year: number | null;
  budgeted_value: number | null;
  executed_value: number | null;
  current_cash_balance: number | null;
  average_consumption_of_boxes_over_the_last_3_months: number | null;
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
        
        // Clear date errors
        this.dateErrors.set(new Map());
        
        // Populate form with imported data
        importedData.forEach((data, index) => {
          // Only add if data has at least a date
          if (data.report_date) {
            this.addReportRow(data);
          }
        });
        
        // Force change detection
        this.cdr.detectChanges();
      }
    });
  }

  ngOnInit() {
    this.reportForm = this.fb.group({
      reports: this.fb.array([]),
    });

    // Populate form with imported data if already available
    const importedData = this.importedData();
    if (importedData.length > 0 && this.isVisible()) {
      importedData.forEach((data) => {
        // Only add if data has at least a date
        if (data.report_date) {
          this.addReportRow(data);
        }
      });
      this.cdr.detectChanges();
    }
  }

  addReportRow(data: ImportedFinancialReport): void {
    // Ensure values are properly formatted
    // Date should already be in YYYY-MM-DD format from the parser
    let dateValue = data.report_date || '';
    
    // If date is in YYYY-MM format, convert to YYYY-MM-01
    if (dateValue && dateValue.length === 7 && dateValue.includes('-')) {
      dateValue = `${dateValue}-01`;
    }

    const index = this.reportsArray.length;
    const reportGroup = this.fb.group({
      report_date: [
        dateValue,
        [Validators.required],
        [this.createDateExistsValidator(index)],
      ],
      current_asset: [this.formatNumberValue(data.current_asset), [Validators.required, this.currencyValidator]],
      current_passive: [this.formatNumberValue(data.current_passive), [Validators.required, this.currencyValidator]],
      inventories: [this.formatNumberValue(data.inventories), [this.currencyValidator]],
      total_passive: [this.formatNumberValue(data.total_passive), [this.currencyValidator]],
      total_assets: [this.formatNumberValue(data.total_assets), [this.currencyValidator]],
      net_profit: [this.formatNumberValue(data.net_profit), [this.currencyValidator]],
      total_revenue: [this.formatNumberValue(data.total_revenue), [this.currencyValidator]],
      current_value_result: [this.formatNumberValue(data.current_value_result), [this.currencyValidator]],
      initial_value_of_the_year: [this.formatNumberValue(data.initial_value_of_the_year), [this.currencyValidator]],
      budgeted_value: [this.formatNumberValue(data.budgeted_value), [this.currencyValidator]],
      executed_value: [this.formatNumberValue(data.executed_value), [this.currencyValidator]],
      current_cash_balance: [this.formatNumberValue(data.current_cash_balance), [this.currencyValidator]],
      average_consumption_of_boxes_over_the_last_3_months: [this.formatNumberValue(data.average_consumption_of_boxes_over_the_last_3_months), [this.currencyValidator]],
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

  formatNumberValue(value: number | null | undefined): string {
    if (value !== null && value !== undefined && !isNaN(value)) {
      return this.formatNumberWithCommas(value);
    }
    return '';
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
      // Date should already be in YYYY-MM-DD format from input type="date"
      let reportDate = dateValue;
      
      // If it's in YYYY-MM format, convert to YYYY-MM-DD
      if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}$/)) {
        reportDate = `${dateValue}-01`;
      }

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

  formatCurrency(event: Event, index: number, fieldName: string): void {
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
    
    // Force change detection to update totals
    this.cdr.detectChanges();
  }

  formatCurrencyOnBlur(index: number, fieldName: string): void {
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

  getNumericValue(control: AbstractControl | null): number {
    if (!control) return 0;
    const value = control.value?.toString().replace(/[^0-9.-]/g, '') || '0';
    return parseFloat(value) || 0;
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
      
      // Convert date to YYYY-MM-DD format for backend
      let reportDate = '';
      if (reportData.report_date) {
        if (typeof reportData.report_date === 'string' && reportData.report_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in YYYY-MM-DD format
          reportDate = reportData.report_date;
        } else if (typeof reportData.report_date === 'string' && reportData.report_date.match(/^\d{4}-\d{2}$/)) {
          // YYYY-MM format, add -01
          reportDate = `${reportData.report_date}-01`;
        } else {
          // Try to parse as date
          const date = new Date(reportData.report_date);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            reportDate = `${year}-${month}-${day}`;
          }
        }
      }

      // Parse all numeric values
      const current_asset = this.getNumericValue(control.get('current_asset'));
      const current_passive = this.getNumericValue(control.get('current_passive'));
      const inventories = this.getNumericValue(control.get('inventories'));
      const total_passive = this.getNumericValue(control.get('total_passive'));
      const total_assets = this.getNumericValue(control.get('total_assets'));
      const net_profit = this.getNumericValue(control.get('net_profit'));
      const total_revenue = this.getNumericValue(control.get('total_revenue'));
      const current_value_result = this.getNumericValue(control.get('current_value_result'));
      const initial_value_of_the_year = this.getNumericValue(control.get('initial_value_of_the_year'));
      const budgeted_value = this.getNumericValue(control.get('budgeted_value'));
      const executed_value = this.getNumericValue(control.get('executed_value'));
      const current_cash_balance = this.getNumericValue(control.get('current_cash_balance'));
      const average_consumption_of_boxes_over_the_last_3_months = this.getNumericValue(control.get('average_consumption_of_boxes_over_the_last_3_months'));

      if (!reportDate) {
        this.toastr.error('Todas las fechas deben estar completas', 'Error');
        this.isSubmitting.set(false);
        return;
      }

      reports.push({
        company_id: this.companyId(),
        financial_report_category_id: null,
        report_date: reportDate,
        current_asset: current_asset || undefined,
        current_passive: current_passive || undefined,
        inventories: inventories || undefined,
        total_passive: total_passive || undefined,
        total_assets: total_assets || undefined,
        net_profit: net_profit || undefined,
        total_revenue: total_revenue || undefined,
        current_value_result: current_value_result || undefined,
        initial_value_of_the_year: initial_value_of_the_year || undefined,
        budgeted_value: budgeted_value || undefined,
        executed_value: executed_value || undefined,
        current_cash_balance: current_cash_balance || undefined,
        average_consumption_of_boxes_over_the_last_3_months: average_consumption_of_boxes_over_the_last_3_months || undefined,
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

