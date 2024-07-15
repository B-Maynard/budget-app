import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DatabaseService } from './services/database.service';
import { sessionConfig } from './configs/session.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'budget-app';

  constructor(
    private databaseService: DatabaseService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem(sessionConfig.dbAccessToken)) {
      this.databaseService.auth().subscribe((response: any) => {
        sessionStorage.setItem(sessionConfig.dbAccessToken, response?.access_token);
        sessionStorage.setItem(sessionConfig.dbRefreshToken, response?.refresh_token);
      });
    }

  }
}
