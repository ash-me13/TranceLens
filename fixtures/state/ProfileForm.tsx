import React, { useState } from 'react';

export function BuggyProfileForm() {
  const [name, setName] = useState('Alex Rivers');
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // BUG B: Optimistic UI immediately marks "Saved", but the API fails with 500!
    setStatus('saved');
    try {
      await fetch('/api/demo/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      // In buggy mode, failure is ignored or swallowed; UI continues to display "Saved"
    } catch {
      // Ignored
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button type="submit">Save Profile</button>
      {status === 'saved' && <span className="saved-badge">Saved</span>}
    </form>
  );
}

export function FixedProfileForm() {
  const [name, setName] = useState('Alex Rivers');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage('');
    try {
      const res = await fetch('/api/demo/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      setStatus('saved');
    } catch (err: any) {
      // FIXED: Displays error, does not claim "Saved", and handles failure
      setStatus('error');
      setErrorMessage(err.message || 'Failed to save profile');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving...' : 'Save Profile'}
      </button>
      {status === 'saved' && <span className="saved-badge">Saved</span>}
      {status === 'error' && <span className="error-badge">{errorMessage}</span>}
    </form>
  );
}
