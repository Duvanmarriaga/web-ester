import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CommonModule, DOCUMENT } from '@angular/common';
import { LucideAngularModule, Eye, EyeOff } from 'lucide-angular';
import * as AuthActions from '../../../../infrastructure/store/auth/auth.actions';
import { selectIsLoading, selectError } from '../../../../infrastructure/store/auth';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private router = inject(Router);
  private document = inject(DOCUMENT);

  loginForm!: FormGroup;
  isLoading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);
  
  // Lucide icons
  readonly icons = { Eye, EyeOff };

  ngOnInit() {
    // Prevenir scroll en el body cuando estamos en la página de login
    this.document.body.style.overflow = 'hidden';

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.store.select(selectIsLoading).subscribe(loading => {
      this.isLoading.set(loading);
    });

    this.store.select(selectError).subscribe(error => {
      this.error.set(error);
    });
  }

  ngOnDestroy() {
    // Restaurar scroll cuando salimos de la página de login
    this.document.body.style.overflow = '';
  }

  togglePasswordVisibility() {
    this.showPassword.update(val => !val);
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.store.dispatch(AuthActions.login({
        credentials: this.loginForm.value
      }));
    }
  }
}
