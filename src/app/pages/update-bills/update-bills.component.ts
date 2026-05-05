import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChildren, ViewContainerRef } from '@angular/core';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { BillsService } from '../../services/bills.service';
import { sessionConfig } from '../../configs/session.config';
import { ButtonModule } from 'primeng/button';
import { KeyValue } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SpinnerService } from '../../services/spinner.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { BehaviorSubject, catchError, concatMap } from 'rxjs';
import { CodeUtil } from '../../services/code-util.service';

import { DialogModule } from 'primeng/dialog';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-update-bills',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ReactiveFormsModule,
    ToastModule,
    CardModule,
    DividerModule,
    DialogModule
],
  providers: [
    MessageService
  ],
  templateUrl: './update-bills.component.html',
  styleUrl: './update-bills.component.scss'
})
export class UpdateBillsComponent implements OnInit {

  bills: any;
  authToken: string | null = null;
  
  searchTerm: string = '';

  billDialog: boolean = false;
  dialogTitle: string = 'New Bill';
  billForm: any = {
    id: null,
    name: '',
    price: null,
    frequency: 'monthly',
    dueDay: 1,
    dueMonth: 1,
    dueDayOfWeek: 0
  };

  get filteredBills() {
    if (!this.bills) return [];
    if (!this.searchTerm) return this.bills;
    return this.bills.filter((bill: any) => 
      bill.name?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  constructor(
    private billService: BillsService,
    private spinnerService: SpinnerService,
    private messageService: MessageService,
    private codeUtil: CodeUtil
  ) {}

  ngOnInit(): void {
    this.authToken = localStorage.getItem(sessionConfig.dbAccessToken);
    this.loadBills();
  }

  loadBills() {
    if (this.authToken) {
      this.billService.getBills(this.authToken).subscribe((response: any) => {
        this.bills = response;
      });
    }
  }

  openNew() {
    this.dialogTitle = 'New Bill';
    this.billForm = {
      id: null,
      name: '',
      price: null,
      frequency: 'monthly',
      dueDay: 1,
      dueMonth: 1,
      dueDayOfWeek: 0
    };
    this.billDialog = true;
  }

  editBill(bill: any) {
    this.dialogTitle = 'Edit Bill';
    this.billForm = {
      id: bill.id || bill._id,
      name: bill.name,
      price: bill.price,
      frequency: bill.frequency || 'monthly',
      dueDay: bill.dueDay || 1,
      dueMonth: bill.dueMonth || 1,
      dueDayOfWeek: bill.dueDayOfWeek || 0
    };
    this.billDialog = true;
  }

  hideDialog() {
    this.billDialog = false;
  }

  saveBill() {
    if (!this.authToken || this.codeUtil.isStringNullOrEmpty(this.billForm.name) || !this.billForm.price) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Name and Price are required' });
      return;
    }

    // Convert fields to numbers to ensure correct JSON payload
    let payload = { ...this.billForm };
    if (payload.dueDay) payload.dueDay = Number(payload.dueDay);
    if (payload.dueMonth) payload.dueMonth = Number(payload.dueMonth);
    if (payload.dueDayOfWeek) payload.dueDayOfWeek = Number(payload.dueDayOfWeek);

    if (this.billForm.id) {
      this.billService.updateBill(this.authToken, payload).pipe(
        concatMap((response: any) => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Bill Updated' });
          this.loadBills();
          this.hideDialog();
          return new BehaviorSubject<boolean>(true);
        }),
        catchError((err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Not Saved', detail: 'There was an error updating bill' });
          return new BehaviorSubject<boolean>(false);
        })
      ).subscribe();
    } else {
      this.billService.saveNewBill(this.authToken, payload).pipe(
        concatMap((response: any) => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'New Bill Added' });
          this.loadBills();
          this.hideDialog();
          return new BehaviorSubject<boolean>(true);
        }),
        catchError((err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Not Saved', detail: 'There was an error saving new bill' });
          return new BehaviorSubject<boolean>(false);
        })
      ).subscribe();
    }
  }

  delete(billId: any) {
    if (this.authToken) {
      this.billService.deleteBill(this.authToken, billId).pipe(
        concatMap((response: any) => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Bill Deleted Successfully' });
          this.loadBills();
          return new BehaviorSubject<boolean>(true);
        }),
        catchError((err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'There was an error deleting bill' });
          return new BehaviorSubject<boolean>(false);
        })
      ).subscribe();
    }
  }
}
