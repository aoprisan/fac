import { jsPDF } from 'jspdf';
import {
  Invoice,
  fmtLoose,
  invoiceTotal,
  lineTotal,
  roDate,
} from './model';

/**
 * The built-in Helvetica of a PDF is WinAnsi-encoded and has no ș/ț/ă.
 * The reference invoice is written without diacritics anyway, so we fold
 * them rather than embedding a 300 KB font.
 */
const FOLD: Record<string, string> = {
  ă: 'a', â: 'a', î: 'i', ș: 's', ş: 's', ț: 't', ţ: 't',
  Ă: 'A', Â: 'A', Î: 'I', Ș: 'S', Ş: 'S', Ț: 'T', Ţ: 'T',
};

export function fold(s: string): string {
  return (s || '').replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, (c) => FOLD[c] || c);
}

const M = 14; // page margin, mm
const RIGHT = 210 - M; // 196
const MID = 105; // column split
const ROW = 5.2; // label row height

interface Ctx {
  doc: jsPDF;
  y: number;
}

function label(ctx: Ctx, x: number, text: string, value: string, labelW = 0) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  if (text) {
    doc.text(fold(text), x, ctx.y);
  }
  if (value) {
    doc.setFont('helvetica', text ? 'normal' : 'bold');
    doc.text(fold(value), x + labelW, ctx.y);
  }
}

/** Two aligned columns of label/value rows, framed like the original. */
function partyBlock(ctx: Ctx, inv: Invoice) {
  const { doc } = ctx;
  const top = ctx.y;

  const left: Array<[string, string]> = [
    ['', inv.seller.name],
    ['', inv.seller.addr],
    ['', inv.seller.iban],
    ['CUI:', inv.seller.cui],
    ['Tel/Fax:', inv.seller.tel],
    ['Nr. Fact.:', inv.numar],
    ['Data:', roDate(inv.data)],
    ['Scadent:', roDate(inv.scadent)],
  ];
  const right: Array<[string, string]> = [
    ['Soc:', inv.buyer.name],
    ['Adresa:', inv.buyer.addr],
    ['Banca:', inv.buyer.bank],
    ['CUI:', inv.buyer.cui],
    ['', ''],
    ['Tel/Fax:', inv.buyer.tel],
    ['Web:', inv.buyer.web],
    ['', ''],
  ];

  // headers
  ctx.y += 5;
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('VANZATOR/SELLER', M + 2, ctx.y);
  doc.text('CUMPARATOR/BUYER', MID + 2, ctx.y);
  ctx.y += 1.5;
  doc.setLineWidth(0.2);
  doc.line(M, ctx.y, RIGHT, ctx.y);
  ctx.y += 4.5;

  const rows = Math.max(left.length, right.length);
  for (let i = 0; i < rows; i++) {
    const l = left[i];
    const r = right[i];
    if (l) label(ctx, M + 2, l[0], l[1], l[0] ? 18 : 0);
    if (r) label(ctx, MID + 2, r[0], r[1], r[0] ? 18 : 0);
    ctx.y += ROW;
  }

  const bottom = ctx.y - ROW + 2;
  doc.rect(M, top, RIGHT - M, bottom - top);
  doc.line(MID, top, MID, bottom);
  ctx.y = bottom;
}

function itemsTable(ctx: Ctx, inv: Invoice) {
  const { doc } = ctx;
  const cols = [M, 110, 140, 168, RIGHT]; // PRODUS | Cantitate | Pret/Buc | Valoare
  const headers = ['PRODUS', 'Cantitate', 'Pret/Buc', 'Valoare'];
  const top = ctx.y + 6;
  const headerH = 7;

  doc.setFillColor(238, 240, 243);
  doc.rect(M, top, RIGHT - M, headerH, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8.5);
  doc.text(headers[0], cols[0] + 2, top + 4.8);
  doc.text(headers[1], cols[2] - 2, top + 4.8, { align: 'right' });
  doc.text(headers[2], cols[3] - 2, top + 4.8, { align: 'right' });
  doc.text(headers[3], cols[4] - 2, top + 4.8, { align: 'right' });

  let y = top + headerH;
  doc.setFont('helvetica', 'normal');
  for (const l of inv.lines) {
    const h = 6.5;
    doc.text(fold(l.desc), cols[0] + 2, y + 4.4);
    doc.text(fmtLoose(Number(l.qty) || 0), cols[2] - 2, y + 4.4, { align: 'right' });
    doc.text(fmtLoose(Number(l.price) || 0), cols[3] - 2, y + 4.4, { align: 'right' });
    doc.text(
      `${fmtLoose(lineTotal(l))} ${fold(inv.currency)}`,
      cols[4] - 2,
      y + 4.4,
      { align: 'right' }
    );
    y += h;
    doc.setDrawColor(200);
    doc.line(M, y, RIGHT, y);
    doc.setDrawColor(0);
  }

  doc.rect(M, top, RIGHT - M, y - top);
  for (const x of cols.slice(1, -1)) doc.line(x, top, x, y);
  ctx.y = y;
}

