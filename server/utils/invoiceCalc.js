// All money maths for an invoice lives here, so the server is the single source of truth.
const round = (n) => Math.round(n * 100) / 100;

// Takes raw line items and returns calculated lines + invoice totals.
//   line gross    = quantity x price
//   line discount = gross x discount%
//   line tax      = (gross - discount) x tax%
function calculateInvoice(items) {
  let subtotal = 0, discountTotal = 0, taxTotal = 0;

  const lines = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    const taxRate = Number(item.tax_rate) || 0;

    const gross = quantity * price;
    const discountAmount = (gross * discount) / 100;
    const taxAmount = ((gross - discountAmount) * taxRate) / 100;

    subtotal += gross;
    discountTotal += discountAmount;
    taxTotal += taxAmount;

    return { ...item, quantity, price, discount, tax_rate: taxRate, amount: round(gross - discountAmount + taxAmount) };
  });

  return {
    lines,
    subtotal: round(subtotal),
    discount_total: round(discountTotal),
    tax_total: round(taxTotal),
    total: round(subtotal - discountTotal + taxTotal),
  };
}

// Groups tax by rate, e.g. [{ rate: 18, taxable: 1000, tax: 180 }] — used on the invoice & PDF.
function taxSummary(items) {
  const byRate = {};
  for (const item of items) {
    if (!item.tax_rate) continue;
    const taxable = item.quantity * item.price * (1 - item.discount / 100);
    byRate[item.tax_rate] ??= { rate: item.tax_rate, taxable: 0, tax: 0 };
    byRate[item.tax_rate].taxable += taxable;
    byRate[item.tax_rate].tax += (taxable * item.tax_rate) / 100;
  }
  return Object.values(byRate).map((r) => ({ ...r, taxable: round(r.taxable), tax: round(r.tax) }));
}

module.exports = { calculateInvoice, taxSummary, round };
