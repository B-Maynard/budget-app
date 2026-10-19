import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  catchError,
  exhaustMap,
  filter,
  firstValueFrom,
  timer,
} from 'rxjs';
import {
  BankConnectionsService,
  BankConnectionState,
  BankLinkSession,
} from '../services/bank-connections.service';

@Component({
  selector: 'app-bank-connections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="surface bank-connections" aria-label="Connected banks">
      <div class="bank-heading">
        <div>
          <h2>Connected banks</h2>
          <p>
            Transactions import automatically when your bank makes them
            available.
          </p>
        </div>
        <button
          class="primary-button"
          (click)="connect()"
          [disabled]="!state?.enabled || busy"
        >
          {{ busy ? 'Working…' : 'Connect bank' }}
        </button>
      </div>
      @if (state) {
        @if (!state.enabled) {
          <p class="bank-note">{{ state.message }}</p>
        } @else {
          @if (state.environment === 'sandbox') {
            <p class="bank-note">
              Sandbox mode · test accounts only. Real bank accounts require
              production access.
            </p>
          }
          <label class="bank-start"
            >Import new connections from
            <input
              type="date"
              [(ngModel)]="importStartDate"
              aria-label="Bank import start date"
              [disabled]="busy"
          /></label>
          <p class="bank-note">
            Already imported CSVs? Choose the day after your last imported
            transaction to avoid overlapping history. USD accounts are
            supported.
          </p>
        }
        @for (bank of state.connections; track bank.id) {
          <div class="bank-row">
            <div class="bank-info">
              <strong>{{ bank.institutionName }}</strong>
              <span
                class="bank-status"
                [class.problem]="
                  bank.status === 'attention' || bank.status === 'error'
                "
                >{{
                  bank.status === 'active'
                    ? 'Connected'
                    : bank.status === 'attention'
                      ? 'Reconnect required'
                      : bank.status === 'disconnected'
                        ? 'Disconnected'
                        : 'Sync needs attention'
                }}</span
              >
              @for (account of bank.accounts; track account.id) {
                <p>
                  {{ account.name }}
                  {{ account.mask ? '••' + account.mask : '' }}
                </p>
              }
              <p>
                Imported since {{ bank.importStartDate | date: 'mediumDate' }} ·
                {{
                  bank.lastSyncedAt
                    ? 'Last checked ' + (bank.lastSyncedAt | date: 'medium')
                    : 'Waiting for first sync'
                }}
              </p>
              @if (bank.errorCode) {
                <p class="problem">
                  {{ bank.errorCode }} ·
                  {{
                    bank.status === 'attention'
                      ? 'Reconnect to restore bank access.'
                      : 'We will retry automatically. You can also sync again.'
                  }}
                </p>
              }
            </div>
            @if (bank.status !== 'disconnected') {
              <div class="bank-actions">
                @if (bank.status === 'attention') {
                  <button
                    class="secondary-button"
                    (click)="connect(bank.id)"
                    [disabled]="busy || !state.enabled"
                  >
                    Reconnect
                  </button>
                }
                <button
                  class="secondary-button"
                  (click)="sync(bank.id)"
                  [disabled]="busy || !state.enabled"
                >
                  Sync available
                </button>
                @if (state.refreshEnabled) {
                  <button
                    class="secondary-button"
                    (click)="sync(bank.id, true)"
                    [disabled]="busy || !state.enabled"
                  >
                    Refresh bank
                  </button>
                }
                <button
                  class="secondary-button"
                  (click)="disconnectId = bank.id"
                  [disabled]="busy || !state.enabled"
                >
                  Disconnect
                </button>
                @if (disconnectId === bank.id) {
                  <div class="disconnect-confirm">
                    <span
                      >Stop syncing this bank? Imported transactions will be
                      kept.</span
                    ><button
                      class="secondary-button"
                      (click)="disconnect(bank.id)"
                    >
                      Disconnect bank</button
                    ><button
                      class="secondary-button"
                      (click)="disconnectId = null"
                    >
                      Cancel
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        } @empty {
          @if (state.enabled) {
            <p class="bank-note">
              Connect a checking, savings, or credit card account to get
              started.
            </p>
          }
        }
        <p class="bank-note">
          Bank updates may take hours. This page checks for newly imported
          transactions every five seconds. “Sync available” checks data Plaid
          already has.
        </p>
      }
      @if (message) {
        <p class="bank-note" role="status">{{ message }}</p>
      }
      @if (error) {
        <p class="error" role="alert">{{ error }}</p>
      }
    </section>
  `,
  styles: [
    `
      .bank-connections {
        margin-bottom: 24px;
      }
      .bank-heading,
      .bank-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      h2 {
        margin: 0 0 8px;
        font-size: 18px;
      }
      p {
        margin: 6px 0;
        font-size: 13px;
        color: var(--muted);
      }
      .bank-note {
        font-size: 12px;
        line-height: 1.6;
        margin: 12px 0 0;
      }
      .bank-start {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 13px;
        margin-top: 16px;
      }
      .bank-row {
        padding-top: 18px;
        margin-top: 18px;
        border-top: 1px solid var(--line);
      }
      .bank-info {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .bank-status {
        color: var(--success);
        display: inline-block;
        font-size: 12px;
        margin-left: 10px;
      }
      .problem {
        color: var(--danger, #b45309);
      }
      .bank-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .disconnect-confirm {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      @media (max-width: 760px) {
        .bank-heading,
        .bank-row {
          flex-direction: column;
        }
        .bank-actions {
          justify-content: flex-start;
        }
      }
    `,
  ],
})
export class BankConnectionsComponent implements OnInit, OnDestroy {
  @Output() transactionsChanged = new EventEmitter<void>();
  private readonly destroyRef = inject(DestroyRef);
  state: BankConnectionState | null = null;
  importStartDate = this.localDate();
  busy = false;
  error = '';
  message = '';
  disconnectId: number | null = null;
  private revision: string | null = null;
  private handler?: { destroy(): void };
  private destroyed = false;
  constructor(private readonly banks: BankConnectionsService) {}

  ngOnInit() {
    timer(0, 5000)
      .pipe(
        filter(() => !document.hidden),
        exhaustMap(() =>
          this.banks.state().pipe(
            catchError(() => {
              this.error =
                'Could not check bank connections. Retrying automatically.';
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.updateState(state));
    const session = this.banks.resume();
    if (session) {
      this.busy = true;
      void this.open(session, location.href.split('#')[0]);
    } else if (new URLSearchParams(location.search).has('oauth_state_id')) {
      this.error =
        'The bank connection session expired. Please connect your bank again.';
      this.banks.clearSession();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.handler?.destroy();
  }
  private updateState(state: BankConnectionState) {
    if (
      this.error === 'Could not check bank connections. Retrying automatically.'
    )
      this.error = '';
    const revision = JSON.stringify(state.connections);
    this.state = state;
    if (
      revision !== this.revision &&
      (this.revision !== null || state.connections.some((c) => c.lastSyncedAt))
    )
      this.transactionsChanged.emit();
    this.revision = revision;
  }
  private localDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  async connect(connectionId?: number) {
    if (this.busy) return;
    if (!this.importStartDate) {
      this.error = 'Choose an import start date.';
      return;
    }
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      const { linkToken } = await firstValueFrom(
        this.banks.linkToken(connectionId),
      );
      if (this.destroyed) return;
      await this.open({
        token: linkToken,
        connectionId,
        importStartDate: this.importStartDate,
      });
    } catch (error) {
      this.failed(error);
    }
  }
  private async open(session: BankLinkSession, redirectUri?: string) {
    try {
      this.handler?.destroy();
      this.handler = await this.banks.open(
        session,
        (token) => {
          void this.complete(session, token);
        },
        (message) => {
          this.busy = false;
          this.error = message;
        },
        redirectUri,
      );
      if (this.destroyed) this.handler.destroy();
    } catch (error) {
      this.banks.clearSession();
      this.failed(error);
    }
  }
  private async complete(session: BankLinkSession, publicToken: string) {
    this.banks.clearSession();
    try {
      const result = await firstValueFrom(
        session.connectionId
          ? this.banks.sync(session.connectionId)
          : this.banks.exchange(publicToken, session.importStartDate),
      );
      this.message = result.message;
      await this.reload();
      this.transactionsChanged.emit();
    } catch (error) {
      this.failed(error);
    } finally {
      this.busy = false;
    }
  }
  async sync(id: number, refresh = false) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      this.message = (
        await firstValueFrom(this.banks.sync(id, refresh))
      ).message;
      await this.reload();
    } catch (error) {
      this.failed(error);
    } finally {
      this.busy = false;
    }
  }
  async disconnect(id: number) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.message = '';
    this.disconnectId = null;
    try {
      this.message = (await firstValueFrom(this.banks.disconnect(id))).message;
      await this.reload();
    } catch (error) {
      this.failed(error);
    } finally {
      this.busy = false;
    }
  }
  private async reload() {
    this.updateState(await firstValueFrom(this.banks.state()));
  }
  private failed(error: any) {
    this.busy = false;
    this.error =
      error?.error?.message ||
      error?.message ||
      'Bank connection failed. Please try again.';
  }
}