function totals(ctx: Ctx, inv: Invoice) {
  const { doc } = ctx;
  const total = invoiceTotal(inv);
  const ron = total * (Number(inv.rate) || 0);

  ctx.y += 8;
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  doc.text('Semnatura si stampila furnizorului', M, ctx.y);
  doc.text(`Curs valutar: ${inv.rate}`, RIGHT, ctx.y, { align: 'right' });

  ctx.y += 8;
  doc.setLineWidth(0.4);
  doc.line(M, ctx.y - 4.5, RIGHT, ctx.y - 4.5);
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold').setFontSize(10.5);
  doc.text('TOTAL LEI', M + 2, ctx.y);
  doc.text(
    `${fmtLoose(total)} ${fold(inv.currency)} (${Math.ceil(ron)} RON)`,
    RIGHT - 2,
    ctx.y,
    { align: 'right' }
  );
  ctx.y += 3;
  doc.line(M, ctx.y, RIGHT, ctx.y);
}

function shippingBlock(ctx: Ctx, inv: Invoice) {
  const { doc } = ctx;
  ctx.y += 10;
  const top = ctx.y;
  doc.setFont('helvetica', 'bold').setFontSize(8.5);
  doc.text('Date privind expeditia:', M + 2, ctx.y + 5);
  ctx.y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Nume delegat:', MID + 2, ctx.y);
  doc.text(fold(inv.ship.delegat), MID + 26, ctx.y);
  ctx.y += ROW + 1;

  const left: Array<[string, string]> = [
    ['Nume:', inv.issuer.nume],
    ['Prenume:', inv.issuer.prenume],
    ['BI/CI:', inv.issuer.bici],
    ['CNP:', inv.issuer.cnp],
  ];
  const right: Array<[string, string]> = [
    ['BI/CI:', inv.ship.delegatId],
    ['Oras:', inv.ship.oras],
    ['Mijloc transport:', inv.ship.transport],
    ['Data/ Ora:', inv.ship.dataOra],
  ];
  for (let i = 0; i < 4; i++) {
    label(ctx, M + 2, left[i][0], left[i][1], 20);
    label(ctx, MID + 2, right[i][0], right[i][1], 26);
    if (i === 0) {
      doc.text('Semnatura:', MID + 60, ctx.y);
    }
    ctx.y += ROW;
  }
  const bottom = ctx.y;
  doc.rect(M, top, RIGHT - M, bottom - top);
}

export function buildPdf(inv: Invoice): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx: Ctx = { doc, y: 20 };

  doc.setFont('helvetica', 'bold').setFontSize(15);
  doc.text('FACTURA FISCALA', 105, ctx.y, { align: 'center' });

  ctx.y += 8;
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  doc.text(`Seria: ${fold(inv.seria)}`, M, ctx.y);
  doc.text(`Nr. Fact.: ${fold(inv.numar)}`, RIGHT, ctx.y, { align: 'right' });

  ctx.y += 2;
  partyBlock(ctx, inv);
  itemsTable(ctx, inv);
  totals(ctx, inv);
  shippingBlock(ctx, inv);

  return doc;
}

export function fileName(inv: Invoice): string {
  const base = (inv.numar || 'factura').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${base}.pdf`;
}

export function downloadPdf(inv: Invoice) {
  buildPdf(inv).save(fileName(inv));
}

export function previewUrl(inv: Invoice): string {
  return buildPdf(inv).output('bloburl') as unknown as string;
}
