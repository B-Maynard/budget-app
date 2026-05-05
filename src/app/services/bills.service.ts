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

    updateBill(authToken: string, billObj: any) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        const billId = billObj.id || billObj._id;
        return this.httpClient.patch(apiConfig.databaseRootPath + apiConfig.getBills + `/${billId}`, billObj, {headers: headers}); 
    }

    deleteBill(authToken: string, id: string) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.delete(apiConfig.databaseRootPath + apiConfig.getBills + `/${id}`, {headers: headers});
    }

    saveNewBill(authToken: string, billObj: any) {
        let headers = new HttpHeaders();
        headers = headers.append("authToken", authToken);
        return this.httpClient.post(apiConfig.databaseRootPath + apiConfig.getBills, billObj, {headers: headers});
    }
}