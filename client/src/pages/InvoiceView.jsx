// One invoice: printable preview, actions (PDF, print, email, duplicate…) and payments.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadPdf } from '../api';
import { useApi } from '../hooks';
import { money, formatDate, today, PAYMENT_METHODS } from '../utils';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, ErrorBox, Field, Loading, Modal, StatusBadge } from '../components/ui';

function PaymentModal({ invoice, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: invoice.balance, date: today(), method: 'UPI', note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return setError('Enter an amount greater than 0');
    if (amount > invoice.balance) return setError(`Amount cannot be more than the balance due (${money(invoice.balance)})`);

    setSaving(true);
    setError('');
    try {
      onSaved(await api.post(`/invoices/${invoice.id}/payments`, form));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Record payment" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <ErrorBox message={error} />
        <p className="muted">Balance due: <strong>{money(invoice.balance)}</strong>. Enter a smaller amount for a partial payment.</p>
        <div className="form-grid">
          <Field label="Amount (₹)" required>
            <input type="number" name="amount" min="0.01" step="0.01" max={invoice.balance} value={form.amount} onChange={update} autoFocus />
          </Field>
          <Field label="Payment date" required>
            <input type="date" name="date" value={form.date} max={today()} onChange={update} />
          </Field>
          <Field label="Method" required>
            <select name="method" value={form.method} onChange={update}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Reference / note">
            <input name="note" value={form.note} onChange={update} placeholder="e.g. UPI ref no." />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <Button type="submit" loading={saving}>Save payment</Button>
        </div>
      </form>
    </Modal>
  );
}

function EmailModal({ invoice, onClose, onSent }) {
  const [form, setForm] = useState({
    to: invoice.customer.email || '',
    subject: `Invoice ${invoice.invoice_number} from ${invoice.business.name}`,
    message: `Hi ${invoice.customer.name},\n\nPlease find attached invoice ${invoice.invoice_number} for ${money(invoice.balance)}, due on ${formatDate(invoice.due_date)}.\n\nThank you,\n${invoice.business.name}`,
  });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.to)) return setError('Please enter a valid email address');
    setSending(true);
    setError('');
    try {
      onSent(await api.post(`/invoices/${invoice.id}/email`, form));
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <Modal title="Email invoice" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <ErrorBox message={error} />
        <Field label="To" required><input type="email" name="to" value={form.to} onChange={update} autoFocus /></Field>
        <Field label="Subject"><input name="subject" value={form.subject} onChange={update} /></Field>
        <Field label="Message" hint="The invoice PDF is attached automatically.">
          <textarea name="message" rows={6} value={form.message} onChange={update} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <Button type="submit" loading={sending}><Icon name="send" /> Send</Button>
        </div>
      </form>
    </Modal>
  );
}

