import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { BillsService } from '../../services/bills.service';
import { PaydaysService } from '../../services/paydays.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { sessionConfig } from '../../configs/session.config';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    localStorage.removeItem(sessionConfig.dbAccessToken);
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: BillsService, useValue: {} },
        { provide: PaydaysService, useValue: {} },
        { provide: AppConfigService, useValue: {} },
        { provide: AuthService, useValue: { setAuthenticated: jasmine.createSpy(), logout: jasmine.createSpy() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calculates money available from dashboard values only', () => {
    component.income = 1000;
    component.spendingOffset = 100;
    component.billTotal = 200;
    component.purchaseTotal = 300;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.available-value').textContent).toContain('$600.00');
  });

  it('projects look-ahead balance from paydays and bills in range', () => {
    component.income = 1000;
    component.spendingOffset = 0;
    component.purchaseTotal = 0;
    component.bills = [
      { name: 'Rent', price: 300, frequency: 'monthly', dueDay: 5, paidDates: [] },
      { name: 'Out of range', price: 999, frequency: 'monthly', dueDay: 20, paidDates: [] },
    ];
    component.paydays = [{ date: '2026-10-15' }];
    component.lookAheadFrom = '2026-10-01';
    component.lookAheadTo = '2026-10-16';

    expect(component.lookAhead?.projected).toBe(700);
  });
});
