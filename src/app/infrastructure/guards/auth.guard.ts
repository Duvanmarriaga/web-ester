import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  // // Check if token exists in localStorage
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/auth/login']);
    return false;
  }
  return true;
};
