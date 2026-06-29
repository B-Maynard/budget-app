import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { SpinnerService } from '../services/spinner.service';

export const genericInterceptor: HttpInterceptorFn = (req, next) => {

  let spinnerService = inject(SpinnerService);

  spinnerService.showSpinner();
  return next(req).pipe(
    finalize(() => {
      spinnerService.hideSpinner();
    })
  );
};
