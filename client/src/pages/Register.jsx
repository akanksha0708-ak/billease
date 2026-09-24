import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import AuthLayout from '../components/AuthLayout';
import { Button, ErrorBox, Field } from '../components/ui';

export default function Register() {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Please enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Please enter a valid email';
    if (form.password.length < 6) errs.password = 'At least 6 characters';
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const { name, email, password } = form;
      login(await api.post('/auth/register', { name, email, password }));
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <h1>Create your account</h1>
        <p className="muted">Start sending professional invoices in minutes.</p>

        <ErrorBox message={error} />
        <Field label="Your name" error={errors.name}>
          <input name="name" value={form.name} onChange={update} autoFocus autoComplete="name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" name="email" value={form.email} onChange={update} autoComplete="email" />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" name="password" value={form.password} onChange={update} autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <input type="password" name="confirm" value={form.confirm} onChange={update} autoComplete="new-password" />
        </Field>

        <Button type="submit" loading={loading} className="btn-primary btn-block">Create account</Button>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </AuthLayout>
  );
}
