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
} from '@angular/forms';
import {
  InvestmentService,
  InvestmentCreate,
  Investment,
} from '../../../infrastructure/services/investment.service';
import {
  InvestmentCategoryService,
  InvestmentCategory,
  InvestmentCategoryCreate,
} from '../../../infrastructure/services/investment-category.service';
import {
  InvestmentBudgetYearService,
  InvestmentBudgetYear,
} from '../../../infrastructure/services/investment-budget-year.service';
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
  selector: 'app-investment-budget-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgSelectModule,
    FileUploadComponent,
  ],
  templateUrl: './investment-budget-modal.component.html',
  styleUrl: './investment-budget-modal.component.scss',
})
export class InvestmentBudgetModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private investmentService = inject(InvestmentService);
  private investmentCategoryService = inject(InvestmentCategoryService);
  private budgetYearService = inject(InvestmentBudgetYearService);
  private toastr = inject(ToastrService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  investment = input<Investment | null>(null);

  // Outputs
  close = output<void>();
  save = output<InvestmentCreate>();
  update = output<{ id: number; data: InvestmentCreate }>();

  // File upload component reference
  fileUploadComponent = viewChild<FileUploadComponent>('fileUpload');

  investmentForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  isEditMode = signal(false);
  currentInvestmentId = signal<number | null>(null);
  categories = signal<InvestmentCategory[]>([]);
  budgetYears = signal<InvestmentBudgetYear[]>([]);
  categoryInput$ = new Subject<string>();
  isLoadingCategories = signal(false);
  isLoadingBudgetYears = signal(false);
  currentSearchTerm = signal<string>('');
  isCreatingCategory = signal(false);

  // Computed signal to ensure it's always an array
  categoriesList = computed(() => {
    const cats = this.categories();
    return Array.isArray(cats) ? cats : [];
  });

  constructor() {
    effect(() => {
      const currentInvestment = this.investment();
      const isVisible = this.isVisible();

      if (isVisible && currentInvestment) {
        this.isEditMode.set(true);
        setTimeout(() => {
          if (this.investmentForm) {
            this.populateForm(currentInvestment);
          }
        }, 0);
      } else if (isVisible && !currentInvestment) {
        this.isEditMode.set(false);
        setTimeout(() => {
          if (this.investmentForm) {
            // Get investment_budget_annual_id from the investment input (even if it's a temp one)
            const tempInvestment = this.investment();
            const annualId = tempInvestment?.investment_budget_annual_id || null;
            
            this.investmentForm.reset({
              investment_budget_category_id: '',
              investment_budget_annual_id: annualId,
              amount: '0',
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.setupTypeahead();

    this.investmentForm = this.fb.group({
      investment_budget_category_id: ['', [Validators.required]],
      investment_budget_annual_id: [null],
      amount: ['0', [Validators.required, this.currencyValidator]],
    });

    // Load initial categories and budget years
    this.loadCategories();
    this.loadBudgetYears();

    if (this.investment() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.investment()!);
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
            return this.investmentCategoryService.getByCompany(companyId).pipe(
              catchError(() => {
                this.isLoadingCategories.set(false);
                return of([]);
              })
            );
          }
          // Otherwise search
          return this.investmentCategoryService.search(companyId, term).pipe(
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
    this.investmentCategoryService.getByCompany(companyId).subscribe({
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

    // Check if category already exists
    const existingCategory = this.categoriesList().find(
      (cat) => cat.name.toLowerCase() === categoryName.trim().toLowerCase()
    );

    if (existingCategory) {
      this.investmentForm.patchValue({
        investment_budget_category_id: existingCategory.id,
      });
      return;
    }

    // Create the category
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

    // Generate code from name
    const code = term
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '')
      .substring(0, 20);

    const categoryData: InvestmentCategoryCreate = {
      code: code || 'CAT_' + Date.now(),
      name: term.trim(),
      company_id: companyId,
    };

    this.isCreatingCategory.set(true);
    this.isLoadingCategories.set(true);

    this.investmentCategoryService.create(categoryData).subscribe({
      next: (newCategory) => {
        const currentCategories = this.categories();
        this.categories.set([...currentCategories, newCategory]);
        this.investmentForm.patchValue({ investment_budget_category_id: newCategory.id });
        this.toastr.success('Categoría creada exitosamente', 'Éxito');
        this.isLoadingCategories.set(false);
        this.isCreatingCategory.set(false);
        this.currentSearchTerm.set('');
      },
      error: (error) => {
        this.toastr.error('Error al crear la categoría', 'Error');
        this.isLoadingCategories.set(false);
        this.isCreatingCategory.set(false);
        this.investmentForm.patchValue({ investment_budget_category_id: '' });
      },
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

  numberValidator(control: any) {
    if (!control.value) return null;
    const value = parseFloat(control.value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(value) || value < 0) {
      return { invalidNumber: true };
    }
    return null;
  }

  formatCurrency(
    event: Event,
    fieldName: 'amount'
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

    this.investmentForm.patchValue(
      { [fieldName]: formatted },
      { emitEvent: false }
    );
  }

  formatNumber(
    event: Event,
    fieldName: 'amount'
  ): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');

    const numValue = parseFloat(value) || 0;
    const formatted = this.formatNumberWithCommas(numValue);

    input.value = formatted;

    this.investmentForm.patchValue(
      { [fieldName]: formatted },
      { emitEvent: false }
    );
  }

  formatCurrencyOnBlur(fieldName: 'amount'): void {
    const control = this.investmentForm.get(fieldName);
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


  populateForm(investment: Investment): void {
    // Set the current investment ID for file upload component
    this.currentInvestmentId.set(investment.id || null);

    const amount =
      typeof investment.amount === 'number'
        ? investment.amount
        : parseFloat(investment.amount as any) || 0;

    // Buscar la categoría por ID para obtener el nombre
    const categoryId = investment.investment_budget_category_id;
    this.investmentCategoryService.getById(categoryId).subscribe({
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
        this.investmentForm.patchValue(
          {
            investment_budget_category_id: category,
            investment_budget_annual_id: investment.investment_budget_annual_id || null,
            amount: this.formatNumberWithCommas(amount),
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
          this.investmentForm.patchValue(
            {
              investment_budget_category_id: foundCategory,
              investment_budget_annual_id: investment.investment_budget_annual_id || null,
              amount: this.formatNumberWithCommas(amount),
            },
            { emitEvent: false }
          );
        } else {
          // Si no se encuentra, establecer solo el ID como último recurso
          this.investmentForm.patchValue(
            {
              investment_budget_category_id: categoryId,
              investment_budget_annual_id: investment.investment_budget_annual_id || null,
              amount: this.formatNumberWithCommas(amount),
            },
            { emitEvent: false }
          );
        }
      },
    });
  }

  async onSubmit() {
    if (this.investmentForm.invalid) {
      this.investmentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    let formValue = { ...this.investmentForm.value };

    // Si investment_budget_category_id es un objeto con name pero sin id, buscar la categoría en la lista
    if (
      formValue.investment_budget_category_id &&
      typeof formValue.investment_budget_category_id === 'object' &&
      formValue.investment_budget_category_id.name &&
      !formValue.investment_budget_category_id.id
    ) {
      const categoryName = formValue.investment_budget_category_id.name;
      const foundCategory = this.categoriesList().find(
        (cat) => cat.name === categoryName
      );

      if (foundCategory) {
        formValue.investment_budget_category_id = foundCategory.id;
      } else {
        // Si no encontramos la categoría, crear una nueva
        const code = categoryName
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '')
          .substring(0, 20);

        const categoryData: InvestmentCategoryCreate = {
          code: code || 'CAT_' + Date.now(),
          name: categoryName.trim(),
          company_id: this.companyId(),
        };

        this.isCreatingCategory.set(true);
        this.isLoadingCategories.set(true);

        const newCategory = await firstValueFrom(
          this.investmentCategoryService.create(categoryData)
        );
        formValue.investment_budget_category_id = newCategory.id;
      }
    }

    // Extraer el ID de la categoría si es un objeto
    let categoryId: number;
    if (typeof formValue.investment_budget_category_id === 'object' && formValue.investment_budget_category_id.id) {
      categoryId = formValue.investment_budget_category_id.id;
    } else if (typeof formValue.investment_budget_category_id === 'number') {
      categoryId = formValue.investment_budget_category_id;
    } else {
      categoryId = parseInt(formValue.investment_budget_category_id, 10);
    }

    const amountValue =
      formValue.amount?.toString().replace(/[^0-9.]/g, '') || '0';

    // Always get investment_budget_annual_id from the investment input (context)
    const currentInvestment = this.investment();
    const annualId = currentInvestment?.investment_budget_annual_id || formValue.investment_budget_annual_id || null;

    const investmentData: InvestmentCreate = {
      investment_budget_category_id: categoryId,
      investment_budget_annual_id: annualId,
      company_id: this.companyId(),
      amount: parseFloat(amountValue) || 0,
    };

    try {
      if (this.isEditMode() && this.investment()?.id) {
        this.update.emit({
          id: this.investment()!.id!,
          data: investmentData,
        });
        
        // Upload pending files after update
        const fileUpload = this.fileUploadComponent();
        if (fileUpload) {
          await fileUpload.uploadPendingFiles(this.investment()!.id!);
        }
      } else {
        // For new investments, emit save and let parent handle file upload after creation
        this.save.emit(investmentData);
      }
    } catch (error) {
      console.error('Error in submit:', error);
      this.toastr.error('Error al guardar el presupuesto de inversión', 'Error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose() {
    this.investmentForm.reset();
    this.isEditMode.set(false);
    this.currentInvestmentId.set(null);
    
    // Clear pending files
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      fileUpload.clearPendingFiles();
    }
    
    this.close.emit();
  }

  // Public method to upload files after investment creation
  async uploadFilesForNewInvestment(investmentId: number): Promise<boolean> {
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      return await fileUpload.uploadPendingFiles(investmentId);
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

