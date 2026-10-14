import { Component, DestroyRef, ElementRef, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../components/icon.component';

@Component({
  selector: 'app-mockups',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './mockups.component.html',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class MockupsComponent {
  // A fixed local stylesheet keeps these six design experiments inside the shadow root.
  stylesheet = inject(DomSanitizer).bypassSecurityTrustResourceUrl('assets/mockups/design-lab.css');
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  @ViewChild('purchaseDialog') purchaseDialog?: ElementRef<HTMLDialogElement>;
  concepts = [
    { id: 'ledger', name: 'Ledger', number: '01', label: 'A little more perspective.', description: 'A warm, editorial home for your money. Clear hierarchy, generous space, and a balance you can understand at a glance.', ux: 'Overview before detail', tags: ['Warm minimalism', 'Editorial', 'Desktop & mobile'], color: '#b95136', icon: 'bills' },
    { id: 'orbit', name: 'Orbit', number: '02', label: 'Everything in your orbit.', description: 'A precise dark dashboard with a persistent sidebar, compact insights, and your next actions always within reach.', ux: 'A dashboard for daily use', tags: ['Dark mode', 'Data rich', 'Sidebar navigation'], color: '#bdce7a', icon: 'moon' },
    { id: 'grove', name: 'Grove', number: '03', label: 'Make room to grow.', description: 'A gentler way to budget. Give spending a home in visual envelopes and see what’s available without doing the math.', ux: 'Budget by spending category', tags: ['Calm & natural', 'Envelopes', 'Visual budgets'], color: '#46745a', icon: 'leaf' },
    { id: 'current', name: 'Current', number: '04', label: 'Know what comes next.', description: 'Your budget follows your paydays. A chronological view connects income, bills, and the money left between them.', ux: 'Plan around the next payday', tags: ['Payday timeline', 'Blue & white', 'Cash flow'], color: '#295be6', icon: 'activity' },
    { id: 'studio', name: 'Studio', number: '05', label: 'Less friction. More control.', description: 'A focused workspace for getting things done. Compact tables, clear status labels, and fast access to the details.', ux: 'Manage money in one workspace', tags: ['Compact', 'Table focused', 'Power users'], color: '#6552b5', icon: 'grid' },
    { id: 'pocket', name: 'Pocket', number: '06', label: 'A good day for your money.', description: 'A bright daily check-in designed for your phone. One useful number, quick spending entry, and a short list of what’s next.', ux: 'A quick check-in on the go', tags: ['Mobile first', 'Playful', 'Daily focus'], color: '#e55d42', icon: 'wallet' },
  ];
  concept = '';
  view = 'Overview';
  tabs = [
    { name: 'Overview', icon: 'home' }, { name: 'Bills', icon: 'bills' },
    { name: 'Activity', icon: 'activity' }, { name: 'Debt plan', icon: 'plan' }
  ];
  bills = [
    { name: 'Rent', amount: 1450, day: 15, icon: 'home', paid: false },
    { name: 'Internet', amount: 65, day: 16, icon: 'activity', paid: false },
    { name: 'Electricity', amount: 110, day: 18, icon: 'bolt', paid: false },
    { name: 'Car insurance', amount: 180, day: 20, icon: 'car', paid: false },
    { name: 'Phone', amount: 75, day: 22, icon: 'card', paid: false },
  ];
  purchases = [
    { name: 'Whole Foods', amount: 84.2, category: 'Groceries', date: 'Oct 14', icon: 'bag' },
    { name: 'Neighborhood café', amount: 28, category: 'Dining', date: 'Oct 13', icon: 'coffee' },
    { name: 'Shell', amount: 50, category: 'Transport', date: 'Oct 12', icon: 'car' },
    { name: 'Trader Joe’s', amount: 164.3, category: 'Groceries', date: 'Oct 11', icon: 'bag' },
    { name: 'Dinner with friends', amount: 60, category: 'Dining', date: 'Oct 10', icon: 'coffee' },
  ];
  categories = [
    { name: 'Groceries', limit: 550, icon: 'bag', color: '#649276' },
    { name: 'Dining', limit: 200, icon: 'coffee', color: '#c98f4d' },
    { name: 'Transport', limit: 160, icon: 'car', color: '#6d88a8' },
    { name: 'Other', limit: 250, icon: 'wallet', color: '#9582a6' },
  ];
  search = '';
  category = '';
  billFilter = 'All';
  purchaseName = '';
  purchaseAmount: number | null = null;
  purchaseCategory = 'Groceries';
  message = '';
  income = 4200;
  offset = 0;
  extraPayment = 100;
  get selected() { return this.concepts.find(c => c.id === this.concept); }
  get totalBills() { return this.bills.reduce((sum, b) => sum + b.amount, 0); }
  get totalSpent() { return this.purchases.reduce((sum, p) => sum + p.amount, 0); }
  get available() { return this.income + this.offset - this.totalBills - this.totalSpent; }
  get unpaid() { return this.bills.filter(b => !b.paid); }
  get shownBills() { return this.bills.filter(b => this.billFilter === 'All' || (this.billFilter === 'Paid' ? b.paid : !b.paid)); }
  get shownPurchases() { return this.purchases.filter(p => p.name.toLowerCase().includes(this.search.toLowerCase()) && (!this.category || p.category === this.category)); }
  get payoffMonths() { return Math.ceil(3200 / (150 + this.extraPayment)); }
  get previous() { return this.concepts[(this.concepts.findIndex(c => c.id === this.concept) + 5) % 6]; }
  get next() { return this.concepts[(this.concepts.findIndex(c => c.id === this.concept) + 1) % 6]; }
  spent(category: string) { return this.purchases.filter(p => p.category === category).reduce((sum, p) => sum + p.amount, 0); }
  percent(category: string, limit: number) { return Math.min(100, this.spent(category) / limit * 100); }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.concept = params.get('concept') || '';
      if (this.concept && !this.selected) { void this.router.navigate(['/mockups']); }
      this.view = 'Overview';
      this.message = '';
      this.purchaseDialog?.nativeElement.close();
      document.title = this.selected ? `${this.selected.name} · Budget design lab` : 'Budget design lab';
      window.scrollTo(0, 0);
    });
  }
  chooseConcept(concept: string) { void this.router.navigate(['/mockups', concept]); }
  navigate(view: string) { this.view = view; this.message = ''; window.scrollTo(0, 0); }
  toggleBill(bill: typeof this.bills[number]) {
    bill.paid = !bill.paid;
    this.message = `${bill.name} ${bill.paid ? 'marked paid' : 'marked unpaid'} in this demo.`;
  }
  openPurchase() {
    this.purchaseName = ''; this.purchaseAmount = null;
    this.purchaseDialog?.nativeElement.showModal();
  }
  addPurchase() {
    if (!this.purchaseName.trim() || !this.purchaseAmount || this.purchaseAmount <= 0 || !Number.isFinite(this.purchaseAmount)) return;
    this.purchases.unshift({ name: this.purchaseName.trim(), amount: Math.round(this.purchaseAmount * 100) / 100, category: this.purchaseCategory, date: 'Oct 14', icon: this.categories.find(c => c.name === this.purchaseCategory)?.icon || 'bag' });
    this.purchaseDialog?.nativeElement.close();
    this.message = 'Purchase added. Your demo balance and category spending are updated.';
  }
}
