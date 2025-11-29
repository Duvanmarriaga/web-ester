import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import {
  LoginRequest,
  LoginResponse,
  ForgotPasswordRequest,
  VerifyCodeRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  User,
  UserType,
  JwtPayload,
} from '../../entities/interfaces';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private mockCodes = new Map<string, string>();

  /**
   * Decodifica el JWT y extrae la información del usuario
   * @param token JWT token
   * @returns Información del usuario decodificada
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Convierte el JWT payload a un objeto User
   * @param token JWT token
   * @returns User object o null
   */
  getUserFromToken(token: string): User | null {
    const payload = this.decodeToken(token);

    if (!payload || !payload.user) {
      return null;
    }

    // Mapear el payload a User
    const user: User = {
      id:
        typeof payload.user.uid === 'string'
          ? parseInt(payload.user.uid, 10)
          : payload.user.uid,
      name: payload.user.name || '',
      email: payload.user.email,
      email_verified_at: payload.user.email_verified_at || null,
      type: payload.user.type || 'client',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    return user;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/auth/login`,
      credentials
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {});
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    // Petición HTTP real
    return this.http.post<void>(`${this.apiUrl}/auth/forgot-password`, request);
  }

  verifyCode(request: VerifyCodeRequest): Observable<void> {
    // Petición HTTP real
    return this.http.post<void>(`${this.apiUrl}/auth/verify-code`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    // Petición HTTP real
    return this.http.post<void>(`${this.apiUrl}/auth/reset-password`, request);
  }

  refreshToken(request: RefreshTokenRequest): Observable<LoginResponse> {
    // Petición HTTP real
    const headers = new HttpHeaders().set(
      'Authorization',
      `Bearer ${request.refreshToken}`
    );
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/auth/refresh`,
      {},
      { headers }
    );
  }
}