// The invoice as it looks on paper. This is also what gets printed.
function InvoicePaper({ invoice }) {
  const b = invoice.business;
  const c = invoice.customer;
  return (
    <div className="card paper">
      <div className="paper-head">
        <div>
          {b.logo && <img src={`/uploads/${b.logo}`} alt="" className="paper-logo" />}
          <h2>{b.name}</h2>
          {b.address && <p className="pre">{b.address}</p>}
          {b.gstin && <p>GSTIN: {b.gstin}</p>}
          <p>{[b.email, b.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="paper-meta">
          <h1>INVOICE</h1>
          <p><strong># {invoice.invoice_number}</strong></p>
          <p>Issued: {formatDate(invoice.issue_date)}</p>
          <p>Due: {formatDate(invoice.due_date)}</p>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      <div className="paper-billto">
        <span className="eyebrow">Bill to</span>
        <strong>{c.name}</strong>
        {c.company && <p>{c.company}</p>}
        {c.billing_address && <p className="pre">{c.billing_address}</p>}
        {c.gstin && <p>GSTIN: {c.gstin}</p>}
        <p>{[c.email, c.phone].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="table-scroll">
        <table className="paper-table">
          <thead>
            <tr><th>#</th><th>Item</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Disc</th><th className="num">GST</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={it.id}>
                <td>{i + 1}</td>
                <td>{it.description}</td>
                <td className="num">{it.quantity} {it.unit}</td>
                <td className="num">{money(it.price)}</td>
                <td className="num">{it.discount}%</td>
                <td className="num">{it.tax_rate}%</td>
                <td className="num">{money(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="paper-totals totals">
        <div className="totals-row"><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
        {invoice.discount_total > 0 && <div className="totals-row"><span>Discount</span><span>− {money(invoice.discount_total)}</span></div>}
        {invoice.tax_summary.map((t) => (
          <div key={t.rate} className="totals-row"><span>GST @ {t.rate}% <small className="muted">on {money(t.taxable)}</small></span><span>{money(t.tax)}</span></div>
        ))}
        <div className="totals-row totals-grand"><span>Total</span><span>{money(invoice.total)}</span></div>
        <div className="totals-row"><span>Paid</span><span>{money(invoice.amount_paid)}</span></div>
        <div className="totals-row totals-grand"><span>Balance due</span><span>{money(invoice.balance)}</span></div>
      </div>

      {invoice.notes && <div className="paper-note"><span className="eyebrow">Notes</span><p className="pre">{invoice.notes}</p></div>}
      {invoice.terms && <div className="paper-note"><span className="eyebrow">Payment terms</span><p className="pre">{invoice.terms}</p></div>}
    </div>
  );
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: invoice, setData, loading, error, reload } = useApi(`/invoices/${id}`);
  const [modal, setModal] = useState(''); // 'payment' | 'email'
  const [busy, setBusy] = useState('');   // which action is running
  const [emailPreview, setEmailPreview] = useState(''); // link to the test inbox (demo mode only)

  // Runs an action with a loading state and shows errors as a toast.
  async function run(name, action) {
    setBusy(name);
    try {
      await action();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  if (loading && !invoice) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const paidPercent = invoice.total > 0 ? Math.min(100, (invoice.amount_paid / invoice.total) * 100) : 0;

  const duplicate = () => run('duplicate', async () => {
    const copy = await api.post(`/invoices/${id}/duplicate`);
    toast.success(`Created ${copy.invoice_number} as a draft`);
    navigate(`/invoices/${copy.id}`);
  });

  const remove = () => {
    if (!window.confirm(`Delete invoice ${invoice.invoice_number} and its payments? This cannot be undone.`)) return;
    run('delete', async () => {
      await api.del(`/invoices/${id}`);
      toast.success('Invoice deleted');
      navigate('/invoices');
    });
  };

  const setStatus = (status) => run('status', async () => {
    setData(await api.patch(`/invoices/${id}/status`, { status }));
    toast.success(status === 'sent' ? 'Marked as sent' : 'Moved back to draft');
  });

  const deletePayment = (payment) => {
    if (!window.confirm(`Remove the payment of ${money(payment.amount)}?`)) return;
    run('payment', async () => {
      setData(await api.del(`/invoices/${id}/payments/${payment.id}`));
      toast.success('Payment removed');
    });
  };

  return (
    <>
      <Link to="/invoices" className="back-link no-print"><Icon name="back" size={16} /> Invoices</Link>

      <div className="page-header no-print">
        <div>
          <h1>{invoice.invoice_number} <StatusBadge status={invoice.status} /></h1>
          <p className="muted">{invoice.customer_name} · due {formatDate(invoice.due_date)}</p>
        </div>
        <div className="page-actions">
          <Link to={`/invoices/${id}/edit`} className="btn"><Icon name="edit" /> Edit</Link>
          <Button className="btn" loading={busy === 'duplicate'} onClick={duplicate}><Icon name="copy" /> Duplicate</Button>
          <Button className="btn" loading={busy === 'pdf'} onClick={() => run('pdf', () => downloadPdf(invoice))}><Icon name="download" /> PDF</Button>
          <button className="btn" onClick={() => window.print()}><Icon name="printer" /> Print</button>
          <button className="btn btn-primary" onClick={() => setModal('email')}><Icon name="mail" /> Email</button>
        </div>
      </div>

      {emailPreview && (
        <div className="alert alert-info no-print">
          <span>Demo email sent to a test inbox. <a href={emailPreview} target="_blank" rel="noreferrer">Open the email preview ↗</a></span>
        </div>
      )}

      <div className="invoice-layout">
        <InvoicePaper invoice={invoice} />

        <aside className="invoice-side no-print">
          <div className="card">
            <h2 className="card-title">Payment</h2>
            <div className="progress" aria-label={`${Math.round(paidPercent)}% paid`}><div style={{ width: `${paidPercent}%` }} /></div>
            <div className="totals">
              <div className="totals-row"><span>Total</span><span>{money(invoice.total)}</span></div>
              <div className="totals-row"><span>Paid</span><span>{money(invoice.amount_paid)}</span></div>
              <div className="totals-row totals-grand"><span>Balance due</span><span>{money(invoice.balance)}</span></div>
            </div>
            {invoice.balance > 0 && (
              <button className="btn btn-primary btn-block" onClick={() => setModal('payment')}><Icon name="plus" /> Record payment</button>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">Payment history</h2>
            {invoice.payments.length === 0 ? <p className="muted">No payments recorded yet.</p> : (
              <ul className="payment-list">
                {invoice.payments.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{money(p.amount)}</strong>
                      <span className="muted small">{formatDate(p.date)} · {p.method}{p.note && ` · ${p.note}`}</span>
                    </div>
                    <button className="icon-btn danger" onClick={() => deletePayment(p)} disabled={busy === 'payment'}
                      title="Remove payment" aria-label="Remove payment"><Icon name="trash" size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">More actions</h2>
            <div className="stack">
              {invoice.status === 'draft' && (
                <Button className="btn btn-block" loading={busy === 'status'} onClick={() => setStatus('sent')}><Icon name="send" /> Mark as sent</Button>
              )}
              {['sent', 'overdue'].includes(invoice.status) && invoice.amount_paid === 0 && (
                <Button className="btn btn-block" loading={busy === 'status'} onClick={() => setStatus('draft')}>Move back to draft</Button>
              )}
              <Button className="btn btn-block btn-danger" loading={busy === 'delete'} onClick={remove}><Icon name="trash" /> Delete invoice</Button>
            </div>
          </div>
        </aside>
      </div>

      {modal === 'payment' && (
        <PaymentModal invoice={invoice} onClose={() => setModal('')}
          onSaved={(updated) => { setData(updated); setModal(''); toast.success('Payment recorded'); }} />
      )}
      {modal === 'email' && (
        <EmailModal invoice={invoice} onClose={() => setModal('')}
          onSent={(result) => {
            setModal('');
            toast.success(result.message);
            setEmailPreview(result.previewUrl || '');
            reload();
          }} />
      )}
    </>
  );
}
