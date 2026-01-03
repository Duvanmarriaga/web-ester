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
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  FinancialReportService,
  FinancialReportCreate,
  FinancialReport,
} from '../../../infrastructure/services/financial-report.service';
import {
  FinancialReportCategoryService,
  FinancialReportCategory,
  FinancialReportCategoryCreate,
} from '../../../infrastructure/services/financial-report-category.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { Observable, of, Subject } from 'rxjs';
import { map, catchError, debounceTime, switchMap, distinctUntilChanged } from 'rxjs/operators';
import { computed } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-financial-report-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgSelectModule],
  templateUrl: './financial-report-modal.component.html',
  styleUrl: './financial-report-modal.component.scss',
})
export class FinancialReportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private financialReportService = inject(FinancialReportService);
  private categoryService = inject(FinancialReportCategoryService);
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

  reportForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  dateExistsError = signal<string | null>(null);
  isEditMode = signal(false);
  
  // Category management
  categories = signal<FinancialReportCategory[]>([]);
  categoryInput$ = new Subject<string>();
  isLoadingCategories = signal(false);
  currentSearchTerm = signal<string>('');
  isCreatingCategory = signal(false);
  
  categoriesList = computed(() => {
    const cats = this.categories();
    return Array.isArray(cats) ? cats : [];
  });

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
    this.setupTypeahead();
    
    this.reportForm = this.fb.group({
      financial_report_category_id: [null],
      report_date: [
        '',
        [Validators.required],
        [this.dateExistsValidator.bind(this)],
      ],
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

    // Watch for date validation errors
    this.reportForm.get('report_date')?.statusChanges.subscribe(() => {
      const control = this.reportForm.get('report_date');
      if (control?.hasError('dateExists')) {
        this.dateExistsError.set('Ya existe un reporte financiero para esta fecha');
      } else {
        this.dateExistsError.set(null);
      }
    });

    // Load initial categories
    this.loadCategories();
    
    // Initialize form if report is already set
    if (this.report() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.report()!);
    }
  }
  
  setupTypeahead(): void {
    this.categoryInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term: string) => {
          this.isLoadingCategories.set(true);
          this.currentSearchTerm.set(term || '');
          const companyId = this.companyId();
          if (!companyId) {
            this.isLoadingCategories.set(false);
            return of([]);
          }
          if (!term || term.trim().length === 0) {
            return this.categoryService.getByCompany(companyId).pipe(
              catchError(() => {
                this.isLoadingCategories.set(false);
                return of([]);
              })
            );
          }
          return this.categoryService.search(companyId, term).pipe(
            catchError(() => {
              this.isLoadingCategories.set(false);
              return of([]);
            })
          );
        })
      )
      .subscribe((categories) => {
        this.categories.set(Array.isArray(categories) ? categories : []);
        this.isLoadingCategories.set(false);
      });
  }
  
  loadCategories(): void {
    const companyId = this.companyId();
    if (!companyId) {
      this.categories.set([]);
      return;
    }
    
    this.isLoadingCategories.set(true);
    this.categoryService.getByCompany(companyId).subscribe({
      next: (categories) => {
        this.categories.set(Array.isArray(categories) ? categories : []);
        this.isLoadingCategories.set(false);
        this.categoryInput$.next('');
      },
      error: () => {
        this.categories.set([]);
        this.isLoadingCategories.set(false);
      },
    });
  }
  
  onCreateCategoryFromTag(term: string | any): void {
    let categoryName: string;

    if (typeof term === 'string') {
      categoryName = term;
    } else if (term && typeof term === 'object' && term.name) {
      categoryName = term.name;
    } else if (term && typeof term === 'object' && term.value) {
      categoryName = term.value;
    } else {
      categoryName = this.currentSearchTerm();
    }

    if (!categoryName || categoryName.trim().length === 0) {
      return;
    }

    const existingCategory = this.categoriesList().find(
      (cat) => cat.name.toLowerCase() === categoryName.trim().toLowerCase()
    );

    if (existingCategory) {
      this.reportForm.patchValue({
        financial_report_category_id: existingCategory.id,
      });
      return;
    }

    this.createCategory(categoryName.trim());
  }
  
  createCategory(term: string): void {
    const companyId = this.companyId();

    if (
      !companyId ||
      !term ||
      term.trim().length === 0 ||
      this.isCreatingCategory()
    ) {
      return;
    }

    const code = term
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '')
      .substring(0, 20);

    const categoryData: FinancialReportCategoryCreate = {
      code: code || 'CAT_' + Date.now(),
      name: term.trim(),
      company_id: companyId,
    };

    this.isCreatingCategory.set(true);
    this.isLoadingCategories.set(true);

    this.categoryService.create(categoryData).subscribe({
      next: (newCategory) => {
        const currentCategories = this.categories();
        this.categories.set([...currentCategories, newCategory]);
        this.reportForm.patchValue({ financial_report_category_id: newCategory.id });
        this.toastr.success('Categoría creada exitosamente', 'Éxito');
        this.isCreatingCategory.set(false);
        this.isLoadingCategories.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear la categoría';
        this.toastr.error(errorMessage, 'Error');
        this.isCreatingCategory.set(false);
        this.isLoadingCategories.set(false);
      },
    });
  }
  
  compareCategories(cat1: FinancialReportCategory, cat2: FinancialReportCategory): boolean {
    return cat1 && cat2 ? cat1.id === cat2.id : cat1 === cat2;
  }

  dateExistsValidator(control: AbstractControl): Observable<ValidationErrors | null> {
    if (!control.value) {
      return of(null);
    }

    const dateValue = control.value;
    // Convert YYYY-MM to YYYY-MM-01
    const reportDate = `${dateValue}-01`;

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
        financial_report_category_id: report.financial_report_category_id || null,
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
      financial_report_category_id: formValue.financial_report_category_id || null,
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

