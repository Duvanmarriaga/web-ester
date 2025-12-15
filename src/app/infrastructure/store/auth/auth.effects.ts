import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import * as AuthActions from './auth.actions';

@Injectable()
export class AuthEffects {
  private actions$ = inject(Actions);
  private authService = inject(AuthService);
  private router = inject(Router);
  private store = inject(Store);
  private toastr = inject(ToastrService);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      switchMap(({ credentials }) =>
        this.authService.login(credentials).pipe(
          map((response) => {
            // Guardar el token
            localStorage.setItem('token', response.access_token);
            this.toastr.success('Inicio de sesión exitoso', 'Éxito');
            this.router.navigate(['/dashboard']);
            return AuthActions.loginSuccess({ response });
          }),
          catchError((error) => {
            const errorMessage =
              error.error?.message ||
              error.message ||
              'Error al iniciar sesión';
            this.toastr.error(errorMessage, 'Error');
            return of(
              AuthActions.loginFailure({
                error: errorMessage,
              })
            );
          })
        )
      )
    )
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      switchMap(() =>
        this.authService.logout().pipe(
          map(() => {
            // Limpiar localStorage después de notificar al backend
            this.router.navigate(['/auth/login']);
            localStorage.removeItem('token');
            return AuthActions.logoutSuccess();
          }),
          catchError((error) => {
            // Aunque falle el backend, limpiar localmente
            this.router.navigate(['/auth/login']);
            localStorage.removeItem('token');
            return of(AuthActions.logoutSuccess());
          })
        )
      )
    )
  );

  logoutSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutSuccess),
        tap(() => this.router.navigate(['/auth/login']))
      ),
    { dispatch: false }
  );

  forgotPassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.forgotPassword),
      switchMap(({ request }) =>
        this.authService.forgotPassword(request).pipe(
          map(() => {
            this.toastr.success('Código de recuperación enviado', 'Éxito');
            return AuthActions.forgotPasswordSuccess();
          }),
          catchError((error) => {
            const errorMessage =
              error.error?.message ||
              error.message ||
              'Error al enviar código de recuperación';
            this.toastr.error(errorMessage, 'Error');
            return of(
              AuthActions.forgotPasswordFailure({
                error: errorMessage,
              })
            );
          })
        )
      )
    )
  );

  verifyCode$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.verifyCode),
      switchMap(({ request }) =>
        this.authService.verifyCode(request).pipe(
          map(() => {
            this.toastr.success('Código verificado exitosamente', 'Éxito');
            return AuthActions.verifyCodeSuccess();
          }),
          catchError((error) => {
            const errorMessage =
              error.error?.message || error.message || 'Código inválido';
            this.toastr.error(errorMessage, 'Error');
            return of(
              AuthActions.verifyCodeFailure({
                error: errorMessage,
              })
            );
          })
        )
      )
    )
  );

  resetPassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.resetPassword),
      switchMap(({ request }) =>
        this.authService.resetPassword(request).pipe(
          map(() => {
            this.toastr.success(
              'Contraseña restablecida exitosamente',
              'Éxito'
            );
            return AuthActions.resetPasswordSuccess();
          }),
          catchError((error) => {
            const errorMessage =
              error.error?.message ||
              error.message ||
              'Error al restablecer contraseña';
            this.toastr.error(errorMessage, 'Error');
            return of(
              AuthActions.resetPasswordFailure({
                error: errorMessage,
              })
            );
          })
        )
      )
    )
  );

  resetPasswordSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.resetPasswordSuccess),
        tap(() => this.router.navigate(['/auth/login']))
      ),
    { dispatch: false }
  );

  refreshToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshToken),
      switchMap(() => {
        const token = localStorage.getItem('token');
        if (!token) {
          return of(
            AuthActions.refreshTokenFailure({
              error: 'No token available',
            })
          );
        }

        return this.authService.refreshToken({ refreshToken: token }).pipe(
          map((response) => {
            localStorage.setItem('token', response.access_token);
            return AuthActions.refreshTokenSuccess({ response });
          }),
          catchError((error) => {
            // Remove token on refresh failure
            localStorage.removeItem('token');
            return of(
              AuthActions.refreshTokenFailure({
                error: error.message || 'Token refresh failed',
              })
            );
          })
        );
      })
    )
  );

  refreshTokenFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.refreshTokenFailure),
        tap(() => {
          // Remove token and redirect to login
          localStorage.removeItem('token');
          this.router.navigate(['/auth/login']);
          // Dispatch logout to clear store state
          this.store.dispatch(AuthActions.logout());
        })
      ),
    { dispatch: false }
  );

  loadAuthFromStorage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loadAuthFromStorage),
      map(() => {
        const token = localStorage.getItem('token');
        if (token) {
          // Validar que el token sea decodificable
          const payload = this.authService.decodeToken(token);
          if (payload && payload.user) {
            return AuthActions.loginSuccess({
              response: { access_token: token, expires_in: 0, token_type: '' },
            });
          }
        }

        return AuthActions.logoutSuccess();
      })
    )
  );
}
