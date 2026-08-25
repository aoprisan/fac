import {
  Invoice,
  defaults,
  expandPattern,
  fmt,
  invoiceTotal,
  nextMonthDay,
  roDate,
  toISO,
} from './model';
import { downloadPdf, buildPdf } from './pdf';
import * as store from './storage';

let inv: Invoice = defaults();
let previewUrlRef: string | null = null;

/* ---------- tiny helpers ---------- */

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector(sel) as T;

function get(path: string): any {
  return path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), inv);
}

function set(path: string, value: any) {
  const keys = path.split('.');
  const last = keys.pop() as string;
  const target = keys.reduce<any>((o, k) => o[k], inv);
  target[last] = value;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* ---------- field spec ---------- */

interface Field {
  path: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'checkbox';
  hint?: string;
  step?: string;
  span?: 1 | 2;
}

const invoiceFields: Field[] = [
  { path: 'numarPattern', label: 'Serie număr', hint: '{YYYY} {MM} {DD} se înlocuiesc din data facturii' },
  { path: 'numar', label: 'Nr. factură' },
  { path: 'data', label: 'Data', type: 'date' },
  { path: 'dueDay', label: 'Scadent — ziua', type: 'number', step: '1', hint: 'ziua din luna următoare datei facturii' },
  { path: 'scadent', label: 'Scadent', type: 'date' },
  { path: 'seria', label: 'Seria' },
  { path: 'currency', label: 'Monedă' },
  { path: 'rate', label: 'Curs valutar', type: 'number', step: '0.0001', hint: 'cursul BNR din ziua precedentă datei facturii' },
];

const partyFields = (p: 'seller' | 'buyer'): Field[] => [
  { path: `${p}.name`, label: p === 'seller' ? 'Denumire' : 'Soc.', span: 2 },
  { path: `${p}.addr`, label: 'Adresă', span: 2 },
  { path: `${p}.iban`, label: 'IBAN', span: 2 },
  { path: `${p}.bank`, label: 'Banca' },
  { path: `${p}.cui`, label: 'CUI' },
  { path: `${p}.tel`, label: 'Tel/Fax' },
  { path: `${p}.web`, label: 'Web' },
];

const issuerFields: Field[] = [
  { path: 'issuer.nume', label: 'Nume' },
  { path: 'issuer.prenume', label: 'Prenume' },
  { path: 'issuer.bici', label: 'BI/CI' },
  { path: 'issuer.cnp', label: 'CNP' },
];

const shipFields: Field[] = [
  { path: 'ship.delegat', label: 'Nume delegat' },
  { path: 'ship.delegatId', label: 'BI/CI delegat' },
  { path: 'ship.oras', label: 'Oraș' },
  { path: 'ship.transport', label: 'Mijloc transport' },
  { path: 'ship.dataOra', label: 'Data / Ora' },
];

/* ---------- rendering ---------- */

function field(f: Field): HTMLElement {
  const wrap = el('label', 'field' + (f.span === 2 ? ' field--wide' : ''));
  wrap.append(el('span', 'field__label', f.label));
  const input = el('input');
  input.type = f.type ?? 'text';
  if (f.step) input.step = f.step;
  input.value = String(get(f.path) ?? '');
  input.addEventListener('input', () => {
    const v = f.type === 'number' ? Number(input.value) : input.value;
    set(f.path, v);
    onEdit(f.path);
  });
  input.dataset.path = f.path;
  wrap.append(input);
  if (f.hint) wrap.append(el('span', 'field__hint', f.hint));
  return wrap;
}

function section(title: string, note: string, fields: Field[]): HTMLElement {
  const s = el('section', 'card');
  const h = el('header', 'card__head');
  h.append(el('h2', '', title));
  if (note) h.append(el('span', 'card__note', note));
  s.append(h);
  const grid = el('div', 'grid');
  fields.forEach((f) => grid.append(field(f)));
  s.append(grid);
  return s;
}

function linesSection(): HTMLElement {
  const s = el('section', 'card');
  const h = el('header', 'card__head');
  h.append(el('h2', '', 'Produse'));
  const add = el('button', 'btn btn--ghost', 'Adaugă linie');
  add.type = 'button';
  add.addEventListener('click', () => {
    inv.lines.push({ desc: '', qty: 1, price: 0 });
    renderLines(body);
    onEdit();
  });
  h.append(add);
  s.append(h);
  const body = el('div', 'lines');
  s.append(body);
  renderLines(body);
  return s;
}

function renderLines(body: HTMLElement) {
  body.innerHTML = '';
  const head = el('div', 'line line--head');
  ['Produs', 'Cant.', 'Preț/buc', ''].forEach((t) =>
    head.append(el('span', '', t))
  );
  body.append(head);

  inv.lines.forEach((l, i) => {
    const row = el('div', 'line');
    const desc = el('input');
    desc.value = l.desc;
    desc.placeholder = 'Descriere';
    desc.addEventListener('input', () => {
      l.desc = desc.value;
      onEdit();
    });

    const qty = el('input');
    qty.type = 'number';
    qty.step = '0.01';
    qty.value = String(l.qty);
    qty.addEventListener('input', () => {
      l.qty = Number(qty.value);
      onEdit();
    });

    const price = el('input');
    price.type = 'number';
    price.step = '0.01';
    price.value = String(l.price);
    price.addEventListener('input', () => {
      l.price = Number(price.value);
      onEdit();
    });

    const del = el('button', 'btn btn--icon', '×');
    del.type = 'button';
    del.title = 'Șterge linia';
    del.addEventListener('click', () => {
      inv.lines.splice(i, 1);
      if (!inv.lines.length) inv.lines.push({ desc: '', qty: 1, price: 0 });
      renderLines(body);
      onEdit();
    });

    row.append(desc, qty, price, del);
    body.append(row);
  });
}

/* ---------- reactive glue ---------- */

let previewTimer: number | undefined;

function syncDerived(changed?: string) {
  if (changed === 'data' || changed === 'numarPattern') {
    if (inv.numarAuto || changed === 'numarPattern') {
      inv.numar = expandPattern(inv.numarPattern, inv.data);
      const f = document.querySelector<HTMLInputElement>('[data-path="numar"]');
      if (f) f.value = inv.numar;
    }
  }
  if (changed === 'numar') inv.numarAuto = false;
  if (changed === 'data' || changed === 'dueDay') {
    inv.scadent = nextMonthDay(inv.data, Number(inv.dueDay) || 2);
    const f = document.querySelector<HTMLInputElement>('[data-path="scadent"]');
    if (f) f.value = inv.scadent;
  }
}

function updateTotals() {
  const total = invoiceTotal(inv);
  const ron = total * (Number(inv.rate) || 0);
  $('#total').textContent = `${fmt(total)} ${inv.currency}`;
  $('#total-ron').textContent = `${fmt(ron)} RON`;
  $('#meta').textContent = `${inv.numar} · ${roDate(inv.data)} · scadent ${roDate(inv.scadent)}`;
}

function refreshPreview() {
  const frame = $<HTMLIFrameElement>('#preview');
  if (!frame) return;
  try {
    const blob = buildPdf(inv).output('blob') as Blob;
    if (previewUrlRef) URL.revokeObjectURL(previewUrlRef);
    previewUrlRef = URL.createObjectURL(blob);
    frame.src = previewUrlRef + '#toolbar=0&view=FitH';
  } catch (e) {
    console.error(e);
  }
}

function onEdit(changed?: string) {
  syncDerived(changed);
  updateTotals();
  store.save(inv);
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(refreshPreview, 350);
}

/* ---------- BNR rate ---------- */

function prevWorkday(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return toISO(d);
}

async function fetchRate(status: HTMLElement) {
  const day = prevWorkday(inv.data);
  status.textContent = `Caut cursul din ${roDate(day)}…`;
  try {
    const res = await fetch('https://www.bnr.ro/nbrfxrates.xml', {
      cache: 'no-store',
    });
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
    const node = xml.querySelector('Rate[currency="EUR"]');
    const published = xml.querySelector('Cube')?.getAttribute('date');
    if (!node) throw new Error('no EUR rate');
    inv.rate = Number(node.textContent);
    const input = document.querySelector<HTMLInputElement>('[data-path="rate"]');
    if (input) input.value = String(inv.rate);
    status.textContent = `Curs BNR publicat ${published ? roDate(published) : ''}. Verifică dacă e ziua care îți trebuie (${roDate(day)}).`;
    onEdit();
  } catch {
    status.textContent =
      'BNR nu răspunde la cereri din browser (fără CORS). Ia cursul de pe bnr.ro și scrie-l manual.';
  }
}

/* ---------- boot ---------- */

async function boot() {
  const saved = await store.load<Invoice>();
  if (saved) inv = { ...defaults(), ...saved };

  // A stored file is a template, not last month's invoice: refresh the dates.
  inv.data = toISO(new Date());
  inv.dueDay = Number(inv.dueDay) || 2;
  inv.scadent = nextMonthDay(inv.data, inv.dueDay);
  if (inv.numarAuto !== false) {
    inv.numar = expandPattern(inv.numarPattern, inv.data);
  }

  const form = $('#form');
  form.append(section('Factură', '', invoiceFields));

  const rateRow = el('div', 'rate-row');
  const rateBtn = el('button', 'btn btn--ghost', 'Ia cursul de la BNR');
  rateBtn.type = 'button';
  const rateStatus = el('p', 'status');
  rateBtn.addEventListener('click', () => fetchRate(rateStatus));
  rateRow.append(rateBtn, rateStatus);
  form.lastElementChild!.append(rateRow);

  form.append(section('Vânzător', '', partyFields('seller')));
  form.append(section('Cumpărător', '', partyFields('buyer')));
  form.append(linesSection());
  form.append(section('Emitent', 'apare la „Date privind expediția"', issuerFields));
  form.append(section('Expediție', 'lasă gol dacă nu ai delegat', shipFields));

  const reset = el('button', 'btn btn--ghost', 'Revino la valorile din fabrică');
  reset.type = 'button';
  reset.addEventListener('click', async () => {
    if (!confirm('Ștergi datele salvate și revii la valorile inițiale?')) return;
    await store.clear();
    location.reload();
  });
  form.append(reset);

  $('#download').addEventListener('click', () => downloadPdf(inv));
  $('#open').addEventListener('click', () => {
    const blob = buildPdf(inv).output('blob') as Blob;
    window.open(URL.createObjectURL(blob), '_blank');
  });

  updateTotals();
  refreshPreview();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
