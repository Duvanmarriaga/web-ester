import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { provideRouter } from '@angular/router';
import { UsersComponent } from './users.component';
import * as UserActions from '../../../infrastructure/store/user/user.actions';
import { selectAllUsers, selectUserIsLoading } from '../../../infrastructure/store/user';
import { selectAllCompanies } from '../../../infrastructure/store/company';
import { User, Company, UserRole } from '../../../entities/interfaces';

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;
  let store: MockStore;

  const mockUsers: User[] = [
    {
      id: '1',
      email: 'user1@example.com',
      firstName: 'John',
      lastName: 'Doe',
      companyId: '1',
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockCompanies: Company[] = [
    {
      id: '1',
      name: 'Company 1',
      taxId: '123456',
      email: 'company1@example.com',
      phone: '1234567890',
      address: 'Address 1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const initialState = {
    user: {
      ids: ['1'],
      entities: { '1': mockUsers[0] },
      isLoading: false,
      error: null
    },
    company: {
      ids: ['1'],
      entities: { '1': mockCompanies[0] },
      isLoading: false,
      error: null
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersComponent, ReactiveFormsModule],
      providers: [
        provideMockStore({ initialState }),
        provideRouter([])
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectAllUsers, mockUsers);
    store.overrideSelector(selectUserIsLoading, false);
    store.overrideSelector(selectAllCompanies, mockCompanies);

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load users and companies on init', () => {
    spyOn(store, 'dispatch');
    component.ngOnInit();
    expect(store.dispatch).toHaveBeenCalledWith(UserActions.loadUsers());
  });

  it('should open create modal', () => {
    component.openCreateModal();
    expect(component.showModal()).toBeTrue();
    expect(component.editingUser()).toBeNull();
  });

  it('should open edit modal with user', () => {
    const user = mockUsers[0];
    component.openEditModal(user);
    expect(component.showModal()).toBeTrue();
    expect(component.editingUser()).toEqual(user);
  });

  it('should dispatch createUser action on submit', () => {
    spyOn(store, 'dispatch');
    component.openCreateModal();
    component.userForm.patchValue({
      firstName: 'New',
      lastName: 'User',
      email: 'new@example.com',
      password: 'password123',
      role: 'user',
      companyId: '1'
    });
    
    component.onSubmit();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: '[User] Create User' })
    );
  });

  it('should dispatch deleteUser action', () => {
    spyOn(store, 'dispatch');
    spyOn(window, 'confirm').and.returnValue(true);
    const user = mockUsers[0];
    
    component.deleteUser(user);
    
    expect(store.dispatch).toHaveBeenCalledWith(
      UserActions.deleteUser({ id: user.id })
    );
  });

  it('should get company name by id', () => {
    expect(component.getCompanyName('1')).toBe('Company 1');
    expect(component.getCompanyName('999')).toBe('');
  });
});

