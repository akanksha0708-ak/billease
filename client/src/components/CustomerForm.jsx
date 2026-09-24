// Add / edit customer form in a modal. Used on the Customers page and the invoice form.
import { useState } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { Button, ErrorBox, Field, Modal } from './ui';

const EMPTY = { name: '', company: '', email: '', phone: '', gstin: '', billing_address: '' };

export default function CustomerForm({ customer, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(customer ? { ...EMPTY, ...customer } : EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (form.phone && !/^[+\d\s-]{7,15}$/.test(form.phone)) errs.phone = 'Invalid phone number';
    if (form.gstin && form.gstin.trim().length !== 15) errs.gstin = 'GSTIN must be 15 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const saved = customer
        ? await api.put(`/customers/${customer.id}`, form)
        : await api.post('/customers', form);
      toast.success(customer ? 'Customer updated' : 'Customer added');
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <ErrorBox message={error} />
        <div className="form-grid">
          <Field label="Customer name" required error={errors.name}>
            <input name="name" value={form.name} onChange={update} autoFocus />
          </Field>
          <Field label="Company">
            <input name="company" value={form.company} onChange={update} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" name="email" value={form.email} onChange={update} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input name="phone" value={form.phone} onChange={update} />
          </Field>
          <Field label="GSTIN" error={errors.gstin} hint="Optional, e.g. 27ABCDE1234F1Z5">
            <input name="gstin" value={form.gstin} onChange={update} maxLength={15} style={{ textTransform: 'uppercase' }} />
          </Field>
        </div>
        <Field label="Billing address">
          <textarea name="billing_address" rows={3} value={form.billing_address} onChange={update} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <Button type="submit" loading={saving}>{customer ? 'Save changes' : 'Add customer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
