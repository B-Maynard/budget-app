import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { UpdateBillsComponent } from './pages/update-bills/update-bills.component';
import { BillTotalComponent } from './pages/billtotal/billtotal.component';

export const routes: Routes = [
    {path: "", component: DashboardComponent},
    {path: "update", component: UpdateBillsComponent},
    {path: "billtotal", component: BillTotalComponent},
];
