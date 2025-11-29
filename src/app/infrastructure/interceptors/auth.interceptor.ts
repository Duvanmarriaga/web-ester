import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const CODES = {
  CODES_REFRESH: {
    CODE: 401,
    MESSAGE: 'unauthorized',
  },
  CODES_INVALID: {
    CODE: 401,
    MESSAGE: 'token_invalid',
  },
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Skip token injection for refresh endpoint
  if (req.url.includes('refresh') || req.url.includes('login')) {
    return next(req);
  }

  // Clone request and add authorization header if token exists
  const token = localStorage.getItem('token');
  const authReq = token
    ? req.clone({
        headers: req.headers
          .set('Content-Type', 'application/json')
          .set('Authorization', `Bearer ${token}`),
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === CODES.CODES_REFRESH.CODE) {
          switch (error.error?.error) {
            // If refresh token
            case CODES.CODES_REFRESH.MESSAGE:
              const refreshToken = localStorage.getItem('token');
              if (!refreshToken) {
                router.navigate(['/auth/login']);
                return throwError(() => error);
              }

              return authService.refreshToken({ refreshToken }).pipe(
                switchMap((response) => {
                  // Update token in localStorage
                  localStorage.setItem('token', response.access_token);
                  // Retry the original request with the new token
                  const retryRequest = req.clone({
                    headers: req.headers
                      .set('Content-Type', 'application/json')
                      .set('Authorization', `Bearer ${response.access_token}`),
                  });
                  return next(retryRequest);
                }),
                catchError((refreshError) => {
                  // If refresh token fails, logout
                  localStorage.removeItem('token');
                  router.navigate(['/auth/login']);
                  return throwError(() => refreshError);
                })
              );

            // If Invalid token
            case CODES.CODES_INVALID.MESSAGE:
              router.navigate(['/auth/login']);
              return throwError(() => error);
          }
        }
      }
      // Return error
      return throwError(() => error);
    })
  );
};
