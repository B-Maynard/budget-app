import { Component, OnInit } from '@angular/core';
import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { IconComponent } from './components/icon.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'budget-app';
  isAuthenticated = false;
  isDark = document.documentElement.classList.contains('app-dark');

  toggleTheme() {
    this.isDark = !this.isDark;
    document.documentElement.classList.toggle('app-dark', this.isDark);
    localStorage.setItem('current_theme', this.isDark ? 'dark' : 'light');
  }

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  get isMockup(): boolean {
    return this.router.url.split('?')[0].split('/')[1] === 'mockups';
  }

  ngOnInit() {
    this.authService.isAuthenticated$.subscribe((status) => {
      this.isAuthenticated = status;
    });
  }
}
