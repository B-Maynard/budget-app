import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Dropdown, DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { BillsService } from '../../services/bills.service';
import { sessionConfig } from '../../configs/session.config';
import { Bill, CurrentBillConfig } from './dashboard.interface';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    InputTextModule,
    CommonModule,
    FormsModule,
    DropdownModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    ToastModule
  ],
  providers: [
    ConfirmationService,
    MessageService
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit {

  public income: number = 0;
  public spent: number = 0;
  public billTotal: number = 0;
  public bills: any[] = [];

  public selectedBills: any[] = [];

  constructor(
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private billsService: BillsService
  ) { }

  ngOnInit(): void {
    this.billsService.getBills().subscribe((response: any) => {
      this.bills = response;

      if (localStorage.getItem(sessionConfig.localStorage.currentBills)) {
        let currentBillObj = JSON.parse(localStorage.getItem(sessionConfig.localStorage.currentBills)!);

        this.selectedBills = currentBillObj.bills;
        this.income = currentBillObj.income;

        this.selectedBills.forEach((bill: Bill) => {
          bill.saved = true;
          this.billTotal += bill.price;
        })
      }
    });
  }

  ngAfterViewInit(): void {
    console.log("test");
  }

  onBillChange($event: any, index: number) {
    let currentBill = this.selectedBills.find(bill => bill.index === index);
    this.billTotal -= currentBill.price;

    currentBill.name = $event?.value?.name;
    currentBill.price = $event?.value?.price;

    this.billTotal += currentBill.price;
  }

  addBill() {
    let currentIndex = 1;

    if (this.selectedBills.length > 0) {
      let currentMax = Math.max(...this.selectedBills.map(bill => bill.index));
      currentIndex = currentMax + 1;
    }

    let newBill = {
      name: "Empty Bill",
      price: 0,
      index: currentIndex
    };

    this.selectedBills.push(newBill);
    console.log(this.selectedBills);
  }

  removeBill(index: number) {
    let currentBill = this.selectedBills.find(bill => bill.index === index);
    this.billTotal -= currentBill.price;

    this.selectedBills = this.selectedBills.filter(bill => bill.index != index);
  }

  clearBills() {
    this.selectedBills = [];
    this.billTotal = 0;
  }

  confirmClear($event: Event) {
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      message: 'Are you sure you want to clear bills?',
      header: 'Confirmation',
      icon: 'bx bxs-error-alt',
      acceptIcon: "none",
      rejectIcon: "none",
      rejectButtonStyleClass: "p-button-text",
      accept: () => {
        this.clearBills();
        this.messageService.add({ severity: 'info', summary: 'Cleared', detail: 'Bills have been cleared' });
      },
      reject: () => {
        return;
      }
    });
  }

  saveBills() {
    let currentBillObj: CurrentBillConfig = {
      income: this.income,
      bills: []
    }

    this.selectedBills.forEach((bill: any) => {
      currentBillObj.bills.push(bill);
    });

    localStorage.setItem(sessionConfig.localStorage.currentBills, JSON.stringify(currentBillObj));
    this.messageService.add({ severity: 'info', summary: 'Saved', detail: 'Bills have been saved' });
  }

}
