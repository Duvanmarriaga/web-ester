import { createAction, props } from '@ngrx/store';
import {
  Company,
  CompanyCreate,
  CompanyUpdate,
} from '../../../entities/interfaces';

// Load Companies
export const loadCompanies = createAction('[Company] Load Companies');

export const loadCompaniesSuccess = createAction(
  '[Company] Load Companies Success',
  props<{ companies: Company[] }>()
);

export const loadCompaniesFailure = createAction(
  '[Company] Load Companies Failure',
  props<{ error: string }>()
);

// Load Company by ID
export const loadCompany = createAction(
  '[Company] Load Company',
  props<{ id: string }>()
);

export const loadCompanySuccess = createAction(
  '[Company] Load Company Success',
  props<{ company: Company }>()
);

export const loadCompanyFailure = createAction(
  '[Company] Load Company Failure',
  props<{ error: string }>()
);

// Create Company
export const createCompany = createAction(
  '[Company] Create Company',
  props<{ company: CompanyCreate }>()
);

export const createCompanySuccess = createAction(
  '[Company] Create Company Success',
  props<{ company: Company }>()
);

export const createCompanyFailure = createAction(
  '[Company] Create Company Failure',
  props<{ error: string }>()
);

// Update Company
export const updateCompany = createAction(
  '[Company] Update Company',
  props<{ company: CompanyUpdate }>()
);

export const updateCompanySuccess = createAction(
  '[Company] Update Company Success',
  props<{ company: Company }>()
);

export const updateCompanyFailure = createAction(
  '[Company] Update Company Failure',
  props<{ error: string }>()
);

// Delete Company
export const deleteCompany = createAction(
  '[Company] Delete Company',
  props<{ id: number }>()
);

export const deleteCompanySuccess = createAction(
  '[Company] Delete Company Success',
  props<{ id: number }>()
);

export const deleteCompanyFailure = createAction(
  '[Company] Delete Company Failure',
  props<{ error: string }>()
);
