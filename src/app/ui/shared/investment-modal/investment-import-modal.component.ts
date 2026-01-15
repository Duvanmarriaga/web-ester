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
} from '@angular/forms';
import { LucideAngularModule, X, Trash2 } from 'lucide-angular';
import { InvestmentService, InvestmentCreate } from '../../../infrastructure/services/investment.service';
import { InvestmentCategoryService, InvestmentCategory } from '../../../infrastructure/services/investment-category.service';
import { ToastrService } from 'ngx-toastr';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom } from 'rxjs';

export interface ImportedInvestment {
  category_name: string | null;
  amount: number | null;
}

@Component({
  selector: 'app-investment-import-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgSelectModule],
  templateUrl: './investment-import-modal.component.html',
  styleUrl: './investment-import-modal.component.scss',
})
export class InvestmentImportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private investmentService = inject(InvestmentService);
  private investmentCategoryService = inject(InvestmentCategoryService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  budgetYearId = input.required<number>();
  budgetYear = input.required<number>();
  importedData = input.required<ImportedInvestment[]>();
  
  // Outputs
  close = output<void>();
  save = output<InvestmentCreate[]>();

  investmentForm!: FormGroup;
  readonly icons = { X, Trash2 };
  isSubmitting = signal(false);
  categories = signal<InvestmentCategory[]>([]);
  isLoadingCategories = signal(false);

  get investmentsArray(): FormArray {
    return this.investmentForm.get('investments') as FormArray;
  }

  constructor() {
    effect(() => {
      const importedData = this.importedData();
      const isVisible = this.isVisible();
      
      if (isVisible && importedData.length > 0 && this.investmentForm) {
        while (this.investmentsArray.length !== 0) {
          this.investmentsArray.removeAt(0);
        }
        
        importedData.forEach((data) => {
          this.addInvestmentRow(data);
        });
        this.cdr.detectChanges();
      }
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.investmentForm = this.fb.group({
      investments: this.fb.array([]),
    });

    const importedData = this.importedData();
    if (importedData.length > 0 && this.isVisible()) {
      importedData.forEach((data) => {
        if (data.category_name || data.amount !== null) {
          this.addInvestmentRow(data);
        }
      });
      this.cdr.detectChanges();
    }
  }

  loadCategories(): void {
    this.isLoadingCategories.set(true);
    this.investmentCategoryService.getByCompany(this.companyId()).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.isLoadingCategories.set(false);
      },
      error: (error: unknown) => {
        console.error('Error loading categories:', error);
        this.isLoadingCategories.set(false);
      },
    });
  }

  // Fuzzy matching: normalize strings (lowercase, remove spaces)
  normalizeString(str: string): string {
    return str.toLowerCase().replace(/\s+/g, '').trim();
  }

  // Find similar category by name (case-insensitive, space-insensitive)
  findSimilarCategory(categoryName: string | null): InvestmentCategory | null {
    if (!categoryName) return null;
    
    const normalizedSearch = this.normalizeString(categoryName);
    const allCategories = this.categories();
    
    // First try exact match (normalized)
    const exactMatch = allCategories.find(cat => 
      this.normalizeString(cat.name) === normalizedSearch
    );
    if (exactMatch) return exactMatch;
    
    // Then try contains match (normalized)
    const containsMatch = allCategories.find(cat => 
      this.normalizeString(cat.name).includes(normalizedSearch) ||
      normalizedSearch.includes(this.normalizeString(cat.name))
    );
    if (containsMatch) return containsMatch;
    
    return null;
  }

  // Create category if it doesn't exist
  async createCategoryIfNeeded(categoryName: string): Promise<InvestmentCategory | null> {
    if (!categoryName || !categoryName.trim()) return null;
    
    // Check if it already exists (fuzzy match)
    const existing = this.findSimilarCategory(categoryName);
    if (existing) return existing;
    
    // Create new category
    try {
      const newCategory = await firstValueFrom(
        this.investmentCategoryService.create({
          name: categoryName.trim(),
          code: categoryName.trim().toUpperCase().substring(0, 10).replace(/\s+/g, '_'),
          company_id: this.companyId(),
        })
      );
      
      if (newCategory) {
        // Add to local list
        this.categories.set([...this.categories(), newCategory]);
        return newCategory;
      }
    } catch (error) {
      console.error('Error creating category:', error);
    }
    
    return null;
  }

  addInvestmentRow(data: ImportedInvestment): void {
    const amountValue = data.amount !== null && data.amount !== undefined && !isNaN(data.amount) 
      ? this.formatNumberWithCommas(data.amount) 
      : '';

    // Try to find similar category
    const categoryName = data.category_name || '';
    const similarCategory = this.findSimilarCategory(categoryName);
    const selectedCategory = similarCategory || null;

    const index = this.investmentsArray.length;
    const investmentGroup = this.fb.group({
      category_id: [selectedCategory?.id || null, Validators.required],
      category_name_text: [categoryName, Validators.required], // Keep original text for reference
      amount: [amountValue, [Validators.required, this.currencyValidator]],
    });

    this.investmentsArray.push(investmentGroup);
  }

  currencyValidator(control: any) {
    if (!control.value) return null;
    const value = parseFloat(control.value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(value) || value < 0) {
      return { invalidCurrency: true };
    }
    return null;
  }

  formatCurrency(event: Event, index: number): void {
    const investmentGroup = this.investmentsArray.at(index) as FormGroup;
    if (!investmentGroup) return;
    
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
    investmentGroup.patchValue({ amount: formatted }, { emitEvent: true });
    this.cdr.detectChanges();
  }

  formatCurrencyOnBlur(index: number): void {
    const investmentGroup = this.investmentsArray.at(index) as FormGroup;
    if (!investmentGroup) return;
    
    const control = investmentGroup.get('amount');
    if (!control) return;
    
    let value = control.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const numValue = parseFloat(value) || 0;
    const formatted = this.formatNumberWithCommas(numValue);
    control.setValue(formatted, { emitEvent: true });
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

  removeInvestment(index: number): void {
    if (index >= 0 && index < this.investmentsArray.length) {
      this.investmentsArray.removeAt(index);
      this.cdr.detectChanges();
    }
  }

  async onSubmit() {
    if (this.investmentForm.invalid) {
      this.investmentForm.markAllAsTouched();
      this.toastr.error('Por favor, completa todos los campos requeridos', 'Error');
      return;
    }

    if (this.investmentsArray.length === 0) {
      this.toastr.error('Debe haber al menos una inversión para guardar', 'Error');
      return;
    }

    this.isSubmitting.set(true);

    const investments: InvestmentCreate[] = [];

    for (const control of this.investmentsArray.controls) {
      if (control.invalid) {
        continue;
      }
      
      const investmentData = control.value;
      
      // Get category ID - use selected category_id or create from category_name_text
      let categoryId: number | null = null;
      
      if (investmentData.category_id) {
        // Category was selected from dropdown
        categoryId = investmentData.category_id;
      } else if (investmentData.category_name_text) {
        // Category was not selected, try to find similar or create
        const categoryName = investmentData.category_name_text.trim();
        if (categoryName) {
          // Try to find similar category first
          const similarCategory = this.findSimilarCategory(categoryName);
          if (similarCategory) {
            categoryId = similarCategory.id;
          } else {
            // Create new category
            const newCategory = await this.createCategoryIfNeeded(categoryName);
            if (newCategory) {
              categoryId = newCategory.id;
            } else {
              this.toastr.error(`No se pudo crear la categoría "${categoryName}"`, 'Error');
              this.isSubmitting.set(false);
              return;
            }
          }
        }
      }

      if (!categoryId) {
        continue; // Skip if no category
      }

      const amountValue = investmentData.amount?.toString().replace(/[^0-9.]/g, '') || '0';
      const amount = parseFloat(amountValue) || 0;

      investments.push({
        company_id: this.companyId(),
        investment_budget_annual_id: this.budgetYearId(),
        investment_budget_category_id: categoryId,
        amount: amount,
      });
    }

    if (investments.length === 0) {
      this.toastr.error('No hay inversiones válidas para guardar', 'Error');
      this.isSubmitting.set(false);
      return;
    }

    this.save.emit(investments);
    this.isSubmitting.set(false);
  }

  onClose() {
    this.investmentForm.reset();
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }

  // Check if all required fields are filled
  areAllFieldsValid(): boolean {
    if (this.investmentsArray.length === 0) {
      return false;
    }

    return this.investmentsArray.controls.every((control) => {
      const categoryId = control.get('category_id')?.value;
      const amountStr = control.get('amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '';
      const amount = parseFloat(amountStr);

      return (
        categoryId !== null &&
        categoryId !== undefined &&
        !isNaN(amount) &&
        amount > 0
      );
    });
  }
}
