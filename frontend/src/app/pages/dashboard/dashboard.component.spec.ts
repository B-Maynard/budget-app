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
});
