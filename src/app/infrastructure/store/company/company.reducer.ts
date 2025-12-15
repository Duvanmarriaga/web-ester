import { createReducer, on } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { Company } from '../../../entities/interfaces';
import * as CompanyActions from './company.actions';

export interface CompanyState extends EntityState<Company> {
  selectedCompanyId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const companyAdapter: EntityAdapter<Company> = createEntityAdapter<Company>({
  selectId: (company: Company) => company.id
});

export const initialState: CompanyState = companyAdapter.getInitialState({
  selectedCompanyId: null,
  isLoading: false,
  error: null
});

export const companyReducer = createReducer(
  initialState,
  
  // Load Companies
  on(CompanyActions.loadCompanies, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(CompanyActions.loadCompaniesSuccess, (state, { companies }) =>
    companyAdapter.setAll(companies, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(CompanyActions.loadCompaniesFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Load Company
  on(CompanyActions.loadCompany, (state, { id }) => ({
    ...state,
    selectedCompanyId: id,
    isLoading: true,
    error: null
  })),
  
  on(CompanyActions.loadCompanySuccess, (state, { company }) =>
    companyAdapter.upsertOne(company, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(CompanyActions.loadCompanyFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Create Company
  on(CompanyActions.createCompany, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(CompanyActions.createCompanySuccess, (state, { company }) =>
    companyAdapter.addOne(company, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(CompanyActions.createCompanyFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Update Company
  on(CompanyActions.updateCompany, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(CompanyActions.updateCompanySuccess, (state, { company }) =>
    companyAdapter.updateOne(
      { id: company.id, changes: company },
      {
        ...state,
        isLoading: false,
        error: null
      }
    )
  ),
  
  on(CompanyActions.updateCompanyFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Delete Company
  on(CompanyActions.deleteCompany, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(CompanyActions.deleteCompanySuccess, (state, { id }) =>
    companyAdapter.removeOne(id, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(CompanyActions.deleteCompanyFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  }))
);

export const {
  selectIds,
  selectEntities,
  selectAll,
  selectTotal
} = companyAdapter.getSelectors();

