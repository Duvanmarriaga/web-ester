import { createAction, props } from '@ngrx/store';
import { LoginRequest, LoginResponse, ForgotPasswordRequest, VerifyCodeRequest, ResetPasswordRequest, RefreshTokenResponse } from '../../../entities/interfaces';

// Login Actions
export const login = createAction(
  '[Auth] Login',
  props<{ credentials: LoginRequest }>()
);

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ response: LoginResponse }>()
);

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>()
);

// Logout Actions
export const logout = createAction('[Auth] Logout');

export const logoutSuccess = createAction('[Auth] Logout Success');

// Forgot Password Actions
export const forgotPassword = createAction(
  '[Auth] Forgot Password',
  props<{ request: ForgotPasswordRequest }>()
);

export const forgotPasswordSuccess = createAction(
  '[Auth] Forgot Password Success'
);

export const forgotPasswordFailure = createAction(
  '[Auth] Forgot Password Failure',
  props<{ error: string }>()
);

// Verify Code Actions
export const verifyCode = createAction(
  '[Auth] Verify Code',
  props<{ request: VerifyCodeRequest }>()
);

export const verifyCodeSuccess = createAction(
  '[Auth] Verify Code Success'
);

export const verifyCodeFailure = createAction(
  '[Auth] Verify Code Failure',
  props<{ error: string }>()
);

// Reset Password Actions
export const resetPassword = createAction(
  '[Auth] Reset Password',
  props<{ request: ResetPasswordRequest }>()
);

export const resetPasswordSuccess = createAction(
  '[Auth] Reset Password Success'
);

export const resetPasswordFailure = createAction(
  '[Auth] Reset Password Failure',
  props<{ error: string }>()
);

// Refresh Token Actions
export const refreshToken = createAction('[Auth] Refresh Token');

export const refreshTokenSuccess = createAction(
  '[Auth] Refresh Token Success',
  props<{ response: RefreshTokenResponse }>()
);

export const refreshTokenFailure = createAction(
  '[Auth] Refresh Token Failure',
  props<{ error: string }>()
);

// Load Auth from Storage
export const loadAuthFromStorage = createAction('[Auth] Load From Storage');

