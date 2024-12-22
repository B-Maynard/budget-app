import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';
import { Bill } from '../configs/database-objects/bill.interface';

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

    updateBill(authToken: string, billObj: any) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.patch(apiConfig.databaseRootPath + apiConfig.getBills + `/${billObj._id}`, {headers: headers, body: billObj}); 
    }
}