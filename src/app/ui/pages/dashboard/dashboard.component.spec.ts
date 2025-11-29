import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { provideRouter } from '@angular/router';
import * as UserActions from '../../../infrastructure/store/user/user.actions';
import * as CompanyActions from '../../../infrastructure/store/company/company.actions';
import { selectUser } from '../../../infrastructure/store/auth';
import { selectUsersCount } from '../../../infrastructure/store/user';
import { selectCompaniesCount } from '../../../infrastructure/store/company';
import { UserRole } from '../../../entities/interfaces';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let store: MockStore;

  const initialState = {
    auth: {
      user: { 
        id: '1', 
        email: 'test@example.com', 
        firstName: 'Test', 
        lastName: 'User', 
        companyId: '1', 
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      accessToken: 'token',
      refreshToken: 'refresh',
      isAuthenticated: true,
      isLoading: false,
      error: null
    },
    user: {
      ids: [],
      entities: {},
      isLoading: false,
      error: null
    },
    company: {
      ids: [],
      entities: {},
      isLoading: false,
      error: null
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideMockStore({ initialState }),
        provideRouter([])
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectUser, initialState.auth.user);
    store.overrideSelector(selectUsersCount, 5);
    store.overrideSelector(selectCompaniesCount, 3);

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load user data on init', () => {
    expect(component.userName()).toBe('Test');
  });

  it('should load users count', () => {
    expect(component.usersCount()).toBe(5);
  });

  it('should load companies count', () => {
    expect(component.companiesCount()).toBe(3);
  });

  it('should dispatch loadUsers action on init', () => {
    spyOn(store, 'dispatch');
    component.ngOnInit();
    expect(store.dispatch).toHaveBeenCalledWith(UserActions.loadUsers());
  });

  it('should dispatch loadCompanies action on init', () => {
    spyOn(store, 'dispatch');
    component.ngOnInit();
    expect(store.dispatch).toHaveBeenCalledWith(CompanyActions.loadCompanies());
  });
});

