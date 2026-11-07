'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageBar } from '@/components/PageBar';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? 'Unable to sign in.');
      }
      router.replace('/lobby');
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell text-xl">
      <PageBar title="Administrator sign in">
        <a href="/lobby" className="bar-button">Back to lobby</a>
      </PageBar>
      <div className="page-content">
        <form onSubmit={handleSubmit} className="page-panel flex max-w-xl flex-col gap-4">
          <label htmlFor="admin-password" className="font-bold text-bingo-text">Administrator password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border-2 border-bingo-muted bg-bingo-bg px-4 py-3 text-lg font-bold text-bingo-text"
            required
          />
          {error && <p role="alert" className="font-bold text-bingo-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="bar-button bar-button-primary disabled:opacity-50">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
