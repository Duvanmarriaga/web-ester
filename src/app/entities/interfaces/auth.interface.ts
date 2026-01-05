import { User } from './user.interface';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// JWT Payload Interface
export interface JwtPayload {
  user: {
    name: string;
    type: string;
    email: string;
    uid: string | number;
    email_verified_at?: string | null;
    companies?: Array<{
      id: number;
      name: string;
    }>;
  };
  iat?: number;
  exp?: number;
}
