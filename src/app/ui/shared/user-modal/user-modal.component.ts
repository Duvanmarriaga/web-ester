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
  FormControl,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  User,
  UserCreate,
  UserType,
  Company,
  USER_TYPES,
} from '../../../entities/interfaces';
import { selectAllCompanies } from '../../../infrastructure/store/company';
import * as CompanyActions from '../../../infrastructure/store/company/company.actions';
import { LucideAngularModule, X, Eye, EyeOff } from 'lucide-angular';

@Component({
  selector: 'app-user-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectModule,
    LucideAngularModule,
  ],
  templateUrl: './user-modal.component.html',
  styleUrl: './user-modal.component.scss',
})
export class UserModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);

  // Inputs
  isVisible = input.required<boolean>();
  user = input<User | null>(null);

  // Outputs
  close = output<void>();
  save = output<{ user: UserCreate | Partial<User> }>();

  userForm!: FormGroup;
  companies = signal<Company[]>([]);
  userTypes = USER_TYPES; // Tipos de usuario desde entities
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  readonly icons = { X, Eye, EyeOff };

  constructor() {
    // Subscribe to companies from store (only once)
    this.store.select(selectAllCompanies).subscribe((companies) => {
      this.companies.set(companies);
    });

    // Initialize form when user changes
    effect(() => {
      const currentUser = this.user();
      if (currentUser) {
        this.initFormForEdit(currentUser);
      } else {
        this.initFormForCreate();
      }
    });

    // Load companies only when modal becomes visible
    effect(() => {
      const visible = this.isVisible();
      if (visible) {
        // Dispatch load companies only when modal opens
        this.store.dispatch(CompanyActions.loadCompanies());
      }
    });
  }

  ngOnInit() {
    if (!this.userForm) {
      this.initFormForCreate();
    }
  }

  initFormForCreate() {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, this.passwordValidator]],
      confirmPassword: ['', [Validators.required]],
      type: [UserType.COMPANY, Validators.required],
      companies_ids: [[]], // Array de IDs de compañías
    }, { validators: this.passwordMatchValidator });
    
    // Actualizar validación cuando cambie la contraseña
    this.userForm.get('password')?.valueChanges.subscribe(() => {
      this.userForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  initFormForEdit(user: User) {
    // Extraer IDs de compañías del usuario
    // user.companies puede ser un array de UserCompany[] o number[]
    let companyIds: number[] = [];
    if (user.companies) {
      const companies = user.companies as unknown;
      if (Array.isArray(companies) && companies.length > 0) {
        const firstItem = companies[0];
        // Si es array de objetos UserCompany, extraer los IDs
        if (typeof firstItem === 'object' && firstItem !== null && 'id' in firstItem) {
          companyIds = (companies as any[]).map((c: any) => 
            typeof c === 'object' && c !== null && 'id' in c ? c.id : c
          ).filter((id: any): id is number => typeof id === 'number');
        } else if (typeof firstItem === 'number') {
          // Si es array de números directamente
          companyIds = (companies as any[]).filter((id: any): id is number => typeof id === 'number');
        }
      }
    }

    this.userForm = this.fb.group({
      name: [user.name, Validators.required],
      email: [user.email, [Validators.required, Validators.email]],
      password: [''],
      confirmPassword: [''],
      type: [user.type, Validators.required],
      companies_ids: [companyIds], // Array de IDs para ng-select
    });
    // Password is optional when editing
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('confirmPassword')?.clearValidators();
    this.userForm.get('confirmPassword')?.updateValueAndValidity();
  }

  get isEditing(): boolean {
    return !!this.user();
  }

  onSubmit() {
    if (this.userForm.valid) {
      const formValue = this.userForm.value;
      
      // Asegurar que companies_ids sea un array de números
      const companyIds: number[] = Array.isArray(formValue.companies_ids) 
        ? formValue.companies_ids.filter((id: any): id is number => typeof id === 'number')
        : [];
      
      if (this.isEditing) {
        const user = this.user()!;
        this.save.emit({
          user: {
            id: user.id,
            name: formValue.name,
            email: formValue.email,
            type: formValue.type,
            companies_ids: companyIds,
          },
        });
      } else {
        this.save.emit({
          user: {
            name: formValue.name,
            email: formValue.email,
            password: formValue.password,
            type: formValue.type,
            companies_ids: companyIds,
            clients_ids: [],
          } as UserCreate,
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

  togglePasswordVisibility() {
    this.showPassword.update(val => !val);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update(val => !val);
  }

  // Validador personalizado para verificar que las contraseñas coincidan
  passwordMatchValidator(formGroup: FormGroup): { [key: string]: boolean } | null {
    const password = formGroup.get('password');
    const confirmPassword = formGroup.get('confirmPassword');
    
    if (password && confirmPassword && password.value && confirmPassword.value) {
      if (password.value !== confirmPassword.value) {
        confirmPassword.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        confirmPassword.setErrors(null);
      }
    }
    return null;
  }

  // Getter para verificar si las contraseñas no coinciden
  get passwordsDoNotMatch(): boolean {
    const confirmPassword = this.userForm.get('confirmPassword');
    return !!(confirmPassword?.hasError('passwordMismatch') && confirmPassword.touched);
  }

  // Validador personalizado para contraseña
  passwordValidator(control: FormControl): { [key: string]: boolean } | null {
    if (!control.value) {
      return null; // Dejar que Validators.required maneje el caso vacío
    }

    const password = control.value;
    const errors: { [key: string]: boolean } = {};

    // Mínimo 6 caracteres
    if (password.length < 6) {
      errors['passwordMinLength'] = true;
    }

    // Debe tener al menos una mayúscula
    if (!/[A-Z]/.test(password)) {
      errors['passwordUppercase'] = true;
    }

    // Debe tener al menos una minúscula
    if (!/[a-z]/.test(password)) {
      errors['passwordLowercase'] = true;
    }

    // Debe tener al menos un carácter especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors['passwordSpecialChar'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  // Getters para verificar errores específicos de contraseña
  get passwordErrors(): { minLength: boolean; uppercase: boolean; lowercase: boolean; specialChar: boolean } {
    const passwordControl = this.userForm.get('password');
    return {
      minLength: !!(passwordControl?.hasError('passwordMinLength') && passwordControl.touched),
      uppercase: !!(passwordControl?.hasError('passwordUppercase') && passwordControl.touched),
      lowercase: !!(passwordControl?.hasError('passwordLowercase') && passwordControl.touched),
      specialChar: !!(passwordControl?.hasError('passwordSpecialChar') && passwordControl.touched),
    };
  }
}
