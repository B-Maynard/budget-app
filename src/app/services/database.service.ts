import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';
import { sessionConfig } from '../configs/session.config';
import * as key from "../../key.json";

@Injectable({providedIn: 'root'})
export class DatabaseService {
    constructor(
        private httpClient: HttpClient
    ) { }

    public auth() {

        let headers = new HttpHeaders();
        headers = headers.set("Content-Type", "application/json");

        let body = JSON.stringify({
            "key": key.key
        });

        return this.httpClient.post(apiConfig.databaseLogin, body, {headers: headers});
    }

    public refreshToken() {
        console.log("refresh called");
        let headers = new HttpHeaders();
        headers = headers.set("Content-Type", "application/json");
        headers = headers.set("Authorization", `Bearer ${sessionStorage.getItem(sessionConfig.dbRefreshToken)}`);

        return this.httpClient.request("POST", apiConfig.databaseRefreshAuth, {headers: headers});
    }

    public callDatabaseEndpoint(method: any, url: any, options: any) {

        let headers = new HttpHeaders();
        headers = headers.set("Authorization", `Bearer ${sessionStorage.getItem(sessionConfig.dbAccessToken)}`);

        if (options.headers) {
            options.headers.append(headers);
        }
        else {
            options.headers = headers;
        }

        return this.httpClient.request(method, apiConfig.databaseRootPath + url, options)
    }
}