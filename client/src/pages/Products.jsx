import { useState } from 'react';
import { api } from '../api';
import { useApi, useDebounce } from '../hooks';
import { money, GST_RATES } from '../utils';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, EmptyState, ErrorBox, Field, Loading, Modal, PageHeader } from '../components/ui';

const EMPTY = { type: 'product', name: '', description: '', price: '', tax_rate: 18, unit: 'pcs' };

function ProductForm({ product, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(product || EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Switching type suggests a sensible unit.
  const setType = (type) => setForm({ ...form, type, unit: type === 'service' ? 'hrs' : 'pcs' });

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.price === '' || Number(form.price) < 0) errs.price = 'Enter a price of 0 or more';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    setError('');
    try {
      product ? await api.put(`/products/${product.id}`, form) : await api.post('/products', form);
      toast.success(product ? 'Item updated' : 'Item added');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={product ? 'Edit item' : 'Add product or service'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <ErrorBox message={error} />
        <div className="segmented" role="radiogroup" aria-label="Type">
          {['product', 'service'].map((t) => (
            <button key={t} type="button" role="radio" aria-checked={form.type === t}
              className={form.type === t ? 'active' : ''} onClick={() => setType(t)}>
              {t === 'product' ? 'Product' : 'Service'}
            </button>
          ))}
        </div>
        <Field label="Name" required error={errors.name}>
          <input name="name" value={form.name} onChange={update} autoFocus />
        </Field>
        <Field label="Description">
          <textarea name="description" rows={2} value={form.description} onChange={update} />
        </Field>
        <div className="form-grid form-grid-3">
          <Field label="Price (₹)" required error={errors.price}>
            <input type="number" name="price" min="0" step="0.01" value={form.price} onChange={update} />
          </Field>
          <Field label="GST rate">
            <select name="tax_rate" value={form.tax_rate} onChange={update}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </Field>
          <Field label="Unit">
            <input name="unit" value={form.unit} onChange={update} placeholder="pcs, hrs, kg…" />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <Button type="submit" loading={saving}>{product ? 'Save changes' : 'Add item'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState(null);

  const debounced = useDebounce(search);
  const { data: products, loading, error, reload } = useApi(`/products?search=${encodeURIComponent(debounced)}&type=${type}`);

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? Existing invoices will not change.`)) return;
    try {
      await api.del(`/products/${product.id}`);
      toast.success('Item deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const filtered = search || type;

  return (
    <>
      <PageHeader title="Products & Services" subtitle="Things you sell, with their price and GST rate.">
        <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" /> Add item</button>
      </PageHeader>

      <div className="toolbar card">
        <div className="search">
          <Icon name="search" />
          <input placeholder="Search products & services" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
        </select>
      </div>

      <ErrorBox message={error} onRetry={reload} />
      {loading && !products ? <Loading /> : products.length === 0 ? (
        <div className="card">
          <EmptyState icon="box" title={filtered ? 'No matching items' : 'No products or services yet'}
            text={filtered ? 'Try a different search or filter.' : 'Add what you sell so you can pick it quickly on invoices.'}
            action={!filtered && <button className="btn btn-primary" onClick={() => setEditing({})}>Add item</button>} />
        </div>
      ) : (
        <div className="card card-flush">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th className="num">Price</th><th className="num">GST</th><th>Unit</th><th /></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td data-label="Name"><strong>{p.name}</strong>{p.description && <div className="muted small">{p.description}</div>}</td>
                  <td data-label="Type"><span className={`tag tag-${p.type}`}>{p.type}</span></td>
                  <td data-label="Price" className="num">{money(p.price)}</td>
                  <td data-label="GST" className="num">{p.tax_rate}%</td>
                  <td data-label="Unit">{p.unit}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(p)}><Icon name="edit" /></button>
                    <button className="icon-btn danger" title="Delete" aria-label="Delete" onClick={() => handleDelete(p)}><Icon name="trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductForm product={editing.id ? editing : null} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }} />
      )}
    </>
  );
}
