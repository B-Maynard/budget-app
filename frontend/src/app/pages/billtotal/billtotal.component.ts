import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon.component';
import { BillsService } from '../../services/bills.service';
import { sessionConfig } from '../../configs/session.config';

@Component({
  selector: 'app-billtotal',
  standalone: true,
  imports: [IconComponent, FormsModule, CurrencyPipe],
  templateUrl: './billtotal.component.html',
  styleUrl: './billtotal.component.scss',
})
export class BillTotalComponent implements OnInit {
  currentBills: any[] = [];
  authToken: string | null = null;

  chosenBills: any[] = [];
  baileyIncome: number = 0;
  imariIncome: number = 0;
  extras: number = 0;

  chosenBillPrice: number = 0;

  constructor(private billService: BillsService) {}

  ngOnInit(): void {
    this.authToken = localStorage.getItem(sessionConfig.dbAccessToken);
    if (this.authToken) {
      this.billService.getBills(this.authToken).subscribe((response: any) => {
        this.currentBills = response.map((bill: any) => ({
          ...bill,
          price: Number(bill.price),
        }));
      });
    }
  }

  currentBillClick(bill: any) {
    this.chosenBillPrice += bill.price;
    this.chosenBills.push(bill);
    this.currentBills = this.currentBills.filter(
      (currentBill: { name: any }) => currentBill.name !== bill.name,
    );
  }

  chosenBillClick(bill: any) {
    this.chosenBillPrice -= bill.price;
    this.currentBills.push(bill);
    this.chosenBills = this.chosenBills.filter(
      (currentBill: { name: any }) => currentBill.name !== bill.name,
    );
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
