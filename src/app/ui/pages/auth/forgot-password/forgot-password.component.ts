import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import * as AuthActions from '../../../../infrastructure/store/auth/auth.actions';
import { selectIsLoading, selectError } from '../../../../infrastructure/store/auth';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);

  emailForm!: FormGroup;
  codeForm!: FormGroup;
  isLoading = signal(false);
  error = signal<string | null>(null);
  codeSent = signal(false);
  email = signal('');

  ngOnInit() {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    this.store.select(selectIsLoading).subscribe(loading => {
      this.isLoading.set(loading);
    });

    this.store.select(selectError).subscribe(error => {
      this.error.set(error);
    });
  }

  onSendCode() {
    if (this.emailForm.valid) {
      const email = this.emailForm.value.email;
      this.email.set(email);
      this.store.dispatch(AuthActions.forgotPassword({
        request: { email }
      }));
      
      setTimeout(() => {
        if (!this.error()) {
          this.codeSent.set(true);
        }
      }, 1000);
    }
  }

  onResendCode() {
    this.store.dispatch(AuthActions.forgotPassword({
      request: { email: this.email() }
    }));
  }

  onVerifyCode() {
    if (this.codeForm.valid) {
      this.store.dispatch(AuthActions.verifyCode({
        request: {
          email: this.email(),
          code: this.codeForm.value.code
        }
      }));
      
      setTimeout(() => {
        if (!this.error()) {
          this.router.navigate(['/auth/reset-password'], {
            queryParams: {
              email: this.email(),
              code: this.codeForm.value.code
            }
          });
        }
      }, 1000);
    }
  }
}
