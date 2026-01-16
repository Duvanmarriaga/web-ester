import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import * as AuthActions from '../../../../infrastructure/store/auth/auth.actions';
import {
  selectIsLoading,
  selectError,
} from '../../../../infrastructure/store/auth';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);
  

  emailForm!: FormGroup;
  isLoading = signal(false);
  error = signal<string | null>(null);
  emailSent = signal(false);

  ngOnInit() {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.store.select(selectIsLoading).subscribe((loading) => {
      this.isLoading.set(loading);
    });

    this.store.select(selectError).subscribe((error) => {
      this.error.set(error);
    });
  }

  onSendEmail() {
    if (this.emailForm.valid) {
      const email = this.emailForm.value.email;
      this.store.dispatch(
        AuthActions.forgotPassword({
          request: { email },
        })
      );
      this.emailSent.set(true);
    }
  }
}
