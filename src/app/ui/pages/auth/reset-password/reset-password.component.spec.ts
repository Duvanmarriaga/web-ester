import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ResetPasswordComponent } from './reset-password.component';
import * as AuthActions from '../../../../infrastructure/store/auth/auth.actions';
import { of } from 'rxjs';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let store: MockStore;

  const mockActivatedRoute = {
    queryParams: of({ email: 'test@example.com', code: '123456' })
  };

  const initialState = {
    auth: {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent, ReactiveFormsModule],
      providers: [
        provideMockStore({ initialState }),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with password fields', () => {
    expect(component.resetForm.get('newPassword')).toBeTruthy();
    expect(component.resetForm.get('confirmPassword')).toBeTruthy();
  });

  it('should validate password minimum length', () => {
    const passwordControl = component.resetForm.get('newPassword');
    passwordControl?.setValue('12345');
    expect(passwordControl?.hasError('minlength')).toBeTrue();
    
    passwordControl?.setValue('123456');
    expect(passwordControl?.hasError('minlength')).toBeFalse();
  });

  it('should validate password match', () => {
    component.resetForm.patchValue({
      newPassword: '123456',
      confirmPassword: '123456'
    });
    expect(component.resetForm.hasError('passwordMismatch')).toBeFalse();
    
    component.resetForm.patchValue({
      newPassword: '123456',
      confirmPassword: '654321'
    });
    expect(component.resetForm.hasError('passwordMismatch')).toBeTrue();
  });

  it('should dispatch resetPassword action on submit', () => {
    spyOn(store, 'dispatch');
    component.email.set('test@example.com');
    component.code.set('123456');
    component.resetForm.patchValue({
      newPassword: 'newPassword123',
      confirmPassword: 'newPassword123'
    });
    
    component.onSubmit();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.resetPassword({
        request: {
          email: 'test@example.com',
          code: '123456',
          newPassword: 'newPassword123'
        }
      })
    );
  });

  it('should get email and code from query params', () => {
    expect(component.email()).toBe('test@example.com');
    expect(component.code()).toBe('123456');
  });
});

