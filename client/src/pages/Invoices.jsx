import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useDebounce } from '../hooks';
import { money, formatDate, INVOICE_STATUSES, PAYMENT_STATUSES } from '../utils';
import Icon from '../components/Icon';
import { EmptyState, ErrorBox, Loading, PageHeader, StatusBadge } from '../components/ui';

const FILTER_KEYS = ['search', 'status', 'payment_status', 'customer_id', 'from', 'to', 'min', 'max'];
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Invoices() {
  const navigate = useNavigate();
  // Filters live in the URL, so a filtered list can be bookmarked or linked to (e.g. from the dashboard).
  const [params, setParams] = useSearchParams();
  const [showMore, setShowMore] = useState(['from', 'to', 'min', 'max', 'customer_id'].some((k) => params.get(k)));
  const [search, setSearch] = useState(params.get('search') || '');

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  filters.search = useDebounce(search);
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();

  const { data: invoices, loading, error, reload } = useApi(`/invoices?${query}`);
  const { data: customers } = useApi('/customers');

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  const clearFilters = () => { setSearch(''); setParams({}, { replace: true }); };
  const hasFilters = search || FILTER_KEYS.some((k) => params.get(k));

  return (
    <>
      <PageHeader title="Invoices" subtitle="Create, track and follow up on your invoices.">
        <Link to="/invoices/new" className="btn btn-primary"><Icon name="plus" /> New invoice</Link>
      </PageHeader>

      <div className="card filters">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" />
            <input placeholder="Search invoice number or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{capitalize(s)}</option>)}
          </select>
          <select value={filters.payment_status} onChange={(e) => setFilter('payment_status', e.target.value)} aria-label="Payment status">
            <option value="">Any payment</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s === 'partial' ? 'Partially paid' : capitalize(s)}</option>)}
          </select>
          <button className={`btn ${showMore ? 'btn-soft' : ''}`} onClick={() => setShowMore(!showMore)}><Icon name="filter" /> More filters</button>
          {hasFilters && <button className="btn btn-link" onClick={clearFilters}>Clear</button>}
        </div>

        {showMore && (
          <div className="filter-grid">
            <label className="field"><span className="field-label">Customer</span>
              <select value={filters.customer_id} onChange={(e) => setFilter('customer_id', e.target.value)}>
                <option value="">All customers</option>
                {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Issued from</span>
              <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
            </label>
            <label className="field"><span className="field-label">Issued to</span>
              <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
            </label>
            <label className="field"><span className="field-label">Min amount (₹)</span>
              <input type="number" min="0" value={filters.min} onChange={(e) => setFilter('min', e.target.value)} />
            </label>
            <label className="field"><span className="field-label">Max amount (₹)</span>
              <input type="number" min="0" value={filters.max} onChange={(e) => setFilter('max', e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <ErrorBox message={error} onRetry={reload} />
      {loading && !invoices ? <Loading /> : invoices.length === 0 ? (
        <div className="card">
          <EmptyState title={hasFilters ? 'No invoices match these filters' : 'No invoices yet'}
            text={hasFilters ? 'Try changing or clearing the filters.' : 'Create your first invoice in under a minute.'}
            action={hasFilters
              ? <button className="btn" onClick={clearFilters}>Clear filters</button>
              : <Link to="/invoices/new" className="btn btn-primary">New invoice</Link>} />
        </div>
      ) : (
        <div className="card card-flush">
          <table className="table">
            <thead>
              <tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td data-label="Invoice"><strong>{inv.invoice_number}</strong></td>
                  <td data-label="Customer">{inv.customer_name}</td>
                  <td data-label="Issued">{formatDate(inv.issue_date)}</td>
                  <td data-label="Due">{formatDate(inv.due_date)}</td>
                  <td data-label="Total" className="num">{money(inv.total)}</td>
                  <td data-label="Balance" className="num">
                    {money(inv.balance)}
                    {inv.payment_status === 'partial' && <div className="muted small">partly paid</div>}
                  </td>
                  <td data-label="Status"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer muted">
            {invoices.length} invoice{invoices.length === 1 ? '' : 's'} · Total {money(invoices.reduce((s, i) => s + i.total, 0))}
          </div>
        </div>
      )}
    </>
  );
}
