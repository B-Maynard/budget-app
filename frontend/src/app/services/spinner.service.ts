import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({providedIn: 'root'})
export class SpinnerService {

    private apiCount = 0;
    private isLoadingSubject = new BehaviorSubject<boolean>(false);
    isLoading$ = this.isLoadingSubject.asObservable();

    showSpinner(suppressSpinner: boolean = false) {
        if (suppressSpinner === false) {
            if (this.apiCount === 0) {
                this.isLoadingSubject.next(true);
            }

            this.apiCount++;
        }
    }

    hideSpinner(suppressSpinner: boolean = false) {
        if (suppressSpinner === false) {
            this.apiCount--;
            if (this.apiCount === 0) {
                this.isLoadingSubject.next(false);
            }
        }
    }

}