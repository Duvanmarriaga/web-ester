import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CompanyState, selectAll } from './company.reducer';

export const selectCompanyState =
  createFeatureSelector<CompanyState>('company');

export const selectAllCompanies = createSelector(selectCompanyState, selectAll);

export const selectCompanyEntities = createSelector(
  selectCompanyState,
  (state) => state.entities
);

export const selectSelectedCompanyId = createSelector(
  selectCompanyState,
  (state) => state.selectedCompanyId
);

export const selectSelectedCompany = createSelector(
  selectCompanyEntities,
  selectSelectedCompanyId,
  (entities, selectedId) => (selectedId ? entities[selectedId] : null)
);

export const selectCompanyIsLoading = createSelector(
  selectCompanyState,
  (state) => state.isLoading
);

export const selectCompanyError = createSelector(
  selectCompanyState,
  (state) => state.error
);

export const selectCompaniesCount = createSelector(
  selectAllCompanies,
  (companies) => companies.length
);
