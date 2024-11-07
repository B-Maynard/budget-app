import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';

@Injectable({providedIn: 'root'})
export class BillsService {
    constructor(
        private httpClient: HttpClient
    ) { }

    getBills(authToken: string) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.get(apiConfig.databaseRootPath + apiConfig.getBills, {headers: headers});
    }
}