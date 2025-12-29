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
  selector: 'app-investment-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgSelectModule,
  ],
  templateUrl: './investment-modal.component.html',
  styleUrl: './investment-modal.component.scss',
})
export class InvestmentModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private investmentService = inject(InvestmentService);
  private investmentCategoryService = inject(InvestmentCategoryService);
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

  investmentForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  isEditMode = signal(false);
  categories = signal<InvestmentCategory[]>([]);
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
            this.investmentForm.reset({
              investment_category_id: '',
              investment_date: '',
              unit_cost: '0',
              quantity: '0',
              total_cost: '0',
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.setupTypeahead();

    this.investmentForm = this.fb.group({
      investment_category_id: ['', [Validators.required]],
      investment_date: ['', [Validators.required]],
      unit_cost: ['0', [Validators.required, this.currencyValidator]],
      quantity: ['0', [Validators.required, this.numberValidator]],
      total_cost: ['0', [Validators.required, this.currencyValidator]],
    });

    // Calculate total cost when unit cost or quantity changes
    this.investmentForm.get('unit_cost')?.valueChanges.subscribe(() => {
      this.calculateTotalCost();
    });

    this.investmentForm.get('quantity')?.valueChanges.subscribe(() => {
      this.calculateTotalCost();
    });

    // Load initial categories
    this.loadCategories();

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
        investment_category_id: existingCategory.id,
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
        this.investmentForm.patchValue({ investment_category_id: newCategory.id });
        this.toastr.success('Categoría creada exitosamente', 'Éxito');
        this.isLoadingCategories.set(false);
        this.isCreatingCategory.set(false);
        this.currentSearchTerm.set('');
      },
      error: (error) => {
        this.toastr.error('Error al crear la categoría', 'Error');
        this.isLoadingCategories.set(false);
        this.isCreatingCategory.set(false);
        this.investmentForm.patchValue({ investment_category_id: '' });
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
    fieldName: 'unit_cost' | 'total_cost'
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
    fieldName: 'quantity'
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

  formatCurrencyOnBlur(fieldName: 'unit_cost' | 'total_cost'): void {
    const control = this.investmentForm.get(fieldName);
    if (!control) return;

    let value = control.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const numValue = parseFloat(value) || 0;

    const formatted = this.formatNumberWithCommas(numValue);
    control.setValue(formatted, { emitEvent: true });
  }

  formatNumberOnBlur(fieldName: 'quantity'): void {
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

  calculateTotalCost() {
    const unitCostValue =
      this.investmentForm
        .get('unit_cost')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    const quantityValue =
      this.investmentForm
        .get('quantity')
        ?.value?.toString()
        .replace(/[^0-9.]/g, '') || '0';
    const unitCost = parseFloat(unitCostValue) || 0;
    const quantity = parseFloat(quantityValue) || 0;
    const totalCost = unitCost * quantity;
    this.investmentForm.patchValue(
      { total_cost: this.formatNumberWithCommas(totalCost) },
      { emitEvent: false }
    );
  }

  populateForm(investment: Investment): void {
    const investmentDate = investment.investment_date
      ? investment.investment_date.substring(0, 10)
      : '';

    const unitCost =
      typeof investment.unit_cost === 'number'
        ? investment.unit_cost
        : parseFloat(investment.unit_cost) || 0;
    const quantity =
      typeof investment.quantity === 'number'
        ? investment.quantity
        : parseFloat(investment.quantity) || 0;
    const totalCost =
      typeof investment.total_cost === 'number'
        ? investment.total_cost
        : parseFloat(investment.total_cost) || 0;

    // Buscar la categoría por ID para obtener el nombre
    const categoryId = investment.investment_category_id;
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

        // Establecer el valor del formulario como objeto con name
        this.investmentForm.patchValue(
          {
            investment_category_id: { name: category.name },
            investment_date: investmentDate,
            unit_cost: this.formatNumberWithCommas(unitCost),
            quantity: this.formatNumberWithCommas(quantity),
            total_cost: this.formatNumberWithCommas(totalCost),
          },
          { emitEvent: false }
        );
      },
      error: () => {
        // Si falla la búsqueda, establecer solo con el ID como fallback
        this.investmentForm.patchValue(
          {
            investment_category_id: investment.investment_category_id.toString(),
            investment_date: investmentDate,
            unit_cost: this.formatNumberWithCommas(unitCost),
            quantity: this.formatNumberWithCommas(quantity),
            total_cost: this.formatNumberWithCommas(totalCost),
          },
          { emitEvent: false }
        );
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

    // Si investment_category_id es un objeto con name pero sin id, buscar la categoría en la lista
    if (
      formValue.investment_category_id &&
      typeof formValue.investment_category_id === 'object' &&
      formValue.investment_category_id.name &&
      !formValue.investment_category_id.id
    ) {
      const categoryName = formValue.investment_category_id.name;
      const foundCategory = this.categoriesList().find(
        (cat) => cat.name === categoryName
      );

      if (foundCategory) {
        formValue.investment_category_id = foundCategory.id;
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
        formValue.investment_category_id = newCategory.id;
      }
    }

    const unitCostValue =
      formValue.unit_cost?.toString().replace(/[^0-9.]/g, '') || '0';
    const quantityValue =
      formValue.quantity?.toString().replace(/[^0-9.]/g, '') || '0';
    const totalCostValue =
      formValue.total_cost?.toString().replace(/[^0-9.]/g, '') || '0';

    // Extraer el ID de la categoría si es un objeto
    let categoryId: number;
    if (typeof formValue.investment_category_id === 'object' && formValue.investment_category_id.id) {
      categoryId = formValue.investment_category_id.id;
    } else if (typeof formValue.investment_category_id === 'number') {
      categoryId = formValue.investment_category_id;
    } else {
      categoryId = parseInt(formValue.investment_category_id, 10);
    }

    const investmentData: InvestmentCreate = {
      investment_category_id: categoryId,
      company_id: this.companyId(),
      investment_date: formValue.investment_date,
      unit_cost: parseFloat(unitCostValue) || 0,
      quantity: parseFloat(quantityValue) || 0,
      total_cost: parseFloat(totalCostValue) || 0,
      user_id: this.userId(),
      document_origin: '',
    };

    if (this.isEditMode() && this.investment()?.id) {
      this.update.emit({
        id: this.investment()!.id!,
        data: investmentData,
      });
    } else {
      this.save.emit(investmentData);
    }

    this.isSubmitting.set(false);
  }

  onClose() {
    this.investmentForm.reset();
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

