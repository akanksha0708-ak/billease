import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import AuthLayout from '../components/AuthLayout';
import { Button, ErrorBox, Field } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      login(await api.post('/auth/login', form));
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p className="muted">Log in to manage your invoices and payments.</p>

        <ErrorBox message={error} />
        <Field label="Email">
          <input type="email" name="email" value={form.email} onChange={update} required autoFocus autoComplete="email" />
        </Field>
        <Field label="Password">
          <input type="password" name="password" value={form.password} onChange={update} required autoComplete="current-password" />
        </Field>

        <Button type="submit" loading={loading} className="btn-primary btn-block">Log in</Button>
        <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>
      </form>
    </AuthLayout>
  );
}
