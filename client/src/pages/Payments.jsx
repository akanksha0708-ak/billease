import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks';
import { money, formatDate, PAYMENT_METHODS } from '../utils';
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/ui';

export default function Payments() {
  const { data, loading, error, reload } = useApi('/payments');
  const [method, setMethod] = useState('');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const payments = data.filter((p) => !method || p.method === method);
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment received, across all invoices." />

      <div className="toolbar card">
        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="toolbar-total">Total received: <strong>{money(total)}</strong></span>
      </div>

      {payments.length === 0 ? (
        <div className="card">
          <EmptyState icon="wallet" title="No payments yet" text="Record a payment from any invoice page and it will appear here." />
        </div>
      ) : (
        <div className="card card-flush">
          <table className="table">
            <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Method</th><th>Note</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td data-label="Date">{formatDate(p.date)}</td>
                  <td data-label="Invoice"><Link to={`/invoices/${p.invoice_id}`}>{p.invoice_number}</Link></td>
                  <td data-label="Customer">{p.customer_name}</td>
                  <td data-label="Method">{p.method}</td>
                  <td data-label="Note">{p.note || '—'}</td>
                  <td data-label="Amount" className="num"><strong>{money(p.amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
