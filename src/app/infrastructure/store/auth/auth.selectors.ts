import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from '../../../entities/interfaces';

export const selectAuthState = createFeatureSelector<AuthState>('auth');

export const selectUser = createSelector(
  selectAuthState,
  (state) => state.user
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state) => state.isAuthenticated
);

export const selectToken = createSelector(
  selectAuthState,
  (state) => state.token
);

// Mantener selectAccessToken para compatibilidad (apunta al mismo token)
export const selectAccessToken = createSelector(
  selectAuthState,
  (state) => state.token
);

export const selectIsLoading = createSelector(
  selectAuthState,
  (state) => state.isLoading
);

export const selectError = createSelector(
  selectAuthState,
  (state) => state.error
);

export const selectUserFullName = createSelector(selectUser, (user) =>
  user ? `${user.name}` : ''
);
