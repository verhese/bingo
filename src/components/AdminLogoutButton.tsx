'use client';

import { useState } from 'react';

export function AdminLogoutButton() {
  const [error, setError] = useState<string | null>(null);
  const handleLogout = async () => {
    setError(null);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out.');
      window.location.assign('/lobby');
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    }
  };

  return (
    <div className="flex items-center gap-3">
      {error && <span role="alert" className="text-sm font-bold text-bingo-danger">{error}</span>}
      <button type="button" onClick={handleLogout} className="bar-button">Sign out</button>
    </div>
  );
}
