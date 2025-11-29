import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import * as AuthActions from '../../../../infrastructure/store/auth/auth.actions';
import { selectIsLoading, selectError } from '../../../../infrastructure/store/auth';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  resetForm!: FormGroup;
  isLoading = signal(false);
  error = signal<string | null>(null);
  email = signal('');
  code = signal('');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.email.set(params['email'] || '');
      this.code.set(params['code'] || '');

      if (!this.email() || !this.code()) {
        this.router.navigate(['/auth/forgot-password']);
      }
    });

    this.resetForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.store.select(selectIsLoading).subscribe(loading => {
      this.isLoading.set(loading);
    });

    this.store.select(selectError).subscribe(error => {
      this.error.set(error);
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.resetForm.valid) {
      this.store.dispatch(AuthActions.resetPassword({
        request: {
          email: this.email(),
          code: this.code(),
          newPassword: this.resetForm.value.newPassword
        }
      }));
    }
  }
}
