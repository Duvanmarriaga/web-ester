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
  InvestmentBudgetYearService,
  InvestmentBudgetYear,
} from '../../../infrastructure/services/investment-budget-year.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { FileUploadComponent } from '../file-upload/file-upload.component';

@Component({
  selector: 'app-investment-budget-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    FileUploadComponent,
  ],
  templateUrl: './investment-budget-modal.component.html',
  styleUrl: './investment-budget-modal.component.scss',
})
export class InvestmentBudgetModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private investmentService = inject(InvestmentService);
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
  budgetYears = signal<InvestmentBudgetYear[]>([]);
  isLoadingBudgetYears = signal(false);

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
              investment_budget_annual_id: annualId,
              description: '',
              amount: '0',
              executed_amount: '0',
            });
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.investmentForm = this.fb.group({
      investment_budget_annual_id: [null],
      description: ['', [Validators.required]],
      amount: ['0', [Validators.required, this.currencyValidator]],
      executed_amount: ['0', [Validators.required, this.currencyValidator]],
      variance: [0],
      percentage_variance: [0],
    });

    // Calculate variance and percentage when amount or executed_amount changes
    this.investmentForm.get('amount')?.valueChanges.subscribe(() => {
      this.recalculateVariance();
    });

    this.investmentForm.get('executed_amount')?.valueChanges.subscribe(() => {
      this.recalculateVariance();
    });

    // Load budget years
    this.loadBudgetYears();

    if (this.investment() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.investment()!);
    }
  }

  recalculateVariance(): void {
    const amountControl = this.investmentForm.get('amount');
    const executedAmountControl = this.investmentForm.get('executed_amount');
    
    if (!amountControl || !executedAmountControl) return;

    const amountStr = amountControl.value?.toString().replace(/[^0-9.]/g, '') || '0';
    const executedAmountStr = executedAmountControl.value?.toString().replace(/[^0-9.]/g, '') || '0';
    
    const amount = parseFloat(amountStr) || 0;
    const executedAmount = parseFloat(executedAmountStr) || 0;
    
    // Calculate variance: amount - executed_amount
    const variance = amount - executedAmount;
    
    // Calculate percentage variance: (variance / amount) * 100
    const percentageVariance = amount > 0 ? (variance / amount) * 100 : 0;
    
    // Store calculated values (they will be sent to API)
    this.investmentForm.patchValue({
      variance: variance,
      percentage_variance: percentageVariance,
    }, { emitEvent: false });
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
    fieldName: 'amount' | 'executed_amount'
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
    fieldName: 'amount' | 'executed_amount'
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

  formatCurrencyOnBlur(fieldName: 'amount' | 'executed_amount'): void {
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

    const executedAmount =
      typeof investment.executed_amount === 'number'
        ? investment.executed_amount
        : parseFloat((investment.executed_amount as any) || '0') || 0;

    this.investmentForm.patchValue(
      {
        investment_budget_annual_id: investment.investment_budget_annual_id || null,
        description: investment.description || '',
        amount: this.formatNumberWithCommas(amount),
        executed_amount: this.formatNumberWithCommas(executedAmount),
      },
      { emitEvent: false }
    );

    // Recalculate variance after populating form
    this.recalculateVariance();
  }

  async onSubmit() {
    if (this.investmentForm.invalid) {
      this.investmentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    // Recalculate variance before submitting
    this.recalculateVariance();

    let formValue = { ...this.investmentForm.value };

    const amountValue =
      formValue.amount?.toString().replace(/[^0-9.]/g, '') || '0';
    const executedAmountValue =
      formValue.executed_amount?.toString().replace(/[^0-9.]/g, '') || '0';

    // Always get investment_budget_annual_id from the investment input (context)
    const currentInvestment = this.investment();
    const annualId = currentInvestment?.investment_budget_annual_id || formValue.investment_budget_annual_id || null;

    const amount = parseFloat(amountValue) || 0;
    const executedAmount = parseFloat(executedAmountValue) || 0;
    const variance = amount - executedAmount;
    const percentageVariance = amount > 0 ? (variance / amount) * 100 : 0;

    const investmentData: InvestmentCreate = {
      investment_budget_annual_id: annualId,
      company_id: this.companyId(),
      description: formValue.description?.trim() || null,
      amount: amount,
      executed_amount: executedAmount,
      variance: variance,
      percentage_variance: percentageVariance,
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

}

