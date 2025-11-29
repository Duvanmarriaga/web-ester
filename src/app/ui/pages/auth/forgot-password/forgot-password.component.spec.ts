import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import * as AuthActions from '../../../../infrastructure/store/auth/auth.actions';
import { selectIsLoading, selectError } from '../../../../infrastructure/store/auth';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let store: MockStore;
  let router: Router;

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
      imports: [ForgotPasswordComponent, ReactiveFormsModule],
      providers: [
        provideMockStore({ initialState }),
        provideRouter([])
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize email and code forms', () => {
    expect(component.emailForm).toBeTruthy();
    expect(component.codeForm).toBeTruthy();
  });

  it('should validate email format in emailForm', () => {
    const emailControl = component.emailForm.get('email');
    
    emailControl?.setValue('invalid-email');
    expect(emailControl?.hasError('email')).toBeTrue();
    
    emailControl?.setValue('valid@email.com');
    expect(emailControl?.hasError('email')).toBeFalse();
  });

  it('should validate code format (6 digits)', () => {
    const codeControl = component.codeForm.get('code');
    
    codeControl?.setValue('12345');
    expect(codeControl?.hasError('pattern')).toBeTrue();
    
    codeControl?.setValue('123456');
    expect(codeControl?.hasError('pattern')).toBeFalse();
  });

  it('should dispatch forgotPassword action on sendCode', () => {
    spyOn(store, 'dispatch');
    component.emailForm.patchValue({ email: 'test@example.com' });
    
    component.onSendCode();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.forgotPassword({
        request: { email: 'test@example.com' }
      })
    );
  });

  it('should dispatch forgotPassword action when sending code', () => {
    spyOn(store, 'dispatch');
    component.emailForm.patchValue({ email: 'test@example.com' });
    
    component.onSendCode();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: '[Auth] Forgot Password' })
    );
  });

  it('should dispatch verifyCode action', () => {
    spyOn(store, 'dispatch');
    component.email.set('test@example.com');
    component.codeForm.patchValue({ code: '123456' });
    
    component.onVerifyCode();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.verifyCode({
        request: { email: 'test@example.com', code: '123456' }
      })
    );
  });

  it('should dispatch verifyCode when verifying', () => {
    spyOn(store, 'dispatch');
    component.email.set('test@example.com');
    component.codeForm.patchValue({ code: '123456' });
    
    component.onVerifyCode();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: '[Auth] Verify Code' })
    );
  });

  it('should resend code', () => {
    spyOn(store, 'dispatch');
    component.email.set('test@example.com');
    
    component.onResendCode();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.forgotPassword({
        request: { email: 'test@example.com' }
      })
    );
  });
});

