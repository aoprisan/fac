export interface Party {
  name: string;
  addr: string;
  iban: string;
  bank: string;
  cui: string;
  tel: string;
  web: string;
}

export interface Line {
  desc: string;
  qty: number;
  price: number;
}

export interface Shipping {
  delegat: string;
  delegatId: string;
  oras: string;
  transport: string;
  dataOra: string;
}

export interface Issuer {
  nume: string;
  prenume: string;
  bici: string;
  cnp: string;
}

export interface Invoice {
  seria: string;
  numarPattern: string;
  numar: string;
  numarAuto: boolean;
  data: string;
  dueDay: number;
  scadent: string;
  currency: string;
  rate: number;
  seller: Party;
  buyer: Party;
  lines: Line[];
  issuer: Issuer;
  ship: Shipping;
}

export const emptyParty = (): Party => ({
  name: '',
  addr: '',
  iban: '',
  bank: '',
  cui: '',
  tel: '',
  web: '',
});

export function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 2026-06-20 -> 20.06.2026 */
export function roDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/**
 * Scadent: the Nth day of the month after the invoice date.
 * Clamped to the last day of that month, so day 31 in a February still works.
 */
export function nextMonthDay(iso: string, day: number): string {
  const src = new Date(iso + 'T12:00:00');
  const target = new Date(src.getFullYear(), src.getMonth() + 1, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(Math.max(Math.round(day) || 1, 1), last));
  return toISO(target);
}

/** OBSI-{YYYY}{MM} -> OBSI-202606, based on the invoice date */
export function expandPattern(pattern: string, iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return pattern
    .replace(/\{YYYY\}/g, String(d.getFullYear()))
    .replace(/\{YY\}/g, pad(d.getFullYear() % 100))
    .replace(/\{MM\}/g, pad(d.getMonth() + 1))
    .replace(/\{DD\}/g, pad(d.getDate()));
}

export function lineTotal(l: Line): number {
  return (Number(l.qty) || 0) * (Number(l.price) || 0);
}

export function invoiceTotal(inv: Invoice): number {
  return inv.lines.reduce((s, l) => s + lineTotal(l), 0);
}

export function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('ro-RO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Trim trailing .00 the way the source invoice does (4000, not 4000.00) */
export function fmtLoose(n: number): string {
  return Number.isInteger(n) ? String(n) : fmt(n);
}

export function defaults(): Invoice {
  const today = toISO(new Date());
  return {
    seria: '',
    numarPattern: 'OBSI-{YYYY}{MM}',
    numar: expandPattern('OBSI-{YYYY}{MM}', today),
    numarAuto: true,
    data: today,
    dueDay: 2,
    scadent: nextMonthDay(today, 2),
    currency: 'EUR',
    rate: 5.2429,
    seller: {
      name: 'SC SRL Obsidian Innovations',
      addr: 'Str. NR. Magura 24',
      iban: 'RO14INGB0000999905057463',
      bank: '',
      cui: 'RO 34472520',
      tel: '+40748757595',
      web: '',
    },
    buyer: {
      name: 'Eloquentix Inc.',
      addr: 'Chapell Hill, NC, USA',
      iban: '',
      bank: '',
      cui: '',
      tel: '',
      web: 'eloquentix.com',
    },
    lines: [{ desc: 'Dezvoltare software', qty: 1, price: 4000 }],
    issuer: {
      nume: 'Andrei',
      prenume: 'Oprisan',
      bici: 'MX 164614',
      cnp: '1820417226708',
    },
    ship: {
      delegat: '',
      delegatId: '',
      oras: '',
      transport: '',
      dataOra: '00:00',
    },
  };
}
