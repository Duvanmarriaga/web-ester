import { createReducer, on } from '@ngrx/store';
import { AuthState, User, JwtPayload, UserType } from '../../../entities/interfaces';
import * as AuthActions from './auth.actions';
import { jwtDecode } from 'jwt-decode';

export const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Helper function para decodificar usuario del token
function getUserFromToken(token: string): User | null {
  try {
    const payload = jwtDecode<JwtPayload>(token);

    if (!payload || !payload.user) {
      return null;
    }

    // Extract companies from token if available
    const companies = payload.user.companies || [];

    const user: User = {
      id:
        typeof payload.user.uid === 'string'
          ? parseInt(payload.user.uid, 10)
          : payload.user.uid,
      name: payload.user.name || '',
      email: payload.user.email,
      email_verified_at: null,
      type: (payload.user.type as UserType) || UserType.CLIENT,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      companies: companies.length > 0 ? companies : undefined,
    };

    return user;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

export const authReducer = createReducer(
  initialState,

  // Login
  on(AuthActions.login, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),

  on(AuthActions.loginSuccess, (state, { response }) => {
    const user = getUserFromToken(response.access_token);

    return {
      ...state,
      user,
      token: response.access_token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    };
  }),

  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Logout
  on(AuthActions.logoutSuccess, () => initialState),

  // Forgot Password
  on(AuthActions.forgotPassword, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),

  on(AuthActions.forgotPasswordSuccess, (state) => ({
    ...state,
    isLoading: false,
    error: null,
  })),

  on(AuthActions.forgotPasswordFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Verify Code
  on(AuthActions.verifyCode, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),

  on(AuthActions.verifyCodeSuccess, (state) => ({
    ...state,
    isLoading: false,
    error: null,
  })),

  on(AuthActions.verifyCodeFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Reset Password
  on(AuthActions.resetPassword, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),

  on(AuthActions.resetPasswordSuccess, (state) => ({
    ...state,
    isLoading: false,
    error: null,
  })),

  on(AuthActions.resetPasswordFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Refresh Token
  on(AuthActions.refreshTokenSuccess, (state, { response }) => {
    const user = getUserFromToken(response.access_token);

    return {
      ...state,
      user,
      token: response.access_token,
      isAuthenticated: true,
    };
  }),

  on(AuthActions.refreshTokenFailure, () => initialState)
);
