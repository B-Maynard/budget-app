import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChildren, ViewContainerRef } from '@angular/core';
import { TableModule } from 'primeng/table';
import { BillsService } from '../../services/bills.service';
import { sessionConfig } from '../../configs/session.config';
import { CodeUtil } from '../../services/code-util.service';
import { ButtonModule } from 'primeng/button';
import { CommonModule, KeyValue } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SpinnerService } from '../../services/spinner.service';

@Component({
  selector: 'app-update-bills',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './update-bills.component.html',
  styleUrl: './update-bills.component.scss'
})
export class UpdateBillsComponent implements OnInit, AfterViewInit {

  @ViewChildren('billInput') billInputs: QueryList<ElementRef> | undefined;

  bills: any;
  billInputsDic: any[] = [];
  authToken: string | null = null;

  newBillName: string | undefined;
  newBillPrice: number | undefined;
  showNewBillDialog: boolean = false;

  constructor(
    private billService: BillsService,
    private codeUtil: CodeUtil,
    private spinnerService: SpinnerService
  ) {}

  ngOnInit(): void {
    this.authToken = this.codeUtil.getSessionStorageItem(sessionConfig.dbAccessToken);
    if (this.authToken) {
      this.billService.getBills(this.authToken).subscribe((response: any) => {
        this.bills = response;
      });
    }
  }

  ngAfterViewInit(): void {
    this.spinnerService.showSpinner();
    setTimeout(() => {
      this.billInputs?.forEach((element) => {
        let currentInputObj = {
          id: element.nativeElement?.attributes?.id?.value,
          element: element
        };

        this.billInputsDic.push(currentInputObj);
      });

      console.log(this.billInputsDic);
      this.spinnerService.hideSpinner();
    }, 2000);
  }

  save(bill: any) {
    console.log(bill);
    if (this.authToken) {
      this.billService.updateBill(this.authToken, bill).subscribe((response: any) => {
        console.log(response);
      });
    }
    
  }

  addNewBill() {
    let newBill = {
      name: this.newBillName,
      price: this.newBillPrice
    };

    console.log(newBill);
  }

  showNewBill() {
    this.showNewBillDialog = !this.showNewBillDialog;
  }
}
