import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BilltotalComponent } from './billtotal.component';

describe('BilltotalComponent', () => {
  let component: BilltotalComponent;
  let fixture: ComponentFixture<BilltotalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BilltotalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BilltotalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
