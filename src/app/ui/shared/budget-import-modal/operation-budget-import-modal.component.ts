import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
  effect,
  ChangeDetectorRef,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { LucideAngularModule, X, Trash2 } from 'lucide-angular';
import { BudgetService, BudgetCreate } from '../../../infrastructure/services/budget.service';
import {
  BudgetCategoryService,
  BudgetCategory,
  BudgetCategoryCreate,
} from '../../../infrastructure/services/budget-category.service';
import { ToastrService } from 'ngx-toastr';
import { NgSelectModule } from '@ng-select/ng-select';
import { Subject, of, EMPTY } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  map,
} from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

export interface ImportedBudget {
  category_name: string | null;
  month: string | null;
  budget_date: string | null;
  budget_amount: number | null;
  executed_amount: number | null;
  difference_amount: number | null;
  percentage: number | null;
}

@Component({
  selector: 'app-operation-budget-import-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgSelectModule],
  templateUrl: './operation-budget-import-modal.component.html',
  styleUrl: './operation-budget-import-modal.component.scss',
})
export class OperationBudgetImportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private budgetService = inject(BudgetService);
  private budgetCategoryService = inject(BudgetCategoryService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  userId = input.required<number>();
  budgetYearId = input.required<number>();
  budgetYear = input.required<number>();
  importedData = input.required<ImportedBudget[]>();

  // Outputs
  close = output<void>();
  save = output<BudgetCreate[]>();

  budgetForm!: FormGroup;
  readonly icons = { X, Trash2 };
  isSubmitting = signal(false);
  dateErrors = signal<Map<number, string>>(new Map());
  /** Lista completa de categorías (solo se carga una vez al abrir el modal con datos). */
  categories = signal<BudgetCategory[]>([]);
  /** Categorías creadas localmente hasta guardar (id: -1). */
  pendingCategories = signal<Array<{ id: number; name: string; code: string; company_id: number }>>([]);
  /** Resultado del typeahead al escribir; null = mostrar categories sin nueva petición. */
  typeaheadSearchResults = signal<BudgetCategory[] | null>(null);
  isLoadingCategories = signal(false);
  categoryInput$ = new Subject<string>();
  currentSearchTerm = signal<string>('');

  /** Items del ng-select: búsqueda actual o lista completa + pendientes. */
  categoriesList = computed(() => {
    const searchResults = this.typeaheadSearchResults();
    const cats = this.categories();
    const base = searchResults !== null ? searchResults : cats;
    const pending = this.pendingCategories();
    return [...(Array.isArray(base) ? base : []), ...pending];
  });

  get budgetsArray(): FormArray {
    return this.budgetForm.get('budgets') as FormArray;
  }

  constructor() {
    effect(() => {
      const data = this.importedData();
      if (data && data.length > 0) {
        this.loadCategoriesThenInitializeForm(data);
      }
    });
  }

  ngOnInit() {
    this.budgetForm = this.fb.group({
      budgets: this.fb.array([]),
    });
    this.setupTypeahead();
    const data = this.importedData();
    if (data?.length > 0) {
      this.loadCategoriesThenInitializeForm(data);
    }
  }

  /**
   * Carga categorías una sola vez con el endpoint y luego inicializa el formulario.
   * Así cada fila del archivo puede resolverse: existe → se asigna; no existe → LOCAL (pendiente).
   */
  loadCategoriesThenInitializeForm(data: ImportedBudget[]): void {
    const companyId = this.companyId();
    if (!companyId) return;
    this.isLoadingCategories.set(true);
    this.typeaheadSearchResults.set(null);
    this.budgetCategoryService.getByCompany(companyId).subscribe({
      next: (categories) => {
        this.categories.set(Array.isArray(categories) ? categories : []);
        this.isLoadingCategories.set(false);
        this.initializeForm(data);
      },
      error: () => {
        this.isLoadingCategories.set(false);
        this.initializeForm(data);
      },
    });
  }

  /**
   * Typeahead: solo busca cuando el usuario escribe. Término vacío = no petición, se muestran categories + pendientes.
   */
  setupTypeahead(): void {
    this.categoryInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((term: string) => {
          this.currentSearchTerm.set(term || '');
          const companyId = this.companyId();
          if (!companyId) return EMPTY;
          const trimmed = (term || '').trim();
          if (trimmed.length === 0) {
            this.typeaheadSearchResults.set(null);
            this.isLoadingCategories.set(false);
            return EMPTY;
          }
          this.isLoadingCategories.set(true);
          return this.budgetCategoryService.search(companyId, trimmed).pipe(
            map((categories) => ({ results: Array.isArray(categories) ? categories : [] })),
            catchError(() => {
              this.isLoadingCategories.set(false);
              return of({ results: [] });
            })
          );
        })
      )
      .subscribe((payload) => {
        if (payload && 'results' in payload) {
          this.typeaheadSearchResults.set(payload.results);
          this.isLoadingCategories.set(false);
        }
      });
  }

  categoryRowValidator(group: AbstractControl): { categoryRequired: boolean } | null {
    const g = group as FormGroup;
    const catVal = g.get('category_id')?.value;
    const nameVal = g.get('category_name_text')?.value;
    const nameText = (nameVal == null ? '' : String(nameVal)).trim();
    const hasCat = catVal != null && (typeof catVal === 'object' ? catVal?.id != null : true);
    return hasCat || nameText.length > 0 ? null : { categoryRequired: true };
  }

  compareCategories(cat1: BudgetCategory | number | null, cat2: BudgetCategory | number | null): boolean {
    if (!cat1 || !cat2) return false;
    if (typeof cat1 === 'object' && typeof cat2 === 'object') {
      if (cat1.id && cat2.id && cat1.id > 0 && cat2.id > 0) return cat1.id === cat2.id;
      if (cat1.name && cat2.name) return cat1.name.toLowerCase() === cat2.name.toLowerCase();
    }
    if (typeof cat1 === 'number' && typeof cat2 === 'object' && cat2.id) return cat1 === cat2.id;
    if (typeof cat2 === 'number' && typeof cat1 === 'object' && cat1.id) return cat2 === cat1.id;
    return cat1 === cat2;
  }

  /**
   * Igual que process-modal (onAddTag): mantiene el valor en el selector.
   * NO crea en BD aquí; se crea al hacer "Guardar Presupuestos".
   */
  onCreateCategoryFromTag(term: string | unknown, rowIndex: number): void {
    let categoryName: string;
    if (typeof term === 'string') {
      categoryName = term;
    } else if (term && typeof term === 'object' && (term as { name?: string }).name) {
      categoryName = (term as { name: string }).name;
    } else if (term && typeof term === 'object' && (term as { value?: string }).value) {
      categoryName = (term as { value: string }).value;
    } else {
      categoryName = this.currentSearchTerm();
    }
    if (!categoryName?.trim()) return;

    const nameTrimmed = categoryName.trim();

    const existing = this.categoriesList().find(
      (c) => c.name.toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (existing) {
      const row = this.budgetsArray.at(rowIndex) as FormGroup;
      row?.patchValue({ category_id: existing, category_name_text: nameTrimmed });
      this.cdr.detectChanges();
      return;
    }

    const companyId = this.companyId();
    if (!companyId) return;

    const code = nameTrimmed.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 20);
    const pending = { id: -1, name: nameTrimmed, code: code || 'CAT', company_id: companyId };

    const current = this.pendingCategories();
    if (!current.some((p) => p.name.toLowerCase() === nameTrimmed.toLowerCase())) {
      this.pendingCategories.set([...current, pending]);
    }

    this.currentSearchTerm.set('');

    // Crítico: actualizar [items] (vía detectChanges) ANTES de patchValue.
    // Si patchValue ocurre primero, ng-select busca el item en la lista antigua y no lo encuentra.
    this.cdr.detectChanges();

    const row = this.budgetsArray.at(rowIndex) as FormGroup;
    const valueToSet = { category_id: pending, category_name_text: nameTrimmed };
    row?.patchValue(valueToSet);
    this.cdr.detectChanges();
  }

  // Fuzzy matching: normalize strings (lowercase, remove spaces)
  normalizeString(str: string): string {
    return str.toLowerCase().replace(/\s+/g, '').trim();
  }

  // Find similar category by name (case-insensitive) en la lista en memoria
  findSimilarCategory(categoryName: string | null): BudgetCategory | null {
    if (!categoryName) return null;
    const normalizedSearch = this.normalizeString(categoryName);
    const allCategories = this.categories();
    const exact = allCategories.find((c) => this.normalizeString(c.name) === normalizedSearch);
    return exact || null;
  }

  /**
   * Resuelve el id de categoría para guardar: valida con el endpoint.
   * Si existe (búsqueda por nombre) devuelve su id; si no existe, crea con el endpoint y devuelve el id.
   */
  async resolveCategoryIdForSubmit(categoryName: string): Promise<number | null> {
    const name = categoryName?.trim();
    if (!name) return null;
    const companyId = this.companyId();
    if (!companyId) return null;
    try {
      const results = await firstValueFrom(this.budgetCategoryService.search(companyId, name));
      const list = Array.isArray(results) ? results : [];
      const exact = list.find((c) => this.normalizeString(c.name) === this.normalizeString(name));
      if (exact) return exact.id;
      const created = await firstValueFrom(
        this.budgetCategoryService.create({
          name,
          code: name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 20) || 'CAT',
          company_id: companyId,
        })
      );
      if (created?.id) {
        this.categories.update((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
        return created.id;
      }
    } catch (err) {
      console.error('resolveCategoryIdForSubmit', err);
    }
    return null;
  }

  /**
   * Inicializa el formulario con los datos importados.
   * Para cada fila con categoría: busca en la lista cargada; si existe la asigna, si no existe la deja como LOCAL (pendiente).
   */
  initializeForm(data: ImportedBudget[]) {
    this.pendingCategories.set([]);
    this.typeaheadSearchResults.set(null);
    const allCategories = this.categories();
    const formatAmount = (amount: number | null): string => {
      if (amount === null || amount === undefined || isNaN(amount)) return '';
      if (amount % 1 === 0) {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      const parts = amount.toFixed(2).split('.');
      const integerPart = parts[0];
      const decimalPart = parts[1];
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${formattedInteger}.${decimalPart}`;
    };

    const budgetGroups = data.map((budget) => {
      const budgetAmount = budget.budget_amount ?? 0;
      const executedAmount = budget.executed_amount ?? 0;
      const difference = budgetAmount - executedAmount;
      const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

      // Format date to YYYY-MM format for month input
      let dateValue = '';
      if (budget.budget_date) {
        const dateStr = budget.budget_date;
        if (dateStr.match(/^\d{4}-\d{2}$/)) {
          dateValue = dateStr;
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateValue = dateStr.substring(0, 7);
        } else {
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              dateValue = `${year}-${month}`;
            }
          } catch (e) {
            console.warn('Error parsing date:', dateStr);
          }
        }
      }

      // Categoría: buscar en endpoint (ya cargado). Si existe → asignar; si no → LOCAL (pendiente).
      const categoryName = budget.category_name?.trim() || null;
      let selectedCategory: BudgetCategory | { id: number; name: string; code: string; company_id: number } | null = null;
      if (categoryName) {
        const exact = allCategories.find((c) => this.normalizeString(c.name) === this.normalizeString(categoryName));
        if (exact) {
          selectedCategory = exact;
        } else {
          const companyId = this.companyId();
          if (companyId) {
            const currentPending = this.pendingCategories().find((p) => p.name.toLowerCase() === categoryName.toLowerCase());
            if (currentPending) {
              selectedCategory = currentPending;
            } else {
              const code = categoryName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 20) || 'CAT';
              const pending = { id: -1, name: categoryName, code, company_id: companyId };
              this.pendingCategories.update((prev) => [...prev, pending]);
              selectedCategory = pending;
            }
          }
        }
      }

      return this.fb.group(
        {
          category_id: [selectedCategory],
          category_name_text: [categoryName],
          budget_date: [dateValue, Validators.required],
          budget_amount: [
            budget.budget_amount != null ? formatAmount(budget.budget_amount) : '',
            [Validators.required, this.currencyValidator],
          ],
          executed_amount: [
            budget.executed_amount != null ? formatAmount(budget.executed_amount) : '',
            [Validators.required, this.currencyValidator],
          ],
          difference_amount: [{ value: formatAmount(difference), disabled: true }],
          percentage: [{ value: percentage.toFixed(2), disabled: true }],
        },
        { validators: [this.categoryRowValidator.bind(this)] }
      );
    });

    this.budgetForm = this.fb.group({
      budgets: this.fb.array(budgetGroups),
    });

    this.cdr.detectChanges();

    // Watch for changes to recalculate difference and percentage
    this.budgetsArray.controls.forEach((control, index) => {
      control.get('budget_amount')?.valueChanges.subscribe(() => {
        this.recalculateRow(index);
      });
      control.get('executed_amount')?.valueChanges.subscribe(() => {
        this.recalculateRow(index);
      });
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

  formatNumberWithCommas(value: number | string): string {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    
    if (isNaN(numValue) || numValue === null || numValue === undefined) return '';
    
    if (numValue % 1 === 0) {
      return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    const parts = numValue.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return `${formattedInteger}.${decimalPart}`;
  }

  recalculateRow(index: number) {
    const control = this.budgetsArray.at(index);
    const budgetAmountStr = control.get('budget_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
    const executedAmountStr = control.get('executed_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
    const budgetAmount = parseFloat(budgetAmountStr);
    const executedAmount = parseFloat(executedAmountStr);
    const difference = budgetAmount - executedAmount;
    const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

    control.patchValue(
      {
        difference_amount: this.formatNumberWithCommas(difference),
        percentage: percentage.toFixed(2),
      },
      { emitEvent: false }
    );
  }

  formatCurrency(event: Event, index: number, field: 'budget_amount' | 'executed_amount') {
    const investmentGroup = this.budgetsArray.at(index) as FormGroup;
    if (!investmentGroup) return;
    
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');
    if (value.trim() === '') {
      input.value = '';
      investmentGroup.patchValue({ [field]: '' }, { emitEvent: true });
      this.recalculateRow(index);
      this.cdr.detectChanges();
      return;
    }
    
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
    investmentGroup.patchValue({ [field]: formatted }, { emitEvent: true });
    this.recalculateRow(index);
    this.cdr.detectChanges();
  }

  formatCurrencyOnBlur(index: number, field: 'budget_amount' | 'executed_amount') {
    const investmentGroup = this.budgetsArray.at(index) as FormGroup;
    if (!investmentGroup) return;
    
    const control = investmentGroup.get(field);
    if (!control) return;

    const rawValue = control.value?.toString() ?? '';
    if (rawValue.trim() === '') {
      control.setValue('', { emitEvent: true });
      this.recalculateRow(index);
      return;
    }

    let value = rawValue.replace(/[^0-9.]/g, '');
    const numValue = parseFloat(value) || 0;
    const formatted = this.formatNumberWithCommas(numValue);
    control.setValue(formatted, { emitEvent: true });
    this.recalculateRow(index);
  }

  removeBudget(index: number) {
    this.budgetsArray.removeAt(index);
    this.cdr.detectChanges();
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      if (!this.isSubmitting()) {
        this.onClose();
      }
    }
  }

  onClose() {
    this.close.emit();
  }

  getTotalBudget(): number {
    let total = 0;
    this.budgetsArray.controls.forEach((control) => {
      const budgetAmountStr = control.get('budget_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
      const budgetAmount = parseFloat(budgetAmountStr);
      total += budgetAmount;
    });
    return total;
  }

  getTotalExecuted(): number {
    let total = 0;
    this.budgetsArray.controls.forEach((control) => {
      const executedAmountStr = control.get('executed_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '0';
      const executedAmount = parseFloat(executedAmountStr);
      total += executedAmount;
    });
    return total;
  }

  // Check if all required fields are filled
  areAllFieldsValid(): boolean {
    if (this.budgetsArray.length === 0) {
      return false;
    }

    return this.budgetsArray.controls.every((control) => {
      const categoryValue = control.get('category_id')?.value;
      const categoryNameText = (control.get('category_name_text')?.value || '').trim();
      const hasCategory = categoryValue != null && (typeof categoryValue === 'object' ? categoryValue?.id : true);
      const budgetDate = control.get('budget_date')?.value;
      const budgetAmountRaw = control.get('budget_amount')?.value;
      const executedAmountRaw = control.get('executed_amount')?.value;
      const hasBudgetAmountValue = budgetAmountRaw !== null && budgetAmountRaw !== undefined && String(budgetAmountRaw).trim() !== '';
      const hasExecutedAmountValue = executedAmountRaw !== null && executedAmountRaw !== undefined && String(executedAmountRaw).trim() !== '';
      const budgetAmountStr = hasBudgetAmountValue ? String(budgetAmountRaw).replace(/[^0-9.-]/g, '') : '';
      const executedAmountStr = hasExecutedAmountValue ? String(executedAmountRaw).replace(/[^0-9.-]/g, '') : '';

      const budgetAmount = parseFloat(budgetAmountStr);
      const executedAmount = parseFloat(executedAmountStr);

      return (
        (hasCategory || categoryNameText.length > 0) &&
        budgetDate &&
        budgetDate.trim() !== '' &&
        hasBudgetAmountValue &&
        !isNaN(budgetAmount) &&
        budgetAmount >= 0 &&
        hasExecutedAmountValue &&
        !isNaN(executedAmount) &&
        executedAmount >= 0
      );
    });
  }

  async onSubmit() {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      this.toastr.error('Por favor, completa todos los campos requeridos', 'Error');
      return;
    }

    if (this.budgetsArray.length === 0) {
      this.toastr.error('Debe haber al menos un presupuesto para guardar', 'Error');
      return;
    }

    this.isSubmitting.set(true);

    const budgets: BudgetCreate[] = [];

    for (const control of this.budgetsArray.controls) {
      if (control.invalid) {
        continue; // Skip invalid rows
      }

      const budgetData = control.value;

      // Convert date from YYYY-MM (month input) to YYYY-MM-01 format for backend
      let budgetDate = '';
      if (budgetData.budget_date) {
        if (typeof budgetData.budget_date === 'string' && budgetData.budget_date.match(/^\d{4}-\d{2}$/)) {
          budgetDate = `${budgetData.budget_date}-01`;
        } else if (typeof budgetData.budget_date === 'string' && budgetData.budget_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          budgetDate = budgetData.budget_date;
        } else {
          const date = new Date(budgetData.budget_date);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            budgetDate = `${year}-${month}-01`;
          }
        }
      }

      // Parse currency values
      const budgetAmountValue = budgetData.budget_amount?.toString().replace(/[^0-9.]/g, '') || '0';
      const executedAmountValue = budgetData.executed_amount?.toString().replace(/[^0-9.]/g, '') || '0';
      const budgetAmount = parseFloat(budgetAmountValue) || 0;
      const executedAmount = parseFloat(executedAmountValue) || 0;
      const differenceAmount = budgetAmount - executedAmount;
      const percentage = budgetAmount > 0 ? (executedAmount / budgetAmount) * 100 : 0;

      if (!budgetDate) {
        continue; // Skip if no valid date
      }

      // Obtener id de categoría: si ya tiene id de BD usarlo; si no, validar con endpoint y crear si hace falta
      let categoryId: number | null = null;
      const catVal = budgetData.category_id;
      if (catVal != null && typeof catVal === 'object' && catVal.id != null && catVal.id > 0) {
        categoryId = catVal.id;
      }
      if (categoryId == null) {
        let categoryNameForSubmit: string | null = null;
        if (catVal != null && typeof catVal === 'object' && catVal.name) {
          categoryNameForSubmit = String(catVal.name).trim();
        }
        if (!categoryNameForSubmit && budgetData.category_name_text) {
          categoryNameForSubmit = String(budgetData.category_name_text).trim();
        }
        if (!categoryNameForSubmit) continue;
        categoryId = await this.resolveCategoryIdForSubmit(categoryNameForSubmit);
        if (categoryId == null) {
          this.toastr.error(`No se pudo crear o encontrar la categoría "${categoryNameForSubmit}"`, 'Error');
          this.isSubmitting.set(false);
          return;
        }
      }

      budgets.push({
        operation_budget_category_id: categoryId,
        company_id: this.companyId(),
        operation_budget_annual_id: this.budgetYearId() || null,
        budget_date: budgetDate,
        budget_amount: budgetAmount,
        executed_amount: executedAmount,
        difference_amount: differenceAmount,
        percentage: percentage,
      });
    }

    if (budgets.length === 0) {
      this.toastr.error('No hay presupuestos válidos para guardar', 'Error');
      this.isSubmitting.set(false);
      return;
    }

    this.save.emit(budgets);
  }
}

