import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { genericInterceptor } from './intercepters/generic.interceptor';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([genericInterceptor])),
    {provide: LocationStrategy, useClass: HashLocationStrategy},
    providePrimeNG({
      theme: {
          preset: Aura
      }
    })
  ]
};