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
  OperationReportService,
  OperationReportCreate,
  OperationReport,
} from '../../../infrastructure/services/operation-report.service';
import {
  OperationCategoryService,
  OperationCategory,
  OperationCategoryCreate,
} from '../../../infrastructure/services/operation-category.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom, Observable, of, Subject } from 'rxjs';
import {
  map,
  catchError,
  debounceTime,
  switchMap,
  distinctUntilChanged,
} from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-operation-report-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgSelectModule,
  ],
  templateUrl: './operation-report-modal.component.html',
  styleUrl: './operation-report-modal.component.scss',
})
export class OperationReportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private operationReportService = inject(OperationReportService);
  private operationCategoryService = inject(OperationCategoryService);
  private toastr = inject(ToastrService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  report = input<OperationReport | null>(null);

  // Outputs
  close = output<void>();
  save = output<OperationReportCreate>();
  update = output<{ id: number; data: OperationReportCreate }>();

  reportForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  dateExistsError = signal<string | null>(null);
  isEditMode = signal(false);
  categories = signal<OperationCategory[]>([]);
  categoryInput$ = new Subject<string>();
  isLoadingCategories = signal(false);
  currentSearchTerm = signal<string>('');
  isCreatingCategory = signal(false);

  // Computed signal to ensure it's always an array
  categoriesList = computed(() => {
    const cats = this.categories();
    return Array.isArray(cats) ? cats : [];
  });

  constructor() {
    effect(() => {
      const currentReport = this.report();
      const isVisible = this.isVisible();

      if (isVisible && currentReport) {
        this.isEditMode.set(true);
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
              operation_budget_category_id: '',
              operation_budget_annual_id: null,
              budget_date: '',
              budget_amount: '0',
              executed_amount: '0',
              difference_amount: '0',
              percentage: '0',
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.setupTypeahead();

    this.reportForm = this.fb.group({
      operation_budget_category_id: ['', [Validators.required]],
      operation_budget_annual_id: [null],
      budget_date: [
        '',
        [Validators.required],
        [this.dateExistsValidator.bind(this)],
      ],
      budget_amount: ['0', [Validators.required, this.currencyValidator]],
      executed_amount: ['0', [Validators.required, this.currencyValidator]],
      difference_amount: ['0', [Validators.required, this.currencyValidator]],
      percentage: ['0', [Validators.required]],
    });

    // Calculate difference and percentage when budget or executed amounts change
    this.reportForm.get('budget_amount')?.valueChanges.subscribe(() => {
      this.calculateDifference();
    });
    this.reportForm.get('executed_amount')?.valueChanges.subscribe(() => {
      this.calculateDifference();
    });

    // Watch for date validation errors
    this.reportForm.get('budget_date')?.statusChanges.subscribe(() => {
      const control = this.reportForm.get('budget_date');
      if (control?.hasError('dateExists')) {
        this.dateExistsError.set(
          'Ya existe un reporte de operación para esta fecha'
        );
      } else {
        this.dateExistsError.set(null);
      }
    });

    // Load initial categories
    this.loadCategories();

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
          // If term is empty, load all categories
          if (!term || term.trim().length === 0) {
            return this.operationCategoryService.getByCompany(companyId).pipe(
              catchError(() => {
                this.isLoadingCategories.set(false);
                return of([]);
              })
            );
          }
          // Otherwise search
          return this.operationCategoryService.search(companyId, term).pipe(
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
    this.operationCategoryService.getByCompany(companyId).subscribe({
      next: (categories) => {
        this.categories.set(Array.isArray(categories) ? categories : []);
        this.isLoadingCategories.set(false);
        // Trigger typeahead with empty term to show initial categories
        this.categoryInput$.next('');
      },
      error: () => {
        this.categories.set([]);
        this.isLoadingCategories.set(false);
      },
    });
  }

  onCategoryKeyDown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    // Allow ng-select to handle Enter normally, but we'll use addTag for creation
    // This is just to prevent form submission when Enter is pressed in the select
    if (keyboardEvent.key === 'Enter') {
      const searchTerm = this.currentSearchTerm();
      const selectedId = this.reportForm.get('operation_category_id')?.value;

      // If there's a search term but no selection, prevent default to allow addTag to work
      if (searchTerm && searchTerm.trim().length > 0 && !selectedId) {
        // Don't prevent default - let ng-select handle it with addTag
        return;
      }
    }
  }

  onCreateCategoryFromTag(term: string | any): void {
    console.log(term);
    // This is called when user clicks on the "addTag" option or presses Enter with no matches
    // ng-select can emit the term as a string or as an object, handle both cases
    let categoryName: string;

    if (typeof term === 'string') {
      categoryName = term;
    } else if (term && typeof term === 'object' && term.name) {
      categoryName = term.name;
    } else if (term && typeof term === 'object' && term.value) {
      categoryName = term.value;
    } else {
      // Try to get the current search term as fallback
      categoryName = this.currentSearchTerm();
    }

    if (!categoryName || categoryName.trim().length === 0) {
      return;
    }

    // Check if category already exists
    const existingCategory = this.categoriesList().find(
      (cat) => cat.name.toLowerCase() === categoryName.trim().toLowerCase()
    );

    if (existingCategory) {
      // If exists, select it instead of creating
      this.reportForm.patchValue({
        operation_category_id: existingCategory.id,
      });
      return;
    }

    // Create the category
    this.createCategory(categoryName.trim());
  }

  onCategoryBlur(): void {
    // When blur, check if we need to create a category
    const searchTerm = this.currentSearchTerm();
    const selectedId = this.reportForm.get('operation_category_id')?.value;

    // If there's a search term but no selected category, and we're not already creating
    if (
      searchTerm &&
      searchTerm.trim().length > 0 &&
      !selectedId &&
      !this.isCreatingCategory()
    ) {
      const existingCategory = this.categoriesList().find(
        (cat) => cat.name.toLowerCase() === searchTerm.trim().toLowerCase()
      );

      if (!existingCategory) {
        // Don't auto-create on blur, let user explicitly create with Enter
        // Just clear the search term
        this.currentSearchTerm.set('');
      }
    }
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

    // Generate code from name (uppercase, replace spaces with underscores, limit to 20 chars)
    const code = term
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '')
      .substring(0, 20);

    const categoryData: OperationCategoryCreate = {
      code: code || 'CAT_' + Date.now(),
      name: term.trim(),
      company_id: companyId,
    };

    this.isCreatingCategory.set(true);
    this.isLoadingCategories.set(true);

    this.operationCategoryService.create(categoryData).subscribe({
      next: (newCategory) => {
        // Add the new category to the list
        const currentCategories = this.categories();
        this.categories.set([...currentCategories, newCategory]);
        // Set the form value to the new category
        this.reportForm.patchValue({ operation_category_id: newCategory.id });
        this.toastr.success('Categoría creada exitosamente', 'Éxito');
        this.isLoadingCategories.set(false);
        this.isCreatingCategory.set(false);
        // Clear the search term
        this.currentSearchTerm.set('');
      },
      error: (error) => {
        this.toastr.error('Error al crear la categoría', 'Error');
        this.isLoadingCategories.set(false);
        this.isCreatingCategory.set(false);
        // Reset the form control if creation failed
        this.reportForm.patchValue({ operation_category_id: '' });
      },
    });
  }

  dateExistsValidator(
    control: AbstractControl
  ): Observable<ValidationErrors | null> {
    if (!control.value) {
      return of(null);
    }

    const dateValue = control.value;
    // Convert YYYY-MM to YYYY-MM-01
    const operationDate = `${dateValue}-01`;

    return of(null).pipe(
      debounceTime(500),
      switchMap(() => {
        const excludeId =
          this.isEditMode() && this.report()?.id
            ? this.report()!.id
            : undefined;
        return this.operationReportService
          .checkDateExists(this.companyId(), operationDate, excludeId)
          .pipe(
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

  formatCurrency(
    event: Event,
    fieldName: 'budget_amount' | 'executed_amount' | 'difference_amount'
  ): void {
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

    this.reportForm.patchValue(
      { [fieldName]: formatted },
      { emitEvent: false }
    );
  }

  formatCurrencyOnBlur(fieldName: 'budget_amount' | 'executed_amount' | 'difference_amount'): void {
    const control = this.reportForm.get(fieldName);
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

  calculateDifference() {
    const budgetValue =
      this.reportForm
        .get('budget_amount')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    const executedValue =
      this.reportForm
        .get('executed_amount')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    
    const budget = parseFloat(budgetValue) || 0;
    const executed = parseFloat(executedValue) || 0;
    const difference = budget - executed;
    const percentage = budget > 0 ? ((executed / budget) * 100) : 0;
    
    this.reportForm.patchValue(
      {
        difference_amount: this.formatNumberWithCommas(difference),
        percentage: percentage.toFixed(2)
      },
      { emitEvent: false }
    );
  }

  populateForm(report: OperationReport): void {
    const budgetDate = report.budget_date
      ? report.budget_date.substring(0, 7)
      : '';

    const budgetAmount =
      typeof report.budget_amount === 'number'
        ? report.budget_amount
        : parseFloat(report.budget_amount as any) || 0;
    const executedAmount =
      typeof report.executed_amount === 'number'
        ? report.executed_amount
        : parseFloat(report.executed_amount as any) || 0;
    const differenceAmount =
      typeof report.difference_amount === 'number'
        ? report.difference_amount
        : parseFloat(report.difference_amount as any) || 0;
    const percentage =
      typeof report.percentage === 'number'
        ? report.percentage
        : parseFloat(report.percentage as any) || 0;

    // Buscar la categoría por ID para obtener el nombre
    const categoryId = report.operation_budget_category_id;
    this.operationCategoryService.getById(categoryId).subscribe({
      next: (category) => {
        // Agregar la categoría a la lista si no está presente
        const currentCategories = this.categories();
        const categoryExists = currentCategories.some(
          (cat) => cat.id === category.id
        );
        if (!categoryExists) {
          this.categories.set([...currentCategories, category]);
        }

        // Establecer el valor del formulario como objeto con name (formato solicitado)
        // Usamos solo {name: ...} para que ng-select pueda mostrarlo correctamente
        this.reportForm.patchValue(
          {
            operation_budget_category_id: { name: category.name },
            operation_budget_annual_id: report.operation_budget_annual_id || null,
            budget_date: budgetDate,
            budget_amount: this.formatNumberWithCommas(budgetAmount),
            executed_amount: this.formatNumberWithCommas(executedAmount),
            difference_amount: this.formatNumberWithCommas(differenceAmount),
            percentage: percentage.toFixed(2),
          },
          { emitEvent: false }
        );
      },
      error: () => {
        // Si falla la búsqueda, establecer solo con el ID como fallback
        this.reportForm.patchValue(
          {
            operation_budget_category_id: report.operation_budget_category_id.toString(),
            operation_budget_annual_id: report.operation_budget_annual_id || null,
            budget_date: budgetDate,
            budget_amount: this.formatNumberWithCommas(budgetAmount),
            executed_amount: this.formatNumberWithCommas(executedAmount),
            difference_amount: this.formatNumberWithCommas(differenceAmount),
            percentage: percentage.toFixed(2),
          },
          { emitEvent: false }
        );
      },
    });
  }

  async onSubmit() {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    let formValue = { ...this.reportForm.value };
    console.log(formValue);
    
    // Si operation_category_id es un objeto con name pero sin id, buscar la categoría en la lista
    if (
      formValue.operation_category_id &&
      typeof formValue.operation_category_id === 'object' &&
      formValue.operation_category_id.name &&
      !formValue.operation_category_id.id
    ) {
      const categoryName = formValue.operation_category_id.name;
      const foundCategory = this.categoriesList().find(
        (cat) => cat.name === categoryName
      );

      if (foundCategory) {
        // Si encontramos la categoría, usar su ID
        formValue.operation_category_id = {
          id: foundCategory.id,
          name: foundCategory.name,
        };
      } else {
        // Si no encontramos la categoría, crear una nueva
        const code = categoryName
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '')
        .substring(0, 20);

      const categoryData: OperationCategoryCreate = {
        code: code || 'CAT_' + Date.now(),
          name: categoryName.trim(),
        company_id: this.companyId(),
      };

      this.isCreatingCategory.set(true);
      this.isLoadingCategories.set(true);

      const newCategory = await firstValueFrom(
        this.operationCategoryService.create(categoryData)
      );
      formValue.operation_budget_category_id = {
        id: newCategory.id,
        name: newCategory.name,
      };
      }
    }
    const budgetDate = formValue.budget_date
      ? `${formValue.budget_date}-01`
      : '';

    const budgetAmountValue =
      formValue.budget_amount?.toString().replace(/[^0-9.]/g, '') || '0';
    const executedAmountValue =
      formValue.executed_amount?.toString().replace(/[^0-9.]/g, '') || '0';
    const differenceAmountValue =
      formValue.difference_amount?.toString().replace(/[^0-9.]/g, '') || '0';
    const percentageValue =
      formValue.percentage?.toString().replace(/[^0-9.]/g, '') || '0';

    const reportData: OperationReportCreate = {
      operation_budget_category_id: parseInt(formValue.operation_budget_category_id.id, 10),
      operation_budget_annual_id: formValue.operation_budget_annual_id || null,
      company_id: this.companyId(),
      budget_date: budgetDate,
      budget_amount: parseFloat(budgetAmountValue) || 0,
      executed_amount: parseFloat(executedAmountValue) || 0,
      difference_amount: parseFloat(differenceAmountValue) || 0,
      percentage: parseFloat(percentageValue) || 0,
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

  compareCategories(category1: any, category2: any): boolean {
    // Comparar por nombre para que funcione con {name: ...}
    if (!category1 || !category2) return false;
    if (typeof category1 === 'object' && typeof category2 === 'object') {
      return category1.name === category2.name;
    }
    return category1 === category2;
  }
}
