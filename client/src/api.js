// Tiny wrapper around fetch that adds the login token and turns API errors into thrown Errors.
const TOKEN_KEY = 'billing_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY));

async function request(method, url, body) {
  const isForm = body instanceof FormData;
  const token = getToken();

  const res = await fetch(`/api${url}`, {
    method,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isForm ? body : body && JSON.stringify(body),
  });

  // Session expired → back to the login page.
  if (res.status === 401 && token) {
    setToken(null);
    window.location.href = '/login';
    return;
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
};

// Downloads the invoice PDF (needs the token, so a plain <a href> would not work).
export async function downloadPdf(invoice) {
  const res = await fetch(`/api/invoices/${invoice.id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Could not generate the PDF');

  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoice.invoice_number}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
