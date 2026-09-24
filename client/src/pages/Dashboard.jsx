import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { money, formatDate } from '../utils';
import Icon from '../components/Icon';
import { EmptyState, ErrorBox, Loading, PageHeader, StatusBadge } from '../components/ui';

// Bar chart of payments received per month (plain HTML/CSS, hover a bar to see the amount).
function MonthlyChart({ data }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  const label = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' });

  return (
    <div className="chart" role="list">
      {data.map((d) => (
        <div key={d.month} className="chart-col" role="listitem" aria-label={`${label(d.month)}: ${money(d.amount)}`}>
          <div className="chart-bar-area">
            <div className="chart-bar" style={{ height: `${(d.amount / max) * 100}%` }} data-tip={money(d.amount)} />
          </div>
          <span className="chart-label">{label(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi('/dashboard');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const stats = [
    { label: 'Total invoiced', value: data.total_invoiced },
    { label: 'Received', value: data.total_received },
    { label: 'Outstanding', value: data.outstanding },
    { label: 'Overdue', value: data.overdue_amount, warn: data.overdue_amount > 0 },
  ];

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]} 👋`} subtitle="Here's how your business is doing.">
        <Link to="/invoices/new" className="btn btn-primary"><Icon name="plus" /> New invoice</Link>
      </PageHeader>

      {(data.customers === 0 || data.products === 0) && (
        <div className="alert alert-info">
          <span>Getting started: complete your <Link to="/settings">business profile</Link>, add a <Link to="/customers">customer</Link> and a <Link to="/products">product or service</Link>, then create your first invoice.</span>
        </div>
      )}

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={`card stat ${s.warn ? 'stat-warn' : ''}`}>
            <span className="stat-label">{s.warn && <Icon name="alert" size={14} />} {s.label}</span>
            <strong className="stat-value">{money(s.value)}</strong>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="card-title">Payments received — last 6 months</h2>
          <MonthlyChart data={data.monthly} />
        </div>

        <div className="card">
          <h2 className="card-title">Invoices by status</h2>
          <div className="status-list">
            {Object.entries(data.status_counts).map(([status, count]) => (
              <Link key={status} to={`/invoices?status=${status}`} className="status-row">
                <StatusBadge status={status} />
                <strong>{count}</strong>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Recent invoices</h2>
          <Link to="/invoices">View all</Link>
        </div>
        {data.recent_invoices.length === 0 ? (
          <EmptyState title="No invoices yet" text="Your latest invoices will show up here." />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Invoice</th><th>Customer</th><th>Due date</th><th className="num">Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.recent_invoices.map((inv) => (
                <tr key={inv.id} className="clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td data-label="Invoice"><strong>{inv.invoice_number}</strong></td>
                  <td data-label="Customer">{inv.customer_name}</td>
                  <td data-label="Due date">{formatDate(inv.due_date)}</td>
                  <td data-label="Total" className="num">{money(inv.total)}</td>
                  <td data-label="Status"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
