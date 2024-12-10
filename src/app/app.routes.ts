import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { UpdateBillsComponent } from './pages/update-bills/update-bills.component';

export const routes: Routes = [
    {path: "", component: DashboardComponent},
    {path: "update", component: UpdateBillsComponent}
];
