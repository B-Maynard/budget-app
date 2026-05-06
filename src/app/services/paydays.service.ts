import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';

@Injectable({providedIn: 'root'})
export class PaydaysService {
    constructor(
        private httpClient: HttpClient
    ) { }

    getPaydays(authToken: string) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.get(apiConfig.databaseRootPath + '/paydays', {headers: headers});
    }

    deletePayday(authToken: string, id: string) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.delete(apiConfig.databaseRootPath + '/paydays' + `/${id}`, {headers: headers});
    }

    saveNewPayday(authToken: string, dateStr: string) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.post(apiConfig.databaseRootPath + '/paydays', { date: dateStr }, {headers: headers});
    }
}
