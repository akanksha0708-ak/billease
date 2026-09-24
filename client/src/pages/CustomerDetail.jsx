import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks';
import { money, formatDate } from '../utils';
import Icon from '../components/Icon';
import CustomerForm from '../components/CustomerForm';
import { EmptyState, ErrorBox, Loading, PageHeader, StatusBadge } from '../components/ui';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const { data: customer, loading, error, reload } = useApi(`/customers/${id}`);

  if (loading && !customer) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  // Drafts are not counted as billed yet.
  const billed = customer.invoices.filter((i) => i.status !== 'draft');
  const totalBilled = billed.reduce((sum, i) => sum + i.total, 0);
  const totalPaid = billed.reduce((sum, i) => sum + i.amount_paid, 0);

  return (
    <>
      <Link to="/customers" className="back-link"><Icon name="back" size={16} /> Customers</Link>
      <PageHeader title={customer.name} subtitle={customer.company}>
        <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" /> Edit</button>
        <Link to={`/invoices/new?customer=${customer.id}`} className="btn btn-primary"><Icon name="plus" /> New invoice</Link>
      </PageHeader>

      <div className="grid-2">
        <div className="card">
          <h2 className="card-title">Contact & billing details</h2>
          <dl className="details">
            <dt>Email</dt><dd>{customer.email || '—'}</dd>
            <dt>Phone</dt><dd>{customer.phone || '—'}</dd>
            <dt>GSTIN</dt><dd>{customer.gstin || '—'}</dd>
            <dt>Billing address</dt><dd className="pre">{customer.billing_address || '—'}</dd>
          </dl>
        </div>
        <div className="stats stats-3">
          <div className="card stat"><span className="stat-label">Total billed</span><strong className="stat-value">{money(totalBilled)}</strong></div>
          <div className="card stat"><span className="stat-label">Paid</span><strong className="stat-value">{money(totalPaid)}</strong></div>
          <div className="card stat"><span className="stat-label">Balance due</span><strong className="stat-value">{money(totalBilled - totalPaid)}</strong></div>
        </div>
      </div>

      <div className="card card-flush">
        <h2 className="card-title pad">Invoice history</h2>
        {customer.invoices.length === 0 ? <EmptyState title="No invoices for this customer yet" /> : (
          <table className="table">
            <thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {customer.invoices.map((inv) => (
                <tr key={inv.id} className="clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td data-label="Invoice"><strong>{inv.invoice_number}</strong></td>
                  <td data-label="Issued">{formatDate(inv.issue_date)}</td>
                  <td data-label="Due">{formatDate(inv.due_date)}</td>
                  <td data-label="Total" className="num">{money(inv.total)}</td>
                  <td data-label="Balance" className="num">{money(inv.balance)}</td>
                  <td data-label="Status"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card card-flush">
        <h2 className="card-title pad">Purchase history</h2>
        {customer.purchases.length === 0 ? <EmptyState icon="box" title="No purchases yet" text="Items from sent invoices appear here." /> : (
          <table className="table">
            <thead><tr><th>Item</th><th className="num">Quantity</th><th className="num">Amount</th><th>Last purchased</th></tr></thead>
            <tbody>
              {customer.purchases.map((p) => (
                <tr key={p.description + p.unit}>
                  <td data-label="Item">{p.description}</td>
                  <td data-label="Quantity" className="num">{p.quantity} {p.unit}</td>
                  <td data-label="Amount" className="num">{money(p.amount)}</td>
                  <td data-label="Last purchased">{formatDate(p.last_purchased)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && <CustomerForm customer={customer} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}
