import { Component, OnInit } from '@angular/core';
import { TableModule } from 'primeng/table';
import { BillsService } from '../../services/bills.service';
import { sessionConfig } from '../../configs/session.config';
import { CodeUtil } from '../../services/code-util.service';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-update-bills',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule
  ],
  templateUrl: './update-bills.component.html',
  styleUrl: './update-bills.component.scss'
})
export class UpdateBillsComponent implements OnInit {

  bills: any;
  authToken: string | null = null;

  constructor(
    private billService: BillsService,
    private codeUtil: CodeUtil
  ) {}

  ngOnInit(): void {
    this.authToken = this.codeUtil.getSessionStorageItem(sessionConfig.dbAccessToken);
    if (this.authToken) {
      this.billService.getBills(this.authToken).subscribe((response: any) => {
        this.bills = response;
      });
    }
  }

  save(bill: any) {
    console.log(bill);
    if (this.authToken) {
      this.billService.updateBill(this.authToken, bill).subscribe((response: any) => {
        console.log(response);
      });
    }
    
  }
}
