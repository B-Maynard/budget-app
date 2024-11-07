import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { sessionConfig } from './configs/session.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'budget-app';

  constructor(
  ) {}


}
