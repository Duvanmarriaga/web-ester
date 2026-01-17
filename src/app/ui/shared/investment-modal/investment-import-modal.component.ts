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
import { ToastrService } from 'ngx-toastr';

export interface ImportedInvestment {
  description: string | null;
  amount: number | null;
  executed_amount: number | null;
}

@Component({
  selector: 'app-investment-import-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './investment-import-modal.component.html',
  styleUrl: './investment-import-modal.component.scss',
})
export class InvestmentImportModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private investmentService = inject(InvestmentService);

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
    this.investmentForm = this.fb.group({
      investments: this.fb.array([]),
    });

    const importedData = this.importedData();
    if (importedData.length > 0 && this.isVisible()) {
      importedData.forEach((data) => {
        if (data.description || data.amount !== null || data.executed_amount !== null) {
          this.addInvestmentRow(data);
        }
      });
      this.cdr.detectChanges();
    }
  }

  addInvestmentRow(data: ImportedInvestment): void {
    const descriptionValue = data.description || '';
    const amountValue = data.amount !== null && data.amount !== undefined && !isNaN(data.amount) 
      ? this.formatNumberWithCommas(data.amount) 
      : '';
    
    const executedAmountValue = data.executed_amount !== null && data.executed_amount !== undefined && !isNaN(data.executed_amount) 
      ? this.formatNumberWithCommas(data.executed_amount) 
      : '';

    const index = this.investmentsArray.length;
    const investmentGroup = this.fb.group({
      description: [descriptionValue, [Validators.required]],
      amount: [amountValue, [Validators.required, this.currencyValidator]],
      executed_amount: [executedAmountValue, [Validators.required, this.currencyValidator]],
      variance: [0],
      percentage_variance: [0],
    });

    // Calculate variance when values change
    investmentGroup.get('amount')?.valueChanges.subscribe(() => {
      this.recalculateVarianceForRow(index);
    });
    investmentGroup.get('executed_amount')?.valueChanges.subscribe(() => {
      this.recalculateVarianceForRow(index);
    });

    this.investmentsArray.push(investmentGroup);
  }

  recalculateVarianceForRow(index: number): void {
    const investmentGroup = this.investmentsArray.at(index) as FormGroup;
    if (!investmentGroup) return;

    const amountControl = investmentGroup.get('amount');
    const executedAmountControl = investmentGroup.get('executed_amount');
    
    if (!amountControl || !executedAmountControl) return;

    const amountStr = amountControl.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const executedAmountStr = executedAmountControl.value?.toString().replace(/[^0-9.]/g, '') || '0';
    
    const amount = parseFloat(amountStr) || 0;
    const executedAmount = parseFloat(executedAmountStr) || 0;
    
    const variance = amount - executedAmount;
    const percentageVariance = amount > 0 ? (variance / amount) * 100 : 0;
    
    investmentGroup.patchValue({
      variance: variance,
      percentage_variance: percentageVariance,
    }, { emitEvent: false });
  }

  currencyValidator(control: any) {
    if (!control.value) return null;
    const value = parseFloat(control.value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(value) || value < 0) {
      return { invalidCurrency: true };
    }
    return null;
  }

  formatCurrency(event: Event, index: number, fieldName: 'amount' | 'executed_amount'): void {
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
    investmentGroup.patchValue({ [fieldName]: formatted }, { emitEvent: true });
    this.cdr.detectChanges();
  }

  formatCurrencyOnBlur(index: number, fieldName: 'amount' | 'executed_amount'): void {
    const investmentGroup = this.investmentsArray.at(index) as FormGroup;
    if (!investmentGroup) return;
    
    const control = investmentGroup.get(fieldName);
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
      
      const amountValue = investmentData.amount?.toString().replace(/[^0-9.]/g, '') || '0';
      const executedAmountValue = investmentData.executed_amount?.toString().replace(/[^0-9.]/g, '') || '0';
      
      const amount = parseFloat(amountValue) || 0;
      const executedAmount = parseFloat(executedAmountValue) || 0;
      const variance = amount - executedAmount;
      const percentageVariance = amount > 0 ? (variance / amount) * 100 : 0;

      investments.push({
        company_id: this.companyId(),
        investment_budget_annual_id: this.budgetYearId(),
        description: investmentData.description?.trim() || null,
        amount: amount,
        executed_amount: executedAmount,
        variance: variance,
        percentage_variance: percentageVariance,
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
      const description = control.get('description')?.value?.trim() || '';
      const amountStr = control.get('amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '';
      const executedAmountStr = control.get('executed_amount')?.value?.toString().replace(/[^0-9.-]/g, '') || '';
      const amount = parseFloat(amountStr);
      const executedAmount = parseFloat(executedAmountStr);

      return (
        description.length > 0 &&
        !isNaN(amount) &&
        amount >= 0 &&
        !isNaN(executedAmount) &&
        executedAmount >= 0
      );
    });
  }
}
