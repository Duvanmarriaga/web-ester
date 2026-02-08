import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
  viewChild,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  FinancialReportService,
  FinancialReportCreate,
  FinancialReport,
} from '../../../infrastructure/services/financial-report.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { firstValueFrom, Observable, of } from 'rxjs';
import { debounceTime, switchMap, map, catchError } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { FileUploadComponent } from '../file-upload/file-upload.component';

@Component({
  selector: 'app-financial-report-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FileUploadComponent],
  templateUrl: './financial-report-modal.component.html',
  styleUrl: './financial-report-modal.component.scss',
})
export class FinancialReportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financialReportService = inject(FinancialReportService);
  private toastr = inject(ToastrService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  report = input<FinancialReport | null>(null);

  // Outputs
  close = output<void>();
  save = output<FinancialReportCreate>();
  update = output<{ id: number; data: FinancialReportCreate }>();

  // File upload component reference
  fileUploadComponent = viewChild<FileUploadComponent>('fileUpload');

  reportForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  dateExistsError = signal<string | null>(null);
  isEditMode = signal(false);
  currentReportId = signal<number | null>(null);

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
              financial_report_category_id: null,
              report_date: '',
              current_asset: '0',
              current_passive: '0',
              inventories: '0',
              total_passive: '0',
              total_assets: '0',
              net_profit: '0',
              total_revenue: '0',
              current_value_result: '0',
              initial_value_of_the_year: '0',
              budgeted_value: '0',
              executed_value: '0',
              current_cash_balance: '0',
              average_consumption_of_boxes_over_the_last_3_months: '0',
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.reportForm = this.fb.group({
      report_date: [
        '',
        [Validators.required],
        [this.dateExistsValidator.bind(this)],
      ],
      current_asset: ['0', [Validators.required, this.currencyValidator]],
      current_passive: ['0', [Validators.required, this.currencyValidator]],
      inventories: ['0', [Validators.required, this.currencyValidator]],
      total_passive: ['0', [Validators.required, this.currencyValidator]],
      total_assets: ['0', [Validators.required, this.currencyValidator]],
      net_profit: ['0', [Validators.required, this.currencyValidator]],
      total_revenue: ['0', [Validators.required, this.currencyValidator]],
      current_value_result: ['0', [Validators.required, this.currencyValidator]],
      initial_value_of_the_year: ['0', [Validators.required, this.currencyValidator]],
      budgeted_value: ['0', [Validators.required, this.currencyValidator]],
      executed_value: ['0', [Validators.required, this.currencyValidator]],
      current_cash_balance: ['0', [Validators.required, this.currencyValidator]],
      average_consumption_of_boxes_over_the_last_3_months: ['0', [Validators.required, this.currencyValidator]],
    });

    // Watch for date validation errors
    this.reportForm.get('report_date')?.statusChanges.subscribe(() => {
      const control = this.reportForm.get('report_date');
      if (control?.hasError('dateExists')) {
        this.dateExistsError.set('Ya existe un reporte financiero para esta fecha');
      } else {
        this.dateExistsError.set(null);
      }
    });
    
    // Initialize form if report is already set
    if (this.report() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.report()!);
    }
  }

  dateExistsValidator(control: AbstractControl): Observable<ValidationErrors | null> {
    if (!control.value) {
      return of(null);
    }

    const dateValue = control.value;
    // Date is already in YYYY-MM-DD format
    const reportDate = dateValue;

    return of(null).pipe(
      debounceTime(500),
      switchMap(() => {
        const excludeId = this.isEditMode() && this.report()?.id ? this.report()!.id : undefined;
        return this.financialReportService.checkDateExists(
          this.companyId(),
          reportDate,
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
    if (isNaN(value)) {
      return { invalidCurrency: true };
    }
    return null;
  }

  formatCurrency(event: Event, fieldName: 'current_asset' | 'current_passive' | 'inventories' | 'total_passive' | 'total_assets' | 'net_profit' | 'total_revenue' | 'current_value_result' | 'initial_value_of_the_year' | 'budgeted_value' | 'executed_value' | 'current_cash_balance' | 'average_consumption_of_boxes_over_the_last_3_months'): void {
    const input = event.target as HTMLInputElement;
    const isNegative = input.value.trimStart().startsWith('-');
    let value = input.value.replace(/[^0-9.-]/g, '');
    if (isNegative && !value.startsWith('-')) value = '-' + value;

    // Remove multiple dots
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }

    // Store raw numeric value for calculations (permite negativos)
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

  formatCurrencyOnBlur(fieldName: 'current_asset' | 'current_passive' | 'inventories' | 'total_passive' | 'total_assets' | 'net_profit' | 'total_revenue' | 'current_value_result' | 'initial_value_of_the_year' | 'budgeted_value' | 'executed_value' | 'current_cash_balance' | 'average_consumption_of_boxes_over_the_last_3_months'): void{
    const control = this.reportForm.get(fieldName);
    if (!control) return;

    const raw = control.value?.toString() || '0';
    const isNegative = raw.trimStart().startsWith('-');
    let value = raw.replace(/[^0-9.-]/g, '');
    if (isNegative && !value.startsWith('-')) value = '-' + value;
    const numValue = parseFloat(value) || 0;

    // Format with thousand separators (permite negativos)
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

    const isNegative = numValue < 0;
    const absValue = Math.abs(numValue);

    const formatAbs = (n: number): string => {
      if (n % 1 === 0) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      const parts = n.toFixed(2).split('.');
      const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${integerPart}.${parts[1]}`;
    };

    const formatted = formatAbs(absValue);
    return isNegative ? `-${formatted}` : formatted;
  }

  populateForm(report: FinancialReport): void {
    // Set the current report ID for file upload component
    this.currentReportId.set(report.id || null);

    // Convert date (YYYY-MM-DD) to date format (YYYY-MM-DD)
    const reportDate = report.report_date
      ? report.report_date.substring(0, 10)
      : '';

    // Helper function to safely parse number
    const parseNumber = (value: any): number => {
      return typeof value === 'number' ? value : parseFloat(value as any) || 0;
    };

    this.reportForm.patchValue(
      {
        report_date: reportDate,
        current_asset: this.formatNumberWithCommas(parseNumber(report.current_asset)),
        current_passive: this.formatNumberWithCommas(parseNumber(report.current_passive)),
        inventories: this.formatNumberWithCommas(parseNumber(report.inventories)),
        total_passive: this.formatNumberWithCommas(parseNumber(report.total_passive)),
        total_assets: this.formatNumberWithCommas(parseNumber(report.total_assets)),
        net_profit: this.formatNumberWithCommas(parseNumber(report.net_profit)),
        total_revenue: this.formatNumberWithCommas(parseNumber(report.total_revenue)),
        current_value_result: this.formatNumberWithCommas(parseNumber(report.current_value_result)),
        initial_value_of_the_year: this.formatNumberWithCommas(parseNumber(report.initial_value_of_the_year)),
        budgeted_value: this.formatNumberWithCommas(parseNumber(report.budgeted_value)),
        executed_value: this.formatNumberWithCommas(parseNumber(report.executed_value)),
        current_cash_balance: this.formatNumberWithCommas(parseNumber(report.current_cash_balance)),
        average_consumption_of_boxes_over_the_last_3_months: this.formatNumberWithCommas(parseNumber(report.average_consumption_of_boxes_over_the_last_3_months)),
      },
      { emitEvent: false }
    );
  }

  calculateProfit() {
    // Net profit calculation removed as it's now a direct input
  }

  oldCalculateProfit() {
    const incomeValue =
      this.reportForm
        .get('total_revenue')
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

  async onSubmit() {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    let formValue = { ...this.reportForm.value };
    
    // Helper function to parse currency value (permite negativos)
    const parseCurrency = (value: any): number => {
      return parseFloat(value?.toString().replace(/[^0-9.-]/g, '') || '0') || 0;
    };

    // Report date should be in YYYY-MM-DD format
    const reportDate = formValue.report_date || '';

    const reportData: FinancialReportCreate = {
      company_id: this.companyId(),
      report_date: reportDate,
      current_asset: parseCurrency(formValue.current_asset),
      current_passive: parseCurrency(formValue.current_passive),
      inventories: parseCurrency(formValue.inventories),
      total_passive: parseCurrency(formValue.total_passive),
      total_assets: parseCurrency(formValue.total_assets),
      net_profit: parseCurrency(formValue.net_profit),
      total_revenue: parseCurrency(formValue.total_revenue),
      current_value_result: parseCurrency(formValue.current_value_result),
      initial_value_of_the_year: parseCurrency(formValue.initial_value_of_the_year),
      budgeted_value: parseCurrency(formValue.budgeted_value),
      executed_value: parseCurrency(formValue.executed_value),
      current_cash_balance: parseCurrency(formValue.current_cash_balance),
      average_consumption_of_boxes_over_the_last_3_months: parseCurrency(formValue.average_consumption_of_boxes_over_the_last_3_months),
    };
    try {
      if (this.isEditMode() && this.report()?.id) {
        this.update.emit({
          id: this.report()!.id!,
          data: reportData,
        });
        
        // Upload pending files after update
        const fileUpload = this.fileUploadComponent();
        if (fileUpload) {
          await fileUpload.uploadPendingFiles(this.report()!.id!);
        }
      } else {
        // For new reports, emit save and let parent handle file upload after creation
        this.save.emit(reportData);
      }
    } catch (error) {
      console.error('Error in submit:', error);
      this.toastr.error('Error al guardar el reporte financiero', 'Error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose() {
    this.reportForm.reset();
    this.isEditMode.set(false);
    this.currentReportId.set(null);
    
    // Clear pending files
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      fileUpload.clearPendingFiles();
    }
    
    this.close.emit();
  }

  // Public method to upload files after report creation
  async uploadFilesForNewReport(reportId: number): Promise<boolean> {
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      return await fileUpload.uploadPendingFiles(reportId);
    }
    return true;
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }
}

