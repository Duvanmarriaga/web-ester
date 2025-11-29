import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { provideRouter } from '@angular/router';
import { CompaniesComponent } from './companies.component';
import * as CompanyActions from '../../../infrastructure/store/company/company.actions';
import { selectAllCompanies, selectCompanyIsLoading } from '../../../infrastructure/store/company';

describe('CompaniesComponent', () => {
  let component: CompaniesComponent;
  let fixture: ComponentFixture<CompaniesComponent>;
  let store: MockStore;

  const mockCompanies = [
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
    company: {
      ids: ['1'],
      entities: { '1': mockCompanies[0] },
      isLoading: false,
      error: null
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompaniesComponent, ReactiveFormsModule],
      providers: [
        provideMockStore({ initialState }),
        provideRouter([])
      ]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectAllCompanies, mockCompanies);
    store.overrideSelector(selectCompanyIsLoading, false);

    fixture = TestBed.createComponent(CompaniesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load companies on init', () => {
    spyOn(store, 'dispatch');
    component.ngOnInit();
    expect(store.dispatch).toHaveBeenCalledWith(CompanyActions.loadCompanies());
  });

  it('should open create modal', () => {
    component.openCreateModal();
    expect(component.showModal()).toBeTrue();
    expect(component.editingCompany()).toBeNull();
  });

  it('should open edit modal with company', () => {
    const company = mockCompanies[0];
    component.openEditModal(company);
    expect(component.showModal()).toBeTrue();
    expect(component.editingCompany()).toEqual(company);
  });

  it('should dispatch createCompany action on submit', () => {
    spyOn(store, 'dispatch');
    component.openCreateModal();
    component.companyForm.patchValue({
      name: 'New Company',
      taxId: '999999',
      email: 'new@company.com',
      phone: '9999999999',
      address: 'New Address'
    });
    
    component.onSubmit();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: '[Company] Create Company' })
    );
  });

  it('should dispatch deleteCompany action', () => {
    spyOn(store, 'dispatch');
    spyOn(window, 'confirm').and.returnValue(true);
    const company = mockCompanies[0];
    
    component.deleteCompany(company);
    
    expect(store.dispatch).toHaveBeenCalledWith(
      CompanyActions.deleteCompany({ id: company.id })
    );
  });
});

