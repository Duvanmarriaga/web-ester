import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take, switchMap, timeout, catchError, of, filter } from 'rxjs';
import { selectIsAuthenticated, selectToken } from '../store/auth';
import * as AuthActions from '../store/auth/auth.actions';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const store = inject(Store);
  const authService = inject(AuthService)
  
  // // Check if token exists in localStorage
  const token = localStorage.getItem('token');
  console.log(token);
  if (!token) {
    router.navigate(['/auth/login']);
    return false;
  }
  return true;
  
  // // If token exists, ensure auth state is loaded
  // if (token) {
  //   // Dispatch loadAuthFromStorage to load state from token (only if not already loaded)
  //   store.dispatch(AuthActions.loadAuthFromStorage());
    
  //   // Wait for authentication state to be determined
  //   // Check if token in store matches localStorage (indicates state is loaded)
  //   return store.select(selectToken).pipe(
  //     // Wait until store token is set (matches localStorage) or becomes null (invalid token)
  //     filter((storeToken) => {
  //       // If storeToken matches localStorage token, state is loaded successfully
  //       // If storeToken is null, it means token was invalid and state is also loaded
  //       return storeToken === token || storeToken === null;
  //     }),
  //     take(1),
  //     switchMap(() => store.select(selectIsAuthenticated).pipe(take(1))),
  //     timeout(2000), // Timeout after 2 seconds
  //     map((isAuthenticated) => {
  //       if (!isAuthenticated) {
  //         // Save the attempted URL for redirect after login
  //         const returnUrl = state.url;
  //         router.navigate(['/auth/login'], {
  //           queryParams: { returnUrl: returnUrl !== '/' ? returnUrl : undefined }
  //         });
  //         return false;
  //       }
  //       // User is authenticated, allow access to the route (NO REDIRECT - stay on current route)
  //       return true;
  //     }),
  //     catchError(() => {
  //       // If timeout, check if token is still valid as fallback
  //       const currentToken = localStorage.getItem('token');
  //       if (!currentToken) {
  //         router.navigate(['/auth/login']);
  //         return of(false);
  //       }
  //       // Token exists, allow access (state might still be loading but token is valid)
  //       return of(true);
  //     })
  //   );
  // }
  
  // // No token, redirect to login immediately
  // const returnUrl = state.url;
  // router.navigate(['/auth/login'], {
  //   queryParams: { returnUrl: returnUrl !== '/' ? returnUrl : undefined }
  // });
  return false;
};
