import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { apiConfig } from '../configs/apis.config';
import { sessionConfig } from '../configs/session.config';
import { SILENT_REQUEST } from '../intercepters/generic.interceptor';

export interface BankConnection {
  id: number;
  institutionName: string;
  status: 'active' | 'attention' | 'error' | 'disconnected';
  errorCode: string | null;
  importStartDate: string;
  lastSyncedAt: string | null;
  lastRefreshRequestedAt: string | null;
  accounts: { id: number; name: string; mask: string; type: string }[];
}
export interface BankConnectionState {
  enabled: boolean;
  environment: string;
  refreshEnabled: boolean;
  message: string | null;
  connections: BankConnection[];
}
export interface BankLinkSession {
  token: string;
  importStartDate: string;
  connectionId?: number;
}
interface PlaidHandler {
  open(): void;
  destroy(): void;
}
interface PlaidBrowser {
  create(options: {
    token: string;
    receivedRedirectUri?: string;
    onSuccess: (publicToken: string) => void;
    onExit: (
      error: { display_message?: string; error_message?: string } | null,
    ) => void;
  }): PlaidHandler;
}

@Injectable({ providedIn: 'root' })
export class BankConnectionsService {
  private script?: Promise<PlaidBrowser>;
  private readonly storageKey = 'current_plaid_link';
  constructor(private readonly http: HttpClient) {}
  private get url() {
    return apiConfig.databaseRootPath + '/bank-connections';
  }
  private options(silent = false) {
    return {
      headers: new HttpHeaders({
        authToken: localStorage.getItem(sessionConfig.dbAccessToken) || '',
      }),
      context: new HttpContext().set(SILENT_REQUEST, silent),
    };
  }
  state() {
    return this.http.get<BankConnectionState>(this.url, this.options(true));
  }
  linkToken(id?: number) {
    return this.http.post<{ linkToken: string }>(
      `${this.url}/${id ? id + '/' : ''}link-token`,
      {},
      this.options(),
    );
  }
  exchange(publicToken: string, importStartDate: string) {
    return this.http.post<{ message: string }>(
      `${this.url}/exchange`,
      { publicToken, importStartDate },
      this.options(),
    );
  }
  sync(id: number, refresh = false) {
    return this.http.post<{ message: string }>(
      `${this.url}/${id}/${refresh ? 'refresh' : 'sync'}`,
      {},
      this.options(),
    );
  }
  disconnect(id: number) {
    return this.http.delete<{ message: string }>(
      `${this.url}/${id}`,
      this.options(),
    );
  }
  remember(session: BankLinkSession) {
    sessionStorage.setItem(this.storageKey, JSON.stringify(session));
  }
  resume(): BankLinkSession | null {
    if (!new URLSearchParams(location.search).has('oauth_state_id'))
      return null;
    try {
      return JSON.parse(
        sessionStorage.getItem(this.storageKey) || 'null',
      ) as BankLinkSession | null;
    } catch {
      return null;
    }
  }
  clearSession() {
    sessionStorage.removeItem(this.storageKey);
    if (new URLSearchParams(location.search).has('oauth_state_id'))
      history.replaceState(null, '', location.pathname + location.hash);
  }
  async open(
    session: BankLinkSession,
    onSuccess: (token: string) => void,
    onExit: (message: string) => void,
    receivedRedirectUri?: string,
  ): Promise<PlaidHandler> {
    const plaid = await this.loadScript();
    this.remember(session);
    const handler = plaid.create({
      token: session.token,
      ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
      onSuccess,
      onExit: (error) => {
        this.clearSession();
        onExit(error?.display_message || error?.error_message || '');
      },
    });
    handler.open();
    return handler;
  }
  private loadScript(): Promise<PlaidBrowser> {
    const current = (window as Window & { Plaid?: PlaidBrowser }).Plaid;
    if (current) return Promise.resolve(current);
    return (this.script ??= new Promise<PlaidBrowser>((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error('Plaid took too long to load. Please try again.'));
      }, 20000);
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      script.async = true;
      script.onload = () => {
        clearTimeout(timer);
        const plaid = (window as Window & { Plaid?: PlaidBrowser }).Plaid;
        if (plaid) resolve(plaid);
        else reject(new Error('Could not load Plaid.'));
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(
          new Error(
            'Could not load Plaid. Check your connection and try again.',
          ),
        );
      };
      document.head.appendChild(script);
    }).catch((error) => {
      this.script = undefined;
      throw error;
    }));
  }
}
