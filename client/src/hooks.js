import { useEffect, useState } from 'react';
import { api } from './api';

// Loads data from the API and tracks loading/error state.
// Call reload() after a change to fetch fresh data.
export function useApi(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true; // ignore answers from older requests (e.g. while typing a search)
    setLoading(true);
    api.get(url)
      .then((result) => { if (active) { setData(result); setError(''); } })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [url, version]);

  return { data, setData, loading, error, reload: () => setVersion((v) => v + 1) };
}

// Waits until the user stops typing before returning the new value.
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
