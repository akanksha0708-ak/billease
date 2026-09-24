// Formatting helpers and shared constants.

export const money = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (d) =>
  d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Dates as YYYY-MM-DD (the format <input type="date"> uses), in local time.
export const today = () => new Date().toLocaleDateString('en-CA');
export const addDays = (date, days) => {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + Number(days));
  return d.toLocaleDateString('en-CA');
};

export const GST_RATES = [0, 5, 12, 18, 28];
export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'];
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'];
export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];

const round = (n) => Math.round(n * 100) / 100;

// Same maths as the server (server/utils/invoiceCalc.js), used for the live preview while typing.
export function calculateTotals(items) {
  let subtotal = 0, discount = 0, tax = 0;
  const taxByRate = {};

  const lines = items.map((item) => {
    const gross = (Number(item.quantity) || 0) * (Number(item.price) || 0);
    const lineDiscount = (gross * (Number(item.discount) || 0)) / 100;
    const rate = Number(item.tax_rate) || 0;
    const lineTax = ((gross - lineDiscount) * rate) / 100;

    subtotal += gross;
    discount += lineDiscount;
    tax += lineTax;
    if (rate) taxByRate[rate] = (taxByRate[rate] || 0) + lineTax;
    return round(gross - lineDiscount + lineTax);
  });

  return {
    lines,
    subtotal: round(subtotal),
    discount: round(discount),
    taxes: Object.entries(taxByRate).map(([rate, amount]) => ({ rate, amount: round(amount) })),
    total: round(subtotal - discount + tax),
  };
}
