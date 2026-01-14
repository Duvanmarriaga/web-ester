import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { LucideAngularModule, X } from 'lucide-angular';
import { Company, CompanyCreate, CompanyUpdate } from '../../../entities/interfaces';

@Component({
  selector: 'app-company-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
  ],
  templateUrl: './company-modal.component.html',
  styleUrl: './company-modal.component.scss',
})
export class CompanyModalComponent implements OnInit {
  private fb = inject(FormBuilder);

  // Inputs
  isVisible = input.required<boolean>();
  company = input<Company | null>(null);

  // Outputs
  close = output<void>();
  save = output<{ company: CompanyCreate | Partial<Company> }>();

  companyForm!: FormGroup;
  readonly icons = { X };

  constructor() {
    // Initialize form when company changes
    effect(() => {
      const currentCompany = this.company();
      if (currentCompany) {
        this.initFormForEdit(currentCompany);
      } else {
        this.initFormForCreate();
      }
    });
  }

  ngOnInit() {
    if (!this.companyForm) {
      this.initFormForCreate();
    }
  }

  initFormForCreate() {
    this.companyForm = this.fb.group({
      name: ['', Validators.required],
      identification_number: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: ['', Validators.required],
    });
  }

  initFormForEdit(company: Company) {
    this.companyForm = this.fb.group({
      name: [company.name, Validators.required],
      identification_number: [company.identification_number, Validators.required],
      email: [company.email, [Validators.required, Validators.email]],
      phone: [company.phone || ''],
      address: [company.address, Validators.required],
    });
  }

  get isEditing(): boolean {
    return !!this.company();
  }

  onSubmit() {
    if (this.companyForm.valid) {
      if (this.isEditing) {
        const company = this.company()!;
        this.save.emit({
          company: { id: company.id, ...this.companyForm.value },
        });
      } else {
        this.save.emit({
          company: this.companyForm.value as CompanyCreate,
        });
      }
    }
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: Event) {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.onClose();
    }
  }
}
