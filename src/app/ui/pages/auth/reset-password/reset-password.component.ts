import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormControl,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private document = inject(DOCUMENT);

  resetForm!: FormGroup;
  isLoading = signal(false);
  error = signal<string | null>(null);
  email = signal<string | null>(null);
  token = signal<string | null>(null);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  readonly icons = { Eye, EyeOff };

  ngOnInit() {
    // Prevenir scroll en el body cuando estamos en la página de reset
    this.document.body.style.overflow = 'hidden';

    // Leer query params del snapshot primero (síncrono)
    const snapshotParams = this.route.snapshot.queryParams;
    if (snapshotParams['token'] && snapshotParams['email']) {
      const token = snapshotParams['token'];
      const email = decodeURIComponent(snapshotParams['email']);
      this.token.set(token);
      this.email.set(email);
    }

    // También suscribirse a cambios en query params
    this.route.queryParams.subscribe((params) => {
      const token = params['token'] || null;
      const email = params['email']
        ? decodeURIComponent(params['email'])
        : null;

      this.token.set(token);
      this.email.set(email);

      if (!this.token() || !this.email()) {
        this.error.set(
          'Token o email no válidos. Por favor, solicita un nuevo enlace de recuperación.'
        );
        setTimeout(() => {
          this.router.navigate(['/forgot-password']);
        }, 3000);
      }
    });

    // Inicializar el formulario
    this.resetForm = this.fb.group(
      {
        password: ['', [Validators.required, this.passwordValidator]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    // Actualizar validación cuando cambie la contraseña
    this.resetForm.get('password')?.valueChanges.subscribe(() => {
      this.resetForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  ngOnDestroy() {
    // Restaurar scroll cuando salimos de la página
    this.document.body.style.overflow = '';
  }

  passwordMatchValidator(
    formGroup: FormGroup
  ): { [key: string]: boolean } | null {
    const password = formGroup.get('password');
    const confirmPassword = formGroup.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value &&
      confirmPassword.value
    ) {
      if (password.value !== confirmPassword.value) {
        confirmPassword.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        confirmPassword.setErrors(null);
      }
    }
    return null;
  }

  passwordValidator(control: FormControl): { [key: string]: boolean } | null {
    if (!control.value) {
      return null;
    }

    const password = control.value;
    const errors: { [key: string]: boolean } = {};

    if (password.length < 6) {
      errors['passwordMinLength'] = true;
    }
    if (!/[A-Z]/.test(password)) {
      errors['passwordUppercase'] = true;
    }
    if (!/[a-z]/.test(password)) {
      errors['passwordLowercase'] = true;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors['passwordSpecialChar'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  get passwordErrors(): {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    specialChar: boolean;
  } {
    const passwordControl = this.resetForm.get('password');
    return {
      minLength: !!(
        passwordControl?.hasError('passwordMinLength') &&
        passwordControl.touched
      ),
      uppercase: !!(
        passwordControl?.hasError('passwordUppercase') &&
        passwordControl.touched
      ),
      lowercase: !!(
        passwordControl?.hasError('passwordLowercase') &&
        passwordControl.touched
      ),
      specialChar: !!(
        passwordControl?.hasError('passwordSpecialChar') &&
        passwordControl.touched
      ),
    };
  }

  get passwordsDoNotMatch(): boolean {
    const confirmPassword = this.resetForm.get('confirmPassword');
    return !!(
      confirmPassword?.hasError('passwordMismatch') && confirmPassword.touched
    );
  }

  togglePasswordVisibility() {
    this.showPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update((value) => !value);
  }

  async onSubmit() {
    if (this.resetForm.invalid || !this.token() || !this.email()) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const formValue = this.resetForm.value;

      await firstValueFrom(
        this.authService.resetPassword({
          token: this.token()!,
          email: this.email()!,
          password: formValue.password,
          password_confirmation: formValue.confirmPassword,
        })
      );

      this.toastr.success('Contraseña restablecida correctamente', 'Éxito');

      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    } catch (error: any) {
      const errorMessage =
        error?.error?.message ||
        error?.message ||
        'Error al restablecer la contraseña';
      this.error.set(errorMessage);
      this.toastr.error(errorMessage, 'Error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
