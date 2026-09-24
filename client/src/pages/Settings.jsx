// Business profile: shown at the top of every invoice.
import { useEffect, useState } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, ErrorBox, Field, Loading, PageHeader } from '../components/ui';

export default function Settings() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/business')
      .then((b) => setForm({ name: b.name || '', address: b.address || '', gstin: b.gstin || '', email: b.email || '', phone: b.phone || '', logo: b.logo }))
      .catch((err) => setError(err.message));
  }, []);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Business name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin.toUpperCase())) errs.gstin = 'Invalid GSTIN (e.g. 27ABCDE1234F1Z5)';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    setError('');
    try {
      const saved = await api.put('/business', form);
      setForm({ ...form, ...saved });
      toast.success('Business profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(e) {
    const file = e.target.files[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return toast.error('Please choose a PNG or JPG image');
    if (file.size > 2 * 1024 * 1024) return toast.error('Logo must be smaller than 2 MB');

    setUploading(true);
    try {
      const data = new FormData();
      data.append('logo', file);
      const saved = await api.post('/business/logo', data);
      setForm((f) => ({ ...f, logo: saved.logo }));
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (!form) return error ? <ErrorBox message={error} /> : <Loading />;

  return (
    <>
      <PageHeader title="Business profile" subtitle="These details appear on every invoice you send." />

      <form className="card settings" onSubmit={handleSubmit} noValidate>
        <ErrorBox message={error} />

        <div className="logo-upload">
          <div className="logo-preview">
            {form.logo ? <img src={`/uploads/${form.logo}`} alt="Business logo" /> : <span>{form.name.charAt(0) || 'B'}</span>}
          </div>
          <div>
            <label className="btn">
              <Icon name="upload" /> {uploading ? 'Uploading…' : form.logo ? 'Change logo' : 'Upload logo'}
              <input type="file" accept="image/png,image/jpeg" onChange={handleLogo} hidden disabled={uploading} />
            </label>
            <p className="muted small">PNG or JPG, up to 2 MB.</p>
          </div>
        </div>

        <div className="form-grid">
          <Field label="Business name" required error={errors.name}>
            <input name="name" value={form.name} onChange={update} />
          </Field>
          <Field label="GSTIN" error={errors.gstin}>
            <input name="gstin" value={form.gstin} onChange={update} maxLength={15} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" name="email" value={form.email} onChange={update} />
          </Field>
          <Field label="Phone">
            <input name="phone" value={form.phone} onChange={update} />
          </Field>
        </div>
        <Field label="Address">
          <textarea name="address" rows={3} value={form.address} onChange={update} />
        </Field>

        <div className="form-actions">
          <Button type="submit" loading={saving}>Save profile</Button>
        </div>
      </form>
    </>
  );
}
