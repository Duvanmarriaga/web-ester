import { ActionReducerMap } from '@ngrx/store';
import { authReducer } from './auth/auth.reducer';
import { userReducer } from './user/user.reducer';
import { companyReducer } from './company/company.reducer';
import type { AuthState } from '../../entities/interfaces';
import type { UserState } from './user/user.reducer';
import type { CompanyState } from './company/company.reducer';

export interface AppState {
  auth: AuthState;
  user: UserState;
  company: CompanyState;
}

export const reducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  user: userReducer,
  company: companyReducer
};

// Re-export specific items to avoid conflicts
export * from './auth/auth.actions';
export * from './auth/auth.selectors';
export * from './auth/auth.effects';

export * from './user/user.actions';
export * from './user/user.selectors';
export * from './user/user.effects';

export * from './company/company.actions';
export * from './company/company.selectors';
export * from './company/company.effects';

