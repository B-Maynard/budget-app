import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChildren, ViewContainerRef } from '@angular/core';
import { TableModule } from 'primeng/table';
import { BillsService } from '../../services/bills.service';
import { sessionConfig } from '../../configs/session.config';
import { ButtonModule } from 'primeng/button';
import { CommonModule, KeyValue } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SpinnerService } from '../../services/spinner.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { BehaviorSubject, catchError, concatMap } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { CodeUtil } from '../../services/code-util.service';

@Component({
  selector: 'app-update-bills',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ReactiveFormsModule,
    FormsModule,
    ToastModule
  ],
  providers: [
    MessageService
  ],
  templateUrl: './update-bills.component.html',
  styleUrl: './update-bills.component.scss'
})
export class UpdateBillsComponent implements OnInit, AfterViewInit {

  @ViewChildren('billName') billNames: QueryList<ElementRef> | undefined;
  @ViewChildren('billPrice') billPrices: QueryList<ElementRef> | undefined;

  bills: any;
  billNamesDic: any[] = [];
  billPricesDic: any[] = [];
  authToken: string | null = null;

  newBillName: string | undefined;
  newBillPrice: number | undefined;
  showNewBillDialog: boolean = false;

  constructor(
    private billService: BillsService,
    private spinnerService: SpinnerService,
    private messageService: MessageService,
    private cookieService: CookieService,
    private codeUtil: CodeUtil
  ) {}

  ngOnInit(): void {
    this.authToken = this.cookieService.get(sessionConfig.dbAccessToken);
    if (this.authToken) {
      this.billService.getBills(this.authToken).subscribe((response: any) => {
        this.bills = response;
      });
    }
  }

  ngAfterViewInit(): void {
    this.spinnerService.showSpinner();
    setTimeout(() => {

      this.billNames?.forEach((element) => {
        let currentInputObj = {
          id: element.nativeElement?.attributes?.id?.value,
          element: element
        };

        this.billNamesDic.push(currentInputObj);
      });

      this.billPrices?.forEach((element) => {
        let currentInputObj = {
          id: element.nativeElement?.attributes?.id?.value,
          element: element
        };

        this.billPricesDic.push(currentInputObj);
      });

      this.spinnerService.hideSpinner();
    }, 2000);
  }

  save(billId: any) {

    let currentBillNameValue = this.billNamesDic.find(bill => bill.id === billId)?.element?.nativeElement?.value;
    let currentBillPriceValue = this.billPricesDic.find(bill => bill.id === billId)?.element?.nativeElement?.value;
    
    if (this.authToken && !this.codeUtil.isStringNullOrEmpty(currentBillNameValue) && !this.codeUtil.isStringNullOrEmpty(currentBillPriceValue)) {
      let bill = {
        _id: billId,
        name: currentBillNameValue,
        price: currentBillPriceValue
      };

      console.log(this.authToken);

      this.billService.updateBill(this.authToken, bill).pipe(
        concatMap((response: any) => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Bill Updated' });
          return new BehaviorSubject<boolean>(true);
        }),
        catchError((err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Not Saved', detail: 'There was an error updating bill' });
          console.log(err);
          return new BehaviorSubject<boolean>(false);
        })
      ).subscribe();
    }
    
  }

  addNewBill() {
    let newBill = {
      name: this.newBillName,
      price: this.newBillPrice
    };

    if (this.authToken) {
      this.billService.saveNewBill(this.authToken, newBill).pipe(
        concatMap((response: any) => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'New Bill Added' });
          return new BehaviorSubject<boolean>(true);
        }),
        catchError((err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Not Saved', detail: 'There was an error saving new bill' });
          console.log(err);
          return new BehaviorSubject<boolean>(false);
        })
      ).subscribe();
    }
  }

  showNewBill() {
    this.showNewBillDialog = !this.showNewBillDialog;
  }
}
