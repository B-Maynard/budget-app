import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpHandler, HttpRequest } from '@angular/common/http';
import { Observable, catchError, concatMap, throwError } from 'rxjs';
import { DatabaseService } from './database.service';
import { sessionConfig } from '../configs/session.config';

@Injectable()
export class CommonInterceptor implements HttpInterceptor {

    constructor(
        private databaseService: DatabaseService
    ) {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(req)
        .pipe(
            catchError((error: any) => {
                switch (error.status) {
                    case 401:
                        return this.databaseService.refreshToken().pipe(
                            concatMap(response => {
                                sessionStorage.setItem(sessionConfig.dbAccessToken, (response as any)[sessionConfig.dbAccessToken]);
                                return next.handle(req.clone({
                                    headers: req.headers.set('Authorization', `Bearer ${sessionStorage.getItem(sessionConfig.dbAccessToken)}`)
                                }));
                            })
                        )
                    default:
                        console.log(req);
                        console.log(error);
                        break;
                }
                return throwError(error);
            })
        )
    }
}