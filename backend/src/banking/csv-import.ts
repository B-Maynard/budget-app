export interface ParsedRow { date: string; description: string; amountCents: number; accountNumber?: string; accountType?: string; }
export interface ParseResult { rows: ParsedRow[]; accountNumber: string; accountType: string; accountLabel?: string; }

export function detectDelimiter(line: string): string {
  const choices = [',', ';', '\t', '|'];
  return choices.reduce((best, delimiter) => line.split(delimiter).length > line.split(best).length ? delimiter : best, ',');
}

export function parseMoney(value: string): number {
  let s = String(value ?? '').trim().replace(/\u00a0/g, ' ');
  if (!s) throw new Error('blank amount');
  let negative = /^\(.*\)$/.test(s);
  s = s.replace(/^\(|\)$/g, '').replace(/[\$€£¥]/g, '').replace(/\s/g, '');
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
  s = s.replace(/^\+/, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.split(',').pop()!.length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  if (!/^\d*(\.\d+)?$/.test(s)) throw new Error(`invalid amount: ${value}`);
  const [whole = '0', fraction = ''] = s.split('.');
  let cents = Number(`${whole || '0'}${fraction.padEnd(2, '0').slice(0, 2)}`) + (fraction.length > 2 && Number(fraction[2]) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(cents)) throw new Error(`invalid amount: ${value}`);
  return negative ? -Math.abs(cents) : cents;
}

export function parseDate(value: string): Date {
  const s = String(value ?? '').trim();
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  let date: Date;
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s)) date = new Date(`${s.replace(/\//g, '-')}T00:00:00Z`);
  else if (match) { const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]); date = new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2]))); if (date.getUTCFullYear() !== year || date.getUTCMonth() !== Number(match[1]) - 1 || date.getUTCDate() !== Number(match[2])) throw new Error(`invalid date: ${s}`); }
  else date = new Date(s);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid date: ${s}`);
  return date;
}

function normalize(s: string): string { return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' '); }
function csvRows(text: string, delimiter: string): string[][] {
  const result: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x !== '')) result.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some(x => x !== '')) result.push(row); }
  return result;
}

export function parseBankCsv(rawCsv: string, accountLabel?: string): ParseResult {
  const text = rawCsv.replace(/^\uFEFF/, ''); const all = csvRows(text, detectDelimiter(text.split(/\r?\n/)[0] || ''));
  const headerIndex = all.findIndex(row => row.some(cell => ['date', 'accountdate', 'transaction date', 'posted date', 'posting date', 'effective date'].includes(normalize(cell))));
  if (headerIndex < 0) throw new Error('CSV has no recognized header row');
  const metadata = headerIndex === 1 ? all[0] : []; const accountNumber = (metadata[0] || '').trim(); const accountType = metadata.slice(1).join(',').trim();
  const header = all[headerIndex]; const keys = header.map(normalize); const find = (names: string[]) => names.map(x => keys.indexOf(x)).find(x => x >= 0);
  const dateIndex = find(['date', 'accountdate', 'transaction date', 'posted date', 'posting date', 'effective date']);
  const descIndex = find(['description', 'memo', 'payee', 'details', 'merchant', 'transaction description']);
  const amountIndex = find(['amount', 'transaction amount', 'signed amount']);
  const debitIndex = find(['debit', 'withdrawal', 'withdrawals', 'debit amount']); const creditIndex = find(['credit', 'deposit', 'deposits', 'credit amount']);
  if (dateIndex === undefined || descIndex === undefined || (amountIndex === undefined && debitIndex === undefined && creditIndex === undefined)) throw new Error('CSV requires date, description, and amount or debit/credit columns');
  const rows = all.slice(headerIndex + 1).map(values => { const amount = amountIndex !== undefined ? parseMoney(values[amountIndex]) : ((values[creditIndex!] || '').trim() ? parseMoney(values[creditIndex!]) : 0) - ((values[debitIndex!] || '').trim() ? parseMoney(values[debitIndex!]) : 0); const d = parseDate(values[dateIndex!]); return { date: d.toISOString().slice(0, 10), description: (values[descIndex!] || '').trim(), amountCents: amount, accountNumber, accountType }; });
  if (!rows.length) throw new Error('CSV has no data rows');
  return { rows, accountNumber, accountType, accountLabel };
}
