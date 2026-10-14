import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="paths[name] || paths[\'grid\']"/></svg>',
  styles: [
    ':host{display:inline-flex;width:20px;height:20px;flex-shrink:0;align-items:center;justify-content:center}svg{width:100%;height:100%}',
  ],
})
export class IconComponent {
  @Input() name = 'grid';
  paths: Record<string, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    home: 'm3 10 9-7 9 7v10H3z M9 20v-7h6v7',
    bills: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',
    activity: 'M3 12h4l3-8 4 16 3-8h4',
    plan: 'M12 3v18 M5 7h14 M5 17h14 M5 7l-3 6h6z M19 7l-3 6h6z',
    plus: 'M12 5v14 M5 12h14',
    arrow: 'M5 12h14 m-5-5 5 5-5 5',
    back: 'M19 12H5 m5-5-5 5 5 5',
    check: 'm5 12 4 4L19 6',
    down: 'm6 9 6 6 6-6',
    close: 'm6 6 12 12 M6 18 18 6',
    calendar: 'M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16',
    wallet: 'M3 5h16v15H3z M16 10h5v6h-5z M3 5l13-3v3',
    leaf: 'M20 3C8 2 2 8 5 15s14 5 15-12z M4 21 15 10',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-7z',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
    card: 'M3 5h18v14H3z M3 10h18 M7 15h3',
    coffee:
      'M4 8h12v7a6 6 0 0 1-12 0z M16 8h2a3 3 0 0 1 0 6h-2 M7 3v2 M12 3v2 M3 21h15',
    bag: 'M4 8h16l-1 13H5z M8 9V6a4 4 0 0 1 8 0v3',
    car: 'm5 6-2 7v6h18v-6l-2-7z M3 13h18 M7 16h1 M16 16h1 M5 19v2 M19 19v2',
    target:
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 11v2',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5l1.5 1.5 M5 19l1.5-1.5 M17.5 6.5l1.5-1.5',
    edit: 'm15 4 5 5 M4 15 16 3l5 5L9 20H4z',
    trash: 'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
    upload: 'M12 16V3 m-4 4 4-4 4 4 M4 15v6h16v-6',
    moon: 'M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15',
  };
}
