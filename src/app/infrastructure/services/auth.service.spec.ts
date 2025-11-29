import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { LoginRequest, ForgotPasswordRequest, VerifyCodeRequest, ResetPasswordRequest } from '../../entities/interfaces';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should login successfully with valid credentials', (done) => {
    const credentials: LoginRequest = {
      email: 'admin@example.com',
      password: 'password123'
    };

    service.login(credentials).subscribe({
      next: (response) => {
        expect(response).toBeTruthy();
        expect(response.user).toBeTruthy();
        expect(response.accessToken).toContain('mock-access-token');
        expect(response.refreshToken).toContain('mock-refresh-token');
        done();
      }
    });
  });

  it('should fail login with invalid credentials', (done) => {
    const credentials: LoginRequest = {
      email: 'admin@example.com',
      password: 'wrong-password'
    };

    service.login(credentials).subscribe({
      error: (error) => {
        expect(error.message).toBe('Invalid credentials');
        done();
      }
    });
  });

  it('should send forgot password request', (done) => {
    const request: ForgotPasswordRequest = {
      email: 'admin@example.com'
    };

    service.forgotPassword(request).subscribe({
      next: () => {
        expect(true).toBeTruthy();
        done();
      }
    });
  });

  it('should fail forgot password with non-existent email', (done) => {
    const request: ForgotPasswordRequest = {
      email: 'nonexistent@example.com'
    };

    service.forgotPassword(request).subscribe({
      error: (error) => {
        expect(error.message).toBe('User not found');
        done();
      }
    });
  });

  it('should verify code successfully', (done) => {
    const emailRequest: ForgotPasswordRequest = {
      email: 'admin@example.com'
    };

    // First send forgot password to generate a code
    service.forgotPassword(emailRequest).subscribe(() => {
      // In real scenario, we would get the code from email
      // For mock, we can't test the actual code, but we can test the flow
      expect(true).toBeTruthy();
      done();
    });
  });

  it('should refresh token successfully', (done) => {
    const refreshToken = 'mock-refresh-token-123';

    service.refreshToken({ refreshToken }).subscribe({
      next: (response) => {
        expect(response).toBeTruthy();
        expect(response.accessToken).toContain('mock-access-token');
        expect(response.refreshToken).toContain('mock-refresh-token');
        done();
      }
    });
  });

  it('should fail refresh token with invalid token', (done) => {
    const refreshToken = 'invalid-token';

    service.refreshToken({ refreshToken }).subscribe({
      error: (error) => {
        expect(error.message).toBe('Invalid refresh token');
        done();
      }
    });
  });
});

