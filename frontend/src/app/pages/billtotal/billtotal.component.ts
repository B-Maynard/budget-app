import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { CurrencyPipe } from '@angular/common';
import { BillsService } from '../../services/bills.service';
import { SpinnerService } from '../../services/spinner.service';
import { sessionConfig } from '../../configs/session.config';
import { BehaviorSubject, catchError, concatMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-billtotal',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    ReactiveFormsModule,
    FormsModule,
    ToastModule,
    InputTextModule,
    CardModule,
    DividerModule,
    CurrencyPipe
],
  templateUrl: './billtotal.component.html',
  styleUrl: './billtotal.component.scss'
})
export class BillTotalComponent implements OnInit {

  @ViewChildren('billName') billNames: QueryList<ElementRef> | undefined;
  @ViewChildren('billPrice') billPrices: QueryList<ElementRef> | undefined;
  
  currentBills: any;
  currentBillsDict: any[] = [];
  authToken: string | null = null;

  chosenBills: any[] = [];
  baileyIncome: number = 0;
  imariIncome: number = 0;
  extras: number = 0;

  chosenBillPrice: number = 0;

  constructor(
    private billService: BillsService,
  ) {}

  ngOnInit(): void {
    this.authToken = localStorage.getItem(sessionConfig.dbAccessToken);
    if (this.authToken) {
      this.billService.getBills(this.authToken).subscribe((response: any) => {
        this.currentBills = response;
      });
    }
  }

  currentBillClick(bill: any) {
    this.chosenBillPrice += bill.price;
    this.chosenBills.push(bill);
    this.currentBills = this.currentBills.filter((currentBill: { name: any; }) => currentBill.name !== bill.name)
  }

  chosenBillClick(bill: any) {
    this.chosenBillPrice -= bill.price;
    this.currentBills.push(bill);
    this.chosenBills = this.chosenBills.filter((currentBill: { name: any; }) => currentBill.name !== bill.name)
  }

  billTotal() {
    return this.chosenBillPrice + this.extras;
  }

  addAllCurrentBills() {
    this.currentBills.forEach((bill: any) => {
      this.chosenBillPrice += bill.price;
      this.chosenBills.push(bill);
    });
    this.currentBills = [];
  }

  removeAllChosenBills() {
    this.chosenBills.forEach((bill: any) => {
      this.chosenBillPrice -= bill.price;
      this.currentBills.push(bill);
    });
    this.chosenBills = [];
  }
}
