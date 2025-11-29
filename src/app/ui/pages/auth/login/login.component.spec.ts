import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { LoginComponent } from './login.component';
import * as AuthActions from '../../../../infrastructure/store/auth/auth.actions';
import { selectIsLoading, selectError } from '../../../../infrastructure/store/auth';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
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
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        provideMockStore({ initialState }),
        provideRouter([])
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty fields', () => {
    expect(component.loginForm.get('email')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
  });

  it('should require email and password', () => {
    expect(component.loginForm.valid).toBeFalse();
    
    component.loginForm.patchValue({
      email: 'test@test.com',
      password: 'password123'
    });
    
    expect(component.loginForm.valid).toBeTrue();
  });

  it('should validate email format', () => {
    const emailControl = component.loginForm.get('email');
    
    emailControl?.setValue('invalid-email');
    expect(emailControl?.hasError('email')).toBeTrue();
    
    emailControl?.setValue('valid@email.com');
    expect(emailControl?.hasError('email')).toBeFalse();
  });

  it('should dispatch login action on submit', () => {
    spyOn(store, 'dispatch');
    
    component.loginForm.patchValue({
      email: 'test@example.com',
      password: 'password123'
    });
    
    component.onSubmit();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.login({
        credentials: {
          email: 'test@example.com',
          password: 'password123'
        }
      })
    );
  });

  it('should not dispatch login action if form is invalid', () => {
    spyOn(store, 'dispatch');
    
    component.loginForm.patchValue({
      email: '',
      password: ''
    });
    
    component.onSubmit();
    
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('should update loading state from store', () => {
    store.overrideSelector(selectIsLoading, true);
    store.refreshState();
    
    fixture.detectChanges();
    
    expect(component.isLoading()).toBeTrue();
  });

  it('should update error state from store', () => {
    const errorMessage = 'Invalid credentials';
    store.overrideSelector(selectError, errorMessage);
    store.refreshState();
    
    fixture.detectChanges();
    
    expect(component.error()).toBe(errorMessage);
  });
});

