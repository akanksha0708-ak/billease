// Split screen for the login & register pages: photo panel on the left, form on the right.
// Background photo: Pixabay (free for commercial use, no attribution required).

const FEATURES = [
  'GST-ready invoices with automatic tax calculation',
  'Track partial payments and overdue invoices',
  'Download, print or email professional PDFs',
];

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <aside className="auth-hero">
        <span className="brand brand-light"><span className="brand-mark">B</span> BillEase</span>

        <div className="auth-hero-text">
          <h2>Invoicing made simple for growing businesses.</h2>
          <ul>
            {FEATURES.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>

        <span className="auth-credit">Photo: Pixabay</span>
      </aside>

      <main className="auth-main">{children}</main>
    </div>
  );
}
