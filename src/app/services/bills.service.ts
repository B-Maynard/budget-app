import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';
import { sessionConfig } from '../configs/session.config';
import { DatabaseService } from './database.service';

@Injectable({providedIn: 'root'})
export class BillsService {
    constructor(
        private databaseService: DatabaseService
    ) { }

    getBills() {
        return this.databaseService.callDatabaseEndpoint("GET", apiConfig.getBills, {});
    }
}