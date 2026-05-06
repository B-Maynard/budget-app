import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated$.value) {
    return true;
  }

  // Redirect to dashboard where the auth overlay is shown
  router.navigate(['/']);
  return false;
};
