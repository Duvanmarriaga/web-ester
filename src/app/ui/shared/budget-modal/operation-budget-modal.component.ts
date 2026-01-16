import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
  viewChild,
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
import {
  BudgetCategoryService,
  BudgetCategory,
  BudgetCategoryCreate,
} from '../../../infrastructure/services/budget-category.service';
import {
  BudgetYearService,
  BudgetYear,
} from '../../../infrastructure/services/budget-year.service';
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
import { FileUploadComponent } from '../file-upload/file-upload.component';

@Component({
  selector: 'app-operation-budget-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgSelectModule,
    FileUploadComponent,
  ],
  templateUrl: './operation-budget-modal.component.html',
  styleUrl: './operation-budget-modal.component.scss',
})
export class OperationBudgetModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private budgetService = inject(BudgetService);
  private budgetCategoryService = inject(BudgetCategoryService);
  private budgetYearService = inject(BudgetYearService);
  private toastr = inject(ToastrService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  budget = input<Budget | null>(null);

  // Outputs
  close = output<void>();
  save = output<BudgetCreate>();
  update = output<{ id: number; data: BudgetCreate }>();

  // File upload component reference
  fileUploadComponent = viewChild<FileUploadComponent>('fileUpload');

  budgetForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  dateExistsError = signal<string | null>(null);
  isEditMode = signal(false);
  categories = signal<BudgetCategory[]>([]);
  budgetYears = signal<BudgetYear[]>([]);
  categoryInput$ = new Subject<string>();
  isLoadingCategories = signal(false);
  isLoadingBudgetYears = signal(false);
  currentSearchTerm = signal<string>('');
  isCreatingCategory = signal(false);
  currentBudgetId = signal<number | null>(null);
  
  // Computed signal to ensure it's always an array
  categoriesList = computed(() => {
    const cats = this.categories();
    return Array.isArray(cats) ? cats : [];
  });

  // Computed signal to get the selected year from budget input or form
  selectedYear = computed(() => {
    // First, try to get the year from the budget input (when editing or when year is pre-selected)
    const currentBudget = this.budget();
    if (currentBudget?.operation_budget_annual_id) {
      const budgetYear = this.budgetYears().find(by => by.id === currentBudget.operation_budget_annual_id);
      if (budgetYear) {
        return budgetYear.year;
      }
    }
    
    // If not in budget input, try to get it from the form
    const annualId = this.budgetForm?.get('operation_budget_annual_id')?.value;
    if (annualId) {
      const budgetYear = this.budgetYears().find(by => by.id === annualId);
      if (budgetYear) {
        return budgetYear.year;
      }
    }
    
    return null;
  });

  // Months array for selector
  months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

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
            // Si el budget input tiene operation_budget_annual_id (año viene por parámetros), mantenerlo
            const budgetInput = this.budget();
            const annualId = budgetInput?.operation_budget_annual_id || null;
            this.budgetForm.reset({
              operation_budget_category_id: '',
              operation_budget_annual_id: annualId,
              budget_month: '',
              budget_amount: '0',
              executed_amount: '0',
              difference_amount: 0,
              percentage: 0,
            });
            // Si hay annualId, establecerlo en el formulario para que el validador funcione
            if (annualId) {
              this.budgetForm.patchValue({ operation_budget_annual_id: annualId });
            }
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.setupTypeahead();
    
    this.budgetForm = this.fb.group({
      operation_budget_category_id: ['', [Validators.required]],
      operation_budget_annual_id: [null],
      budget_month: [
        '',
        [Validators.required],
        [this.dateExistsValidator.bind(this)],
      ],
      budget_amount: ['0', [Validators.required, this.currencyValidator]],
      executed_amount: ['0', [Validators.required, this.currencyValidator]],
      difference_amount: [{ value: 0, disabled: true }],
      percentage: [{ value: 0, disabled: true }],
    });

    // Watch for operation_budget_annual_id changes to update date validator
    this.budgetForm.get('operation_budget_annual_id')?.valueChanges.subscribe(() => {
      // Trigger date validation when year changes
      this.budgetForm.get('budget_month')?.updateValueAndValidity();
    });

    // Calculate difference and percentage when amounts change
    this.budgetForm.get('budget_amount')?.valueChanges.subscribe(() => {
      this.calculateDifferenceAndPercentage();
    });

    this.budgetForm.get('executed_amount')?.valueChanges.subscribe(() => {
      this.calculateDifferenceAndPercentage();
    });

    // Watch for month validation errors
    this.budgetForm.get('budget_month')?.statusChanges.subscribe(() => {
      const control = this.budgetForm.get('budget_month');
      if (control?.hasError('dateExists')) {
        this.dateExistsError.set('Ya existe un presupuesto para esta fecha');
      } else {
        this.dateExistsError.set(null);
      }
    });

    // Load initial categories and budget years
    this.loadCategories();
    this.loadBudgetYears();

    if (this.budget() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.budget()!);
    }
  }

  loadBudgetYears(): void {
    const companyId = this.companyId();
    if (!companyId) {
      this.budgetYears.set([]);
      return;
    }

    this.isLoadingBudgetYears.set(true);
    this.budgetYearService.getAll(companyId).subscribe({
      next: (budgetYears) => {
        this.budgetYears.set(Array.isArray(budgetYears) ? budgetYears : []);
        this.isLoadingBudgetYears.set(false);
      },
      error: () => {
        this.budgetYears.set([]);
        this.isLoadingBudgetYears.set(false);
      },
    });
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
            return this.budgetCategoryService.getByCompany(companyId).pipe(
              catchError(() => {
                this.isLoadingCategories.set(false);
                return of([]);
              })
            );
          }
          // Otherwise search
          return this.budgetCategoryService.search(companyId, term).pipe(
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
    this.budgetCategoryService.getByCompany(companyId).subscribe({
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

  onCreateCategoryFromTag(term: string | any): void {
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
      this.budgetForm.patchValue({
        operation_budget_category_id: existingCategory.id,
      });
      return;
    }

    // Create the category
    this.createCategory(categoryName.trim());
  }

  onCategoryBlur(): void {
    // When blur, check if we need to create a category
    const searchTerm = this.currentSearchTerm();
    const selectedId = this.budgetForm.get('operation_budget_category_id')?.value;

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

    const categoryData: BudgetCategoryCreate = {
      code: code || 'CAT_' + Date.now(),
      name: term.trim(),
      company_id: companyId,
    };

    this.isCreatingCategory.set(true);
    this.isLoadingCategories.set(true);

    this.budgetCategoryService.create(categoryData).subscribe({
      next: (newCategory) => {
        // Add the new category to the list
        const currentCategories = this.categories();
        this.categories.set([...currentCategories, newCategory]);
        // Set the form value to the new category
        this.budgetForm.patchValue({ operation_budget_category_id: newCategory.id });
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
        this.budgetForm.patchValue({ operation_budget_category_id: '' });
      },
    });
  }

  dateExistsValidator(control: AbstractControl): Observable<ValidationErrors | null> {
    if (!control.value) {
      return of(null);
    }

    const month = control.value;
    const year = this.selectedYear();
    
    if (!year) {
      return of(null);
    }

    // Create date string in format YYYY-MM-DD
    const monthStr = month.toString().padStart(2, '0');
    const budgetDate = `${year}-${monthStr}-01`;

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
    const difference = budget - executed;
    
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
    // Set the current budget ID for file upload component
    this.currentBudgetId.set(budget.id || null);

    // Extract month from budget_date (format: YYYY-MM-DD)
    let budgetMonth = '';
    if (budget.budget_date) {
      const dateParts = budget.budget_date.split('-');
      if (dateParts.length >= 2) {
        budgetMonth = parseInt(dateParts[1], 10).toString();
      }
    }

    const budgetAmount =
      typeof budget.budget_amount === 'number'
        ? budget.budget_amount
        : parseFloat(budget.budget_amount) || 0;
    const executedAmount =
      typeof budget.executed_amount === 'number'
        ? budget.executed_amount
        : parseFloat(budget.executed_amount) || 0;

    // Buscar la categoría por ID para obtener el nombre
    const categoryId = budget.operation_budget_category_id;
    this.budgetCategoryService.getById(categoryId).subscribe({
      next: (category) => {
        // Agregar la categoría a la lista si no está presente
        const currentCategories = this.categories();
        const categoryExists = currentCategories.some(
          (cat) => cat.id === category.id
        );
        if (!categoryExists) {
          this.categories.set([...currentCategories, category]);
        }

        // Establecer el valor del formulario con el objeto completo de la categoría
        // para que ng-select pueda mostrarlo correctamente
        this.budgetForm.patchValue(
          {
            operation_budget_category_id: category,
            operation_budget_annual_id: budget.operation_budget_annual_id || null,
            budget_month: budgetMonth,
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
      },
      error: () => {
        // Si falla la búsqueda, intentar encontrar la categoría en la lista actual
        const currentCategories = this.categories();
        const foundCategory = currentCategories.find(
          (cat) => cat.id === categoryId
        );
        
        if (foundCategory) {
          this.budgetForm.patchValue(
            {
              operation_budget_category_id: foundCategory,
              operation_budget_annual_id: budget.operation_budget_annual_id || null,
              budget_month: budgetMonth,
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
        } else {
          // Si no se encuentra, establecer solo el ID como último recurso
          this.budgetForm.patchValue(
            {
              operation_budget_category_id: categoryId,
              operation_budget_annual_id: budget.operation_budget_annual_id || null,
              budget_month: budgetMonth,
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
      },
    });
  }

  async onSubmit() {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    let formValue = { ...this.budgetForm.value };

    // Si operation_budget_category_id es un objeto, extraer el ID o buscar/crear la categoría
    if (
      formValue.operation_budget_category_id &&
      typeof formValue.operation_budget_category_id === 'object'
    ) {
      // Si tiene id, usar el id directamente
      if (formValue.operation_budget_category_id.id) {
        formValue.operation_budget_category_id = formValue.operation_budget_category_id.id;
      } else if (formValue.operation_budget_category_id.name) {
        // Si solo tiene name, buscar o crear la categoría
        const categoryName = formValue.operation_budget_category_id.name;
        const foundCategory = this.categoriesList().find(
          (cat) => cat.name === categoryName
        );

        if (foundCategory) {
          // Si encontramos la categoría, usar su ID
          formValue.operation_budget_category_id = foundCategory.id;
        } else {
          // Si no encontramos la categoría, crear una nueva
          const code = categoryName
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[^A-Z0-9_]/g, '')
            .substring(0, 20);

          const categoryData: BudgetCategoryCreate = {
            code: code || 'CAT_' + Date.now(),
            name: categoryName.trim(),
            company_id: this.companyId(),
          };

          this.isCreatingCategory.set(true);
          this.isLoadingCategories.set(true);

          const newCategory = await firstValueFrom(
            this.budgetCategoryService.create(categoryData)
          );
          formValue.operation_budget_category_id = newCategory.id;
        }
      }
    }

    // Combine selected month with year from operation_budget_annual_id
    const month = formValue.budget_month;
    const year = this.selectedYear();
    let budgetDate = '';
    
    if (month && year) {
      const monthStr = month.toString().padStart(2, '0');
      budgetDate = `${year}-${monthStr}-01`;
    }

    const budgetAmountValue =
      formValue.budget_amount?.toString().replace(/[^0-9.]/g, '') || '0';
    const executedAmountValue =
      formValue.executed_amount?.toString().replace(/[^0-9.]/g, '') || '0';

    const budgetAmount = parseFloat(budgetAmountValue) || 0;
    const executedAmount = parseFloat(executedAmountValue) || 0;
    const difference = budgetAmount - executedAmount;
    const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

    const budgetData: BudgetCreate = {
      operation_budget_category_id: parseInt(formValue.operation_budget_category_id.toString(), 10),
      company_id: this.companyId(),
      operation_budget_annual_id: formValue.operation_budget_annual_id || null,
      budget_date: budgetDate,
      budget_amount: budgetAmount,
      executed_amount: executedAmount,
      difference_amount: difference,
      percentage: percentage,
    };

    try {
      if (this.isEditMode() && this.budget()?.id) {
        this.update.emit({
          id: this.budget()!.id!,
          data: budgetData,
        });
        
        // Upload pending files after update
        const fileUpload = this.fileUploadComponent();
        if (fileUpload) {
          await fileUpload.uploadPendingFiles(this.budget()!.id!);
        }
      } else {
        // For new budgets, emit save and let parent handle file upload after creation
        this.save.emit(budgetData);
      }
    } catch (error) {
      console.error('Error in submit:', error);
      this.toastr.error('Error al guardar el presupuesto', 'Error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose() {
    this.budgetForm.reset();
    this.isEditMode.set(false);
    this.currentBudgetId.set(null);
    
    // Clear pending files
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      fileUpload.clearPendingFiles();
    }
    
    this.close.emit();
  }

  // Public method to upload files after budget creation
  async uploadFilesForNewBudget(budgetId: number): Promise<boolean> {
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      return await fileUpload.uploadPendingFiles(budgetId);
    }
    return true;
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }

  compareCategories(category1: any, category2: any): boolean {
    // Comparar por ID para que funcione correctamente con objetos de categoría
    if (!category1 || !category2) return false;
    
    // Si ambos son objetos con id, comparar por id
    if (typeof category1 === 'object' && typeof category2 === 'object') {
      if (category1.id && category2.id) {
        return category1.id === category2.id;
      }
      // Fallback: comparar por nombre si no tienen id
      return category1.name === category2.name;
    }
    
    // Si uno es número (ID) y el otro es objeto, comparar el ID del objeto con el número
    if (typeof category1 === 'number' && typeof category2 === 'object' && category2.id) {
      return category1 === category2.id;
    }
    if (typeof category2 === 'number' && typeof category1 === 'object' && category1.id) {
      return category2 === category1.id;
    }
    
    // Comparación directa
    return category1 === category2;
  }
}

