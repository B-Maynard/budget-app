import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateBillsComponent } from './update-bills.component';

describe('UpdateBillsComponent', () => {
  let component: UpdateBillsComponent;
  let fixture: ComponentFixture<UpdateBillsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateBillsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UpdateBillsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
