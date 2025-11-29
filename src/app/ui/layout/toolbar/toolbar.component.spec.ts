import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToolbarComponent } from './toolbar.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { provideRouter } from '@angular/router';
import * as AuthActions from '../../../infrastructure/store/auth/auth.actions';
import { selectUser } from '../../../infrastructure/store/auth';
import { UserRole } from '../../../entities/interfaces';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;
  let store: MockStore;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    companyId: '1',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const initialState = {
    auth: {
      user: mockUser,
      accessToken: 'token',
      refreshToken: 'refresh',
      isAuthenticated: true,
      isLoading: false,
      error: null
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarComponent],
      providers: [
        provideMockStore({ initialState }),
        provideRouter([])
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectUser, mockUser);

    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display user full name', () => {
    expect(component.userFullName()).toBe('Test User');
  });

  it('should toggle menu', () => {
    const initialState = component.isMenuOpen();
    component.toggleMenu();
    expect(component.isMenuOpen()).toBe(!initialState);
  });

  it('should dispatch logout action', () => {
    spyOn(store, 'dispatch');
    component.onLogout();
    expect(store.dispatch).toHaveBeenCalledWith(AuthActions.logout());
  });

  it('should close menu after logout', () => {
    component.isMenuOpen.set(true);
    component.onLogout();
    expect(component.isMenuOpen()).toBeFalse();
  });
});

