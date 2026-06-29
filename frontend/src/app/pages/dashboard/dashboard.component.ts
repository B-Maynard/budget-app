import { AfterViewInit, Component, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Select, SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { BillsService } from '../../services/bills.service';
import { PaydaysService } from '../../services/paydays.service';
import { AppConfigService } from '../../services/app-config.service';
import { sessionConfig } from '../../configs/session.config';
import { BehaviorSubject, catchError, concatMap, Subscription, forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { PasswordModule } from 'primeng/password';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    InputTextModule,
    PasswordModule,
    FormsModule,
    SelectModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
    CardModule,
    DividerModule,
    CurrencyPipe,
    DatePipe,
    DatePickerModule,
    TooltipModule
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
  public billTotal: number = 0;
  public spendingOffset: number = 0;

  public purchase: number | null = 0;
  public purchaseName: string | null = '';
  public purchaseTotal: number = 0;
  public currentPurchases: any[] = [];

  public bills: any[] = [];
  public paydays: any[] = [];

  public currentCycleStart: Date | null = null;
  public currentCycleEnd: Date | null = null;
  public generatedBills: any[] = [];

  public paydayDates: Date[] = [];
  public calendarMonth: number = new Date().getMonth();
  public calendarYear: number = new Date().getFullYear();
  public calendarDefaultDate: Date = new Date();
  public filteredPaydays: any[] = [];
  @ViewChild('paydayCalendar') paydayCalendar: any;

  private startupSub: Subscription | undefined | null = null;

  public hasAuthToken: boolean = false;
  public authToken: string | null = null;

  constructor(
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private billsService: BillsService,
    private paydaysService: PaydaysService,
    private appConfigService: AppConfigService,
    private authService: AuthService
  ) { }

  ngOnDestroy(): void {
    this.startupSub?.unsubscribe();
  }

  ngOnInit(): void {
    this.runStartup().subscribe();
  }

  private runStartup() {
    if (localStorage.getItem(sessionConfig.dbAccessToken)) {
      this.authToken = localStorage.getItem(sessionConfig.dbAccessToken);

      return forkJoin({
        bills: this.billsService.getBills(this.authToken!),
        paydays: this.paydaysService.getPaydays(this.authToken!),
        config: this.appConfigService.getConfig(this.authToken!)
      }).pipe(
        concatMap((response: any) => {
          this.bills = response.bills;
          this.paydays = response.paydays;
          this.income = Number(response.config.income) || 0;
          this.spendingOffset = Number(response.config.spendingOffset) || 0;
          this.currentPurchases = response.config.currentPurchases || [];
          
          this.purchaseTotal = 0;
          if (this.currentPurchases && this.currentPurchases.length > 0) {
            this.currentPurchases.forEach(p => {
               this.purchaseTotal += Number(p.price);
            });
          }

          // Build the dates array for the calendar from saved paydays
          this.paydayDates = this.paydays.map((p: any) => {
            let d = new Date(p.date + 'T00:00:00');
            return d;
          });

          // Calendar resets to current month on rebuild, so sync our tracking
          this.calendarMonth = new Date().getMonth();
          this.calendarYear = new Date().getFullYear();
          this.calendarDefaultDate = new Date();

          this.calculateCycle();
          this.filterPaydaysByMonth();

          this.hasAuthToken = true;
          this.authService.setAuthenticated(true);
          return new BehaviorSubject<boolean>(true);
        }),
        catchError(err => {
          this.hasAuthToken = false;
          this.authToken = null;
          sessionStorage.removeItem(sessionConfig.dbAccessToken);
          this.authService.logout();
          console.log(err);
          return new BehaviorSubject<boolean>(false);
        })
      );
    }

    return new BehaviorSubject<boolean>(false);
  }

  saveToken() {
    if (this.authToken) {
      localStorage.setItem(sessionConfig.dbAccessToken, this.authToken!);
      this.runStartup().subscribe();
    }
  }

  saveIncome() {
    if (!this.authToken) return;
    this.appConfigService.updateConfig(this.authToken, { income: this.income }).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Income updated' });
    });
  }

  saveOffset() {
    if (!this.authToken) return;
    this.appConfigService.updateConfig(this.authToken, { spendingOffset: this.spendingOffset }).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Spending offset updated' });
    });
  }

  filterPaydaysByMonth() {
    this.filteredPaydays = this.paydays.filter((p: any) => {
      let d = new Date(p.date + 'T00:00:00');
      return d.getMonth() === this.calendarMonth && d.getFullYear() === this.calendarYear;
    });
  }

  onMonthChange(event: any) {
    // PrimeNG emits { month: 1-12, year: YYYY }
    this.calendarMonth = event.month - 1;
    this.calendarYear = event.year;
    this.calendarDefaultDate = new Date(this.calendarYear, this.calendarMonth, 1);
    this.filterPaydaysByMonth();
  }

  onCalendarModelChange(newDates: Date[] | null) {
    if (!this.authToken) return;

    if (!newDates) {
      newDates = [];
    }

    let newDateStrs = newDates.map(d => this.formatDate(d));
    let oldDateStrs = this.paydays.map((p: any) => p.date);

    // Find added dates
    let added = newDateStrs.filter(d => !oldDateStrs.includes(d));
    // Find removed dates
    let removed = oldDateStrs.filter(d => !newDateStrs.includes(d));

    added.forEach(dateStr => {
      this.paydaysService.saveNewPayday(this.authToken!, dateStr).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Payday added' });
        this.refreshPaydays();
      });
    });

    removed.forEach(dateStr => {
      let existing = this.paydays.find((p: any) => p.date === dateStr);
      if (existing) {
        this.paydaysService.deletePayday(this.authToken!, existing.id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Payday removed' });
          this.refreshPaydays();
        });
      }
    });
  }

  deletePayday(id: string) {
    if (!this.authToken) return;
    let payday = this.paydays.find((p: any) => p.id === id);
    if (payday) {
      let d = new Date(payday.date + 'T00:00:00');
      let idx = this.paydayDates.findIndex(pd => pd.getTime() === d.getTime());
      if (idx > -1) {
        this.paydayDates.splice(idx, 1);
        if (this.paydayCalendar) {
          // Tell the calendar its data changed so it removes the highlight,
          // but without triggering a full re-render that resets the month.
          this.paydayCalendar.cd.markForCheck();
        }
      }
    }
    this.paydaysService.deletePayday(this.authToken, id).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Payday removed' });
      this.refreshPaydays();
    });
  }

  /** Lightweight refresh: updates paydays data and recalculates without touching the calendar view */
  private refreshPaydays() {
    if (!this.authToken) return;
    this.paydaysService.getPaydays(this.authToken).subscribe((paydays: any) => {
      this.paydays = paydays;
      this.calculateCycle();
      this.filterPaydaysByMonth();
    });
  }

  calculateCycle() {
    if (!this.paydays || this.paydays.length === 0) {
      this.currentCycleStart = null;
      this.currentCycleEnd = null;
      this.generatedBills = [];
      this.billTotal = 0;
      return;
    }

    // sort paydays by date
    let sortedPaydays = [...this.paydays].sort((a, b) => new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime());
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date | null = null;
    let end: Date | null = null;

    // Find the largest payday <= today
    for (let i = sortedPaydays.length - 1; i >= 0; i--) {
      let pDate = new Date(sortedPaydays[i].date + 'T00:00:00');

      if (pDate.getTime() <= today.getTime()) {
        start = pDate;
        if (i + 1 < sortedPaydays.length) {
          end = new Date(sortedPaydays[i + 1].date + 'T00:00:00');
        }
        break;
      }
    }

    // If we couldn't find a start payday (all paydays are in the future), just show from the first one
    if (!start) {
      start = new Date(sortedPaydays[0].date + 'T00:00:00');
      if (sortedPaydays.length > 1) {
        end = new Date(sortedPaydays[1].date + 'T00:00:00');
      }
    }

    this.currentCycleStart = start;
    this.currentCycleEnd = end;

    this.generateBillsForCycle();
  }

  generateBillsForCycle() {
    this.generatedBills = [];
    this.billTotal = 0;

    if (!this.currentCycleStart) return;

    // If there is no end date (e.g., they only added 1 payday), we can assume a 14 day cycle or just to the end of the month.
    // Let's assume up to 1 month ahead
    let end = this.currentCycleEnd;
    if (!end) {
      end = new Date(this.currentCycleStart);
      end.setMonth(end.getMonth() + 1);
    }

    this.bills.forEach(bill => {
      let occurrences = this.getOccurrences(bill, this.currentCycleStart!, end!);
      occurrences.forEach(dateStr => {
        let isPaid = bill.paidDates && bill.paidDates.includes(dateStr);
        let generated = {
          ...bill,
          occurrenceDate: dateStr,
          isPaid: isPaid
        };
        this.generatedBills.push(generated);
        if (!isPaid) {
          this.billTotal += Number(bill.price);
        }
      });
    });

    // sort generated bills by date
    this.generatedBills.sort((a, b) => new Date(a.occurrenceDate).getTime() - new Date(b.occurrenceDate).getTime());
  }

  getOccurrences(bill: any, start: Date, end: Date): string[] {
    let dates: string[] = [];
    let current = new Date(start);

    // Give a safety limit to avoid infinite loops
    let limit = 0;

    while (current < end && limit < 100) {
      limit++;
      if (bill.frequency === 'monthly') {
        let lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        let targetDay = bill.dueDay > lastDay ? lastDay : bill.dueDay;

        let targetDate = new Date(current.getFullYear(), current.getMonth(), targetDay);
        if (targetDate >= start && targetDate < end) {
          dates.push(this.formatDate(targetDate));
        }

        // Move to the first day of next month to continue checking
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      } else if (bill.frequency === 'weekly') {
        if (current.getDay() === bill.dueDayOfWeek) {
          dates.push(this.formatDate(current));
        }
        current.setDate(current.getDate() + 1);
      } else if (bill.frequency === 'yearly') {
        let targetDate = new Date(current.getFullYear(), bill.dueMonth - 1, bill.dueDay);
        if (targetDate >= start && targetDate < end) {
          dates.push(this.formatDate(targetDate));
        }
        current = new Date(current.getFullYear() + 1, 0, 1);
      } else {
        break; // one-time
      }
    }
    return dates;
  }

  formatDate(d: Date): string {
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    let year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  togglePaid(bill: any) {
    let isPaid = !bill.isPaid;
    let originalBill = this.bills.find((b: any) => (b.id || b._id) === (bill.id || bill._id));

    if (!originalBill.paidDates) {
      originalBill.paidDates = [];
    } else if (typeof originalBill.paidDates === 'string') {
      originalBill.paidDates = originalBill.paidDates.split(',');
    }

    if (isPaid) {
      if (!originalBill.paidDates.includes(bill.occurrenceDate)) {
        originalBill.paidDates.push(bill.occurrenceDate);
      }
    } else {
      originalBill.paidDates = originalBill.paidDates.filter((d: string) => d !== bill.occurrenceDate);
    }

    // Ensure price is sent as a number to satisfy backend validation
    if (originalBill.price) {
      originalBill.price = Number(originalBill.price);
    }

    this.billsService.updateBill(this.authToken!, originalBill).subscribe(() => {
      this.generateBillsForCycle();
    });
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

    if (this.authToken) {
      this.appConfigService.updateConfig(this.authToken, { currentPurchases: this.currentPurchases }).subscribe();
    }
    this.purchase = null;
    this.purchaseName = '';
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
        this.messageService.add({ severity: 'info', summary: 'Cleared', detail: 'Purchases have been cleared' });
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
    if (this.authToken) {
      this.appConfigService.updateConfig(this.authToken, { spendingOffset: 0, currentPurchases: [] }).subscribe();
    }
  }

}
