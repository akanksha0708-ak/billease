import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi, useDebounce } from '../hooks';
import { money } from '../utils';
import Icon from '../components/Icon';
import CustomerForm from '../components/CustomerForm';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/ui';

const FILTERS = {
  all: () => true,
  due: (c) => c.balance_due > 0,
  settled: (c) => c.invoice_count > 0 && c.balance_due <= 0,
  none: (c) => c.invoice_count === 0,
};

export default function Customers() {
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, customer = edit

  const debounced = useDebounce(search);
  const { data, loading, error, reload } = useApi(`/customers?search=${encodeURIComponent(debounced)}`);
  const customers = (data || []).filter(FILTERS[filter]);

  async function handleDelete(customer) {
    if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
    try {
      await api.del(`/customers/${customer.id}`);
      toast.success('Customer deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="People and companies you bill.">
        <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" /> Add customer</button>
      </PageHeader>

      <div className="toolbar card">
        <div className="search">
          <Icon name="search" />
          <input placeholder="Search by name, email, phone or company" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter customers">
          <option value="all">All customers</option>
          <option value="due">With balance due</option>
          <option value="settled">Fully paid up</option>
          <option value="none">No invoices yet</option>
        </select>
      </div>

      <ErrorBox message={error} onRetry={reload} />
      {loading && !data ? <Loading /> : customers.length === 0 ? (
        <div className="card">
          <EmptyState icon="users" title={search || filter !== 'all' ? 'No matching customers' : 'No customers yet'}
            text={search || filter !== 'all' ? 'Try a different search or filter.' : 'Add your first customer to start billing.'}
            action={!search && filter === 'all' && <button className="btn btn-primary" onClick={() => setEditing({})}>Add customer</button>} />
        </div>
      ) : (
        <div className="card card-flush">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Contact</th><th className="num">Invoices</th><th className="num">Billed</th><th className="num">Balance due</th><th /></tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td data-label="Name"><strong>{c.name}</strong>{c.company && <div className="muted small">{c.company}</div>}</td>
                  <td data-label="Contact">{c.email || '—'}{c.phone && <div className="muted small">{c.phone}</div>}</td>
                  <td data-label="Invoices" className="num">{c.invoice_count}</td>
                  <td data-label="Billed" className="num">{money(c.total_billed)}</td>
                  <td data-label="Balance due" className={`num ${c.balance_due > 0 ? 'text-warn' : ''}`}>{money(c.balance_due)}</td>
                  <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(c)}><Icon name="edit" /></button>
                    <button className="icon-btn danger" title="Delete" aria-label="Delete" onClick={() => handleDelete(c)}><Icon name="trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CustomerForm customer={editing.id ? editing : null} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }} />
      )}
    </>
  );
}
