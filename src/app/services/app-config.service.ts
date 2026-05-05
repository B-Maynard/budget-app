import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';

@Injectable({providedIn: 'root'})
export class AppConfigService {
    constructor(
        private httpClient: HttpClient
    ) { }

    getConfig(authToken: string) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.get(apiConfig.databaseRootPath + '/config', {headers: headers});
    }

    updateIncome(authToken: string, income: number) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.patch(apiConfig.databaseRootPath + '/config', { income }, {headers: headers});
    }
}
