import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SpinnerService } from '../../services/spinner.service';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [
    CommonModule,
    ProgressSpinnerModule
  ],
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.scss'
})
export class SpinnerComponent {

  constructor(
    public spinnerService: SpinnerService
  ) {}

}
