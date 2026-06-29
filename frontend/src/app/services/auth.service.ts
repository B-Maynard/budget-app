import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { sessionConfig } from '../configs/session.config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public isAuthenticated$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.checkInitialState();
  }

  private checkInitialState() {
    const token = localStorage.getItem(sessionConfig.dbAccessToken);
    if (token) {
      this.isAuthenticated$.next(true);
    }
  }

  setAuthenticated(status: boolean) {
    this.isAuthenticated$.next(status);
  }

  logout() {
    localStorage.removeItem(sessionConfig.dbAccessToken);
    this.isAuthenticated$.next(false);
  }
}
