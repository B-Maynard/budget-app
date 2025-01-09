import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
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
import { BehaviorSubject, catchError, concatMap, Subscription } from 'rxjs';
import { CardModule } from 'primeng/card';
import { CookieService } from 'ngx-cookie-service';

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
    ToastModule,
    CardModule
  ],
  providers: [
    ConfirmationService,
    MessageService
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {

  public income: number = 0;
  public spent: number = 0;
  public billTotal: number = 0;
  public spendingOffset: number = 0;

  public purchase: number | null = 0;
  public purchaseName: string | null = '';
  public purchaseTotal: number = 0;
  public currentPurchases: any[] = [];

  public bills: any[] = [];

  public selectedBills: any[] = [];

  private startupSub: Subscription | undefined | null = null;

  public hasAuthToken: boolean = false;
  public authToken: string | null = null;

  constructor(
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private billsService: BillsService,
    private cookieService: CookieService
  ) { }

  ngOnDestroy(): void {
    this.startupSub?.unsubscribe();
  }

  ngOnInit(): void {
    this.runStartup().subscribe();
  }

  private runStartup() {
    if (this.cookieService.check(sessionConfig.dbAccessToken)) {
      this.authToken = this.cookieService.get(sessionConfig.dbAccessToken);

      return this.billsService.getBills(this.authToken!).pipe(
        concatMap((response: any) => {
          this.bills = response;

          if (localStorage.getItem(sessionConfig.localStorage.currentBills)) {
            let currentBillObj = JSON.parse(localStorage.getItem(sessionConfig.localStorage.currentBills)!);
    
            this.selectedBills = currentBillObj.bills;
            this.income = currentBillObj.income;
            this.spent = currentBillObj.spent;
            this.spendingOffset = currentBillObj.spendingOffset;
            this.purchaseTotal = currentBillObj.purchaseTotal;
    
            this.selectedBills.forEach((bill: Bill) => {
              bill.saved = true;
              this.billTotal += bill.price;
            });
          }

          if (localStorage.getItem(sessionConfig.localStorage.currentPurchases)) {
            let currentPurchasesObj = JSON.parse(localStorage.getItem(sessionConfig.localStorage.currentPurchases)!);
            this.currentPurchases = currentPurchasesObj;
          }

          this.hasAuthToken = true;
          return new BehaviorSubject<boolean>(true);
        }),
        catchError(err => {
          this.hasAuthToken = false;
          this.authToken = null;
          sessionStorage.removeItem(sessionConfig.dbAccessToken);
          console.log(err);
          return new BehaviorSubject<boolean>(false);
        })
      );
    }

    return new BehaviorSubject<boolean>(false);

  }

  saveToken() {
    if (this.authToken) {
      this.cookieService.set(sessionConfig.dbAccessToken, this.authToken!);
      this.runStartup().subscribe();
    }
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
    this.purchaseTotal = 0;
    this.spendingOffset = 0;
  }

  confirmClear($event: Event) {
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      message: 'Are you sure you want to clear current configuration?',
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
      spent: this.spent,
      spendingOffset: this.spendingOffset,
      purchaseTotal: this.purchaseTotal,
      bills: []
    }

    this.selectedBills.forEach((bill: any) => {
      currentBillObj.bills.push(bill);
    });

    localStorage.setItem(sessionConfig.localStorage.currentBills, JSON.stringify(currentBillObj));
    this.messageService.add({ severity: 'info', summary: 'Saved', detail: 'Bills have been saved' });
  }

  addPurchase() {

    let tempPurchase = {
      name: this.purchaseName,
      price: this.purchase
    }

    this.currentPurchases.unshift(tempPurchase);

    if (this.purchase) {
      this.purchaseTotal += this.purchase;
    }

    localStorage.setItem(sessionConfig.localStorage.currentPurchases, JSON.stringify(this.currentPurchases));
    this.purchase = null;
  }

  confirmClearPuchases($event: Event) {
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      message: 'Are you sure you want to clear purchases and offset?',
      header: 'Confirmation',
      icon: 'bx bxs-error-alt',
      acceptIcon: "none",
      rejectIcon: "none",
      rejectButtonStyleClass: "p-button-text",
      accept: () => {
        this.clearPurchasesAndOffset();
        this.messageService.add({ severity: 'info', summary: 'Cleared', detail: 'Bills have been cleared' });
      },
      reject: () => {
        return;
      }
    });
  }

  clearPurchasesAndOffset() {
    this.purchaseTotal = 0;
    this.spendingOffset = 0;
    this.purchaseName = '';

    this.currentPurchases = [];
    localStorage.setItem(sessionConfig.localStorage.currentPurchases, '');
  }

}
