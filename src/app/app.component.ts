import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { sessionConfig } from './configs/session.config';
import { SpinnerComponent } from "./components/spinner/spinner.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SpinnerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'budget-app';

  constructor(
  ) {}


}
