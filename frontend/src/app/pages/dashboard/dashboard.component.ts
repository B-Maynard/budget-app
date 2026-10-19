import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { PasswordModule } from 'primeng/password';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import {
  BehaviorSubject,
  catchError,
  concatMap,
  Subscription,
  forkJoin,
} from 'rxjs';
import { IconComponent } from '../../components/icon.component';
import { BillsService } from '../../services/bills.service';
import { PaydaysService } from '../../services/paydays.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { sessionConfig } from '../../configs/session.config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IconComponent,
    FormsModule,
    ConfirmDialogModule,
    ToastModule,
    CurrencyPipe,
    DatePipe,
    PasswordModule,
    DatePickerModule,
    DialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  public purchaseDialog = false;
  private readonly today = new Date();
  get available() {
    return (
      this.income + this.spendingOffset - this.billTotal - this.purchaseTotal
    );
  }
  get unpaidCount() {
    return this.generatedBills.filter((b) => !b.isPaid).length;
  }
  get daysUntilPayday() {
    if (!this.currentCycleEnd) return null;
    const now = this.today,
      end = this.currentCycleEnd;
    return Math.max(
      0,
      Math.round(
        (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
          Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
          86400000,
      ),
    );
  }
  get cycleProgress() {
    if (!this.currentCycleStart || !this.currentCycleEnd) return 0;
    return Math.min(
      100,
      Math.max(
        0,
        ((this.today.getTime() - this.currentCycleStart.getTime()) /
          (this.currentCycleEnd.getTime() - this.currentCycleStart.getTime())) *
          100,
      ),
    );
  }
  openPurchase() {
    this.purchaseName = '';
    this.purchase = null;
    this.purchaseDialog = true;
  }

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

  public lookAheadBalance: number | null = null;
  public lookAheadFrom = '';
  public lookAheadTo = '';

  public paydayDates: Date[] = [];
  public calendarMonth: number = new Date().getMonth();
  public calendarYear: number = new Date().getFullYear();
  public calendarDefaultDate: Date = new Date();
  public filteredPaydays: any[] = [];
  @ViewChild('paydayCalendar') paydayCalendar: any;

  private startupSub: Subscription | undefined | null = null;

  public authError = '';
  public hasAuthToken: boolean = false;
  public authToken: string | null = null;

  constructor(
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private billsService: BillsService,
    private paydaysService: PaydaysService,
    private appConfigService: AppConfigService,
    private authService: AuthService,
  ) {}

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
        config: this.appConfigService.getConfig(this.authToken!),
      }).pipe(
        concatMap((response: any) => {
          this.bills = response.bills;
          this.paydays = response.paydays;
          this.income = Number(response.config.income) || 0;
          this.spendingOffset = Number(response.config.spendingOffset) || 0;
          this.currentPurchases = response.config.currentPurchases || [];

          this.purchaseTotal = 0;
          if (this.currentPurchases && this.currentPurchases.length > 0) {
            this.currentPurchases.forEach((p) => {
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
          this.setLookAheadDefaults();

          this.hasAuthToken = true;
          this.authService.setAuthenticated(true);
          return new BehaviorSubject<boolean>(true);
        }),
        catchError((err) => {
          this.authError =
            'Could not sign in. Check your token and connection.';
          this.hasAuthToken = false;
          this.authToken = null;
          sessionStorage.removeItem(sessionConfig.dbAccessToken);
          this.authService.logout();
          console.log(err);
          return new BehaviorSubject<boolean>(false);
        }),
      );
    }

    return new BehaviorSubject<boolean>(false);
  }

  saveToken() {
    this.authError = '';
    if (this.authToken) {
      localStorage.setItem(sessionConfig.dbAccessToken, this.authToken!);
      this.runStartup().subscribe();
    }
  }

  saveIncome() {
    if (!this.authToken) return;
    this.appConfigService
      .updateConfig(this.authToken, { income: this.income })
      .subscribe(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Income updated',
        });
      });
  }

  saveOffset() {
    if (!this.authToken) return;
    this.appConfigService
      .updateConfig(this.authToken, { spendingOffset: this.spendingOffset })
      .subscribe(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Spending offset updated',
        });
      });
  }

  filterPaydaysByMonth() {
    this.filteredPaydays = this.paydays.filter((p: any) => {
      let d = new Date(p.date + 'T00:00:00');
      return (
        d.getMonth() === this.calendarMonth &&
        d.getFullYear() === this.calendarYear
      );
    });
  }

  onMonthChange(event: any) {
    // PrimeNG emits { month: 1-12, year: YYYY }
    this.calendarMonth = event.month - 1;
    this.calendarYear = event.year;
    this.calendarDefaultDate = new Date(
      this.calendarYear,
      this.calendarMonth,
      1,
    );
    this.filterPaydaysByMonth();
  }

  onCalendarModelChange(newDates: Date[] | null) {
    if (!this.authToken) return;

    if (!newDates) {
      newDates = [];
    }

    let newDateStrs = newDates.map((d) => this.formatDate(d));
    let oldDateStrs = this.paydays.map((p: any) => p.date);

    // Find added dates
    let added = newDateStrs.filter((d) => !oldDateStrs.includes(d));
    // Find removed dates
    let removed = oldDateStrs.filter((d) => !newDateStrs.includes(d));

    added.forEach((dateStr) => {
      this.paydaysService
        .saveNewPayday(this.authToken!, dateStr)
        .subscribe(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Payday added',
          });
          this.refreshPaydays();
        });
    });

    removed.forEach((dateStr) => {
      let existing = this.paydays.find((p: any) => p.date === dateStr);
      if (existing) {
        this.paydaysService
          .deletePayday(this.authToken!, existing.id)
          .subscribe(() => {
            this.messageService.add({
              severity: 'success',
              summary: 'Deleted',
              detail: 'Payday removed',
            });
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
      let idx = this.paydayDates.findIndex(
        (pd) => pd.getTime() === d.getTime(),
      );
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
      this.messageService.add({
        severity: 'success',
        summary: 'Deleted',
        detail: 'Payday removed',
      });
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
    let sortedPaydays = [...this.paydays].sort(
      (a, b) =>
        new Date(a.date + 'T00:00:00').getTime() -
        new Date(b.date + 'T00:00:00').getTime(),
    );
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

    this.generatedBills = this.occurrencesBetween(this.currentCycleStart, end);
    this.billTotal = this.generatedBills
      .filter((b) => !b.isPaid)
      .reduce((sum, b) => sum + Number(b.price), 0);
  }

  /** Every bill occurrence in [start, end), sorted by date. */
  occurrencesBetween(start: Date, end: Date): any[] {
    let generated: any[] = [];
    this.bills.forEach((bill) => {
      this.getOccurrences(bill, start, end).forEach((dateStr) => {
        generated.push({
          ...bill,
          occurrenceDate: dateStr,
          isPaid: bill.paidDates && bill.paidDates.includes(dateStr),
        });
      });
    });
    return generated.sort(
      (a, b) =>
        new Date(a.occurrenceDate).getTime() -
        new Date(b.occurrenceDate).getTime(),
    );
  }

  /** Projection for a user-picked window: entered balance minus bills in range. Null if the range is invalid. */
  get lookAhead() {
    const start = this.day(this.lookAheadFrom);
    const end = this.day(this.lookAheadTo);
    if (!start || !end || end <= start) return null;

    const bills = this.occurrencesBetween(start, end);
    const billTotal = bills
      .filter((b) => !b.isPaid)
      .reduce((sum, b) => sum + Number(b.price), 0);
    const balance = Number(this.lookAheadBalance) || 0;

    return {
      bills,
      billTotal,
      balance,
      projected: balance + this.spendingOffset - billTotal - this.purchaseTotal,
    };
  }

  /** Default window: next pay period (next payday up to the payday after it). */
  setLookAheadDefaults() {
    if (this.lookAheadFrom) return;
    const from =
      this.currentCycleEnd ?? new Date(new Date().setHours(0, 0, 0, 0));
    const to =
      this.paydays
        .map((p: any) => this.day(p.date)!)
        .filter((d) => d > from)
        .sort((a, b) => a.getTime() - b.getTime())[0] ??
      new Date(new Date(from).setMonth(from.getMonth() + 1));
    this.lookAheadFrom = this.formatDate(from);
    this.lookAheadTo = this.formatDate(to);
  }

  private day(dateStr: string | null | undefined): Date | null {
    return dateStr ? new Date(dateStr + 'T00:00:00') : null;
  }

  getOccurrences(bill: any, start: Date, end: Date): string[] {
    let dates: string[] = [];
    let current = new Date(start);
    let interval = bill.interval || 1;

    // Give a safety limit to avoid infinite loops
    let limit = 0;

    // ponytail: weekly steps one day at a time, so this caps windows at ~1000 days
    while (current < end && limit < 1000) {
      limit++;
      if (bill.frequency === 'monthly') {
        let lastDay = new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          0,
        ).getDate();
        let targetDay = bill.dueDay > lastDay ? lastDay : bill.dueDay;

        let targetDate = new Date(
          current.getFullYear(),
          current.getMonth(),
          targetDay,
        );
        if (targetDate >= start && targetDate < end) {
          dates.push(this.formatDate(targetDate));
        }

        // Move to the first day of next month to continue checking
        current = new Date(
          current.getFullYear(),
          current.getMonth() + interval,
          1,
        );
      } else if (bill.frequency === 'weekly') {
        if (current.getDay() === bill.dueDayOfWeek) {
          dates.push(this.formatDate(current));
          // ponytail: step by interval*7 after a match to skip N weeks
          current.setDate(current.getDate() + interval * 7);
        } else {
          current.setDate(current.getDate() + 1);
        }
      } else if (bill.frequency === 'yearly') {
        let targetDate = new Date(
          current.getFullYear(),
          bill.dueMonth - 1,
          bill.dueDay,
        );
        if (targetDate >= start && targetDate < end) {
          dates.push(this.formatDate(targetDate));
        }
        current = new Date(current.getFullYear() + interval, 0, 1);
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
    let originalBill = this.bills.find(
      (b: any) => (b.id || b._id) === (bill.id || bill._id),
    );

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
      originalBill.paidDates = originalBill.paidDates.filter(
        (d: string) => d !== bill.occurrenceDate,
      );
    }

    // Ensure price is sent as a number to satisfy backend validation
    if (originalBill.price) {
      originalBill.price = Number(originalBill.price);
    }

    this.billsService
      .updateBill(this.authToken!, originalBill)
      .subscribe(() => {
        this.generateBillsForCycle();
      });
  }

  addPurchase() {
    if (
      !this.purchaseName?.trim() ||
      !this.purchase ||
      this.purchase <= 0 ||
      !Number.isFinite(this.purchase)
    )
      return;
    let tempPurchase = {
      name: this.purchaseName,
      price: this.purchase,
    };

    this.currentPurchases.unshift(tempPurchase);

    if (this.purchase) {
      this.purchaseTotal += this.purchase;
    }

    if (this.authToken) {
      this.appConfigService
        .updateConfig(this.authToken, {
          currentPurchases: this.currentPurchases,
        })
        .subscribe();
    }
    this.purchase = null;
    this.purchaseName = '';
    this.purchaseDialog = false;
  }

  confirmClearPuchases($event: Event) {
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      message: 'Are you sure you want to clear purchases and offset?',
      header: 'Confirmation',
      icon: 'bx bxs-error-alt',
      acceptIcon: 'none',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.clearPurchasesAndOffset();
        this.messageService.add({
          severity: 'info',
          summary: 'Cleared',
          detail: 'Purchases have been cleared',
        });
      },
      reject: () => {
        return;
      },
    });
  }

  clearPurchasesAndOffset() {
    this.purchaseTotal = 0;
    this.spendingOffset = 0;
    this.purchaseName = '';

    this.currentPurchases = [];
    if (this.authToken) {
      this.appConfigService
        .updateConfig(this.authToken, {
          spendingOffset: 0,
          currentPurchases: [],
        })
        .subscribe();
    }
  }
}
