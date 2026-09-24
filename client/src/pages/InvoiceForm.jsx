// Create or edit an invoice. The same page handles /invoices/new and /invoices/:id/edit.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../hooks';
import { money, today, addDays, calculateTotals, GST_RATES } from '../utils';
import Icon from '../components/Icon';
import CustomerForm from '../components/CustomerForm';
import { useToast } from '../components/Toast';
import { Button, ErrorBox, Field, Loading, PageHeader } from '../components/ui';

const DUE_OPTIONS = [
  { label: 'Due on receipt', days: 0 },
  { label: 'Net 7', days: 7 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
];

let nextKey = 1; // stable React keys for item rows
const newItem = () => ({ key: nextKey++, product_id: '', description: '', unit: '', quantity: 1, price: '', discount: 0, tax_rate: 18 });

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const customersApi = useApi('/customers');
  const productsApi = useApi('/products');

  const [form, setForm] = useState({
    customer_id: searchParams.get('customer') || '',
    issue_date: today(),
    due_date: addDays(today(), 15),
    notes: 'Thank you for your business!',
    terms: 'Please pay within 15 days via bank transfer or UPI.',
  });
  const [items, setItems] = useState([newItem()]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');       // which button is saving: 'draft' | 'sent' | 'save'
  const [loadingInvoice, setLoadingInvoice] = useState(isEdit);
  const [addingCustomer, setAddingCustomer] = useState(false);

  // When editing, load the existing invoice into the form.
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/invoices/${id}`)
      .then((inv) => {
        setForm({ customer_id: inv.customer_id, issue_date: inv.issue_date, due_date: inv.due_date, notes: inv.notes, terms: inv.terms });
        setItems(inv.items.map((item) => ({ ...item, key: nextKey++, product_id: item.product_id || '' })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingInvoice(false));
  }, [id, isEdit]);

  const totals = calculateTotals(items);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const updateItem = (key, changes) => setItems(items.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  const removeItem = (key) => setItems(items.filter((it) => it.key !== key));

  // Picking a saved product fills in its details (they can still be changed for this invoice).
  function pickProduct(key, productId) {
    const p = productsApi.data.find((x) => String(x.id) === productId);
    updateItem(key, p
      ? { product_id: p.id, description: p.name, unit: p.unit, price: p.price, tax_rate: p.tax_rate }
      : { product_id: '' });
  }

  function validate() {
    const errs = {};
    if (!form.customer_id) errs.customer_id = 'Please choose a customer';
    if (!form.issue_date) errs.issue_date = 'Required';
    if (!form.due_date) errs.due_date = 'Required';
    else if (form.due_date < form.issue_date) errs.due_date = 'Cannot be before the issue date';
    if (items.length === 0) errs.items = 'Add at least one item';
    items.forEach((it) => {
      if (!it.description.trim()) errs[`desc-${it.key}`] = 'Required';
      if (!(Number(it.quantity) > 0)) errs[`qty-${it.key}`] = 'Must be > 0';
      if (it.price === '' || Number(it.price) < 0) errs[`price-${it.key}`] = 'Required';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save(status) {
    setError('');
    if (!validate()) {
      setError('Please fix the highlighted fields.');
      return;
    }
    setSaving(status);
    const body = { ...form, status, items: items.map(({ key, ...item }) => item) };
    try {
      const saved = isEdit ? await api.put(`/invoices/${id}`, body) : await api.post('/invoices', body);
      toast.success(isEdit ? 'Invoice updated' : `Invoice ${saved.invoice_number} created`);
      navigate(`/invoices/${saved.id}`);
    } catch (err) {
      setError(err.message);
      setSaving('');
    }
  }

  if (loadingInvoice || customersApi.loading || productsApi.loading) return <Loading />;

  const customers = customersApi.data || [];
  const products = productsApi.data || [];

  return (
    <>
      <Link to={isEdit ? `/invoices/${id}` : '/invoices'} className="back-link"><Icon name="back" size={16} /> Back</Link>
      <PageHeader title={isEdit ? 'Edit invoice' : 'New invoice'}
        subtitle={isEdit ? null : 'The invoice number is generated automatically when you save.'} />

      <form onSubmit={(e) => { e.preventDefault(); save(isEdit ? 'save' : 'draft'); }} noValidate>
        <ErrorBox message={error} />

        <div className="card">
          <div className="form-grid">
            <Field label="Customer" required error={errors.customer_id}>
              <div className="input-with-btn">
                <select name="customer_id" value={form.customer_id} onChange={update}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                </select>
                <button type="button" className="btn" onClick={() => setAddingCustomer(true)}><Icon name="plus" /> New</button>
              </div>
            </Field>
            <Field label="Issue date" required error={errors.issue_date}>
              <input type="date" name="issue_date" value={form.issue_date} onChange={update} />
            </Field>
            <Field label="Due in">
              <select value="" onChange={(e) => e.target.value !== '' && setForm({ ...form, due_date: addDays(form.issue_date, e.target.value) })}>
                <option value="">Quick pick…</option>
                {DUE_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Due date" required error={errors.due_date}>
              <input type="date" name="due_date" value={form.due_date} min={form.issue_date} onChange={update} />
            </Field>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Items</h2>
          {errors.items && <p className="field-error">{errors.items}</p>}

          <div className="items">
            <div className="item-row item-head">
              <span>Product / service</span><span>Description</span><span>Qty</span><span>Price (₹)</span>
              <span>Disc %</span><span>GST</span><span className="num">Amount</span><span />
            </div>

            {items.map((it, index) => (
              <div className="item-row" key={it.key}>
                <label className="item-cell">
                  <span className="item-label">Product / service</span>
                  <select value={it.product_id} onChange={(e) => pickProduct(it.key, e.target.value)}>
                    <option value="">Custom item</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className={`item-cell ${errors[`desc-${it.key}`] ? 'has-error' : ''}`}>
                  <span className="item-label">Description</span>
                  <input value={it.description} placeholder="What are you billing for?" onChange={(e) => updateItem(it.key, { description: e.target.value })} />
                </label>
                <label className={`item-cell ${errors[`qty-${it.key}`] ? 'has-error' : ''}`}>
                  <span className="item-label">Qty {it.unit && `(${it.unit})`}</span>
                  <input type="number" min="0" step="any" value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: e.target.value })} />
                </label>
                <label className={`item-cell ${errors[`price-${it.key}`] ? 'has-error' : ''}`}>
                  <span className="item-label">Price (₹)</span>
                  <input type="number" min="0" step="0.01" value={it.price} onChange={(e) => updateItem(it.key, { price: e.target.value })} />
                </label>
                <label className="item-cell">
                  <span className="item-label">Disc %</span>
                  <input type="number" min="0" max="100" value={it.discount} onChange={(e) => updateItem(it.key, { discount: e.target.value })} />
                </label>
                <label className="item-cell">
                  <span className="item-label">GST</span>
                  <select value={it.tax_rate} onChange={(e) => updateItem(it.key, { tax_rate: e.target.value })}>
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </label>
                <div className="item-cell item-amount">
                  <span className="item-label">Amount</span>
                  <strong>{money(totals.lines[index])}</strong>
                </div>
                <button type="button" className="icon-btn danger item-remove" onClick={() => removeItem(it.key)}
                  disabled={items.length === 1} title="Remove item" aria-label="Remove item"><Icon name="trash" /></button>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-soft" onClick={() => setItems([...items, newItem()])}><Icon name="plus" /> Add item</button>
        </div>

        <div className="grid-2">
          <div className="card">
            <Field label="Notes" hint="Shown on the invoice">
              <textarea name="notes" rows={3} value={form.notes} onChange={update} />
            </Field>
            <Field label="Payment terms">
              <textarea name="terms" rows={3} value={form.terms} onChange={update} />
            </Field>
          </div>

          <div className="card totals">
            <div className="totals-row"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="totals-row"><span>Discount</span><span>− {money(totals.discount)}</span></div>}
            {totals.taxes.map((t) => <div key={t.rate} className="totals-row"><span>GST @ {t.rate}%</span><span>{money(t.amount)}</span></div>)}
            <div className="totals-row totals-grand"><span>Total</span><span>{money(totals.total)}</span></div>

            <div className="form-actions">
              {isEdit ? (
                <Button type="submit" loading={saving === 'save'}>Save changes</Button>
              ) : (
                <>
                  <Button type="submit" className="btn" loading={saving === 'draft'} disabled={!!saving}>Save as draft</Button>
                  <Button type="button" loading={saving === 'sent'} disabled={!!saving} onClick={() => save('sent')}>Save & mark as sent</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>

      {addingCustomer && (
        <CustomerForm onClose={() => setAddingCustomer(false)} onSaved={(c) => {
          customersApi.setData([...customers, c]);
          setForm({ ...form, customer_id: c.id });
          setAddingCustomer(false);
        }} />
      )}
    </>
  );
}
