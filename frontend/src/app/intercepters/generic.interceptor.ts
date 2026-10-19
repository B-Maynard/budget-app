import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { SpinnerService } from '../services/spinner.service';

export const SILENT_REQUEST = new HttpContextToken<boolean>(() => false);

export const genericInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SILENT_REQUEST)) return next(req);

  let spinnerService = inject(SpinnerService);

  spinnerService.showSpinner();
  return next(req).pipe(
    finalize(() => {
      spinnerService.hideSpinner();
    }),
  );
};
