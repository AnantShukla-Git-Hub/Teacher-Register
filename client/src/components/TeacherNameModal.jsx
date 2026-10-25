import React, { useState } from 'react';
import { api, setStoredTeacher } from '../api';

export default function TeacherNameModal({ currentName, onSave }) {
  const [name, setName] = useState(currentName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide your official name or title.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.updateTeacherName(name.trim());
      setStoredTeacher(res.teacher);
      onSave(res.teacher);
    } catch (err) {
      setError(err.message || 'Failed to save name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(28, 27, 24, 0.45)', backdropFilter: 'blur(2px)' }}
    >
      <div 
        style={{
          backgroundColor: 'var(--bg)',
          color: 'var(--ink)',
          border: '1px solid var(--ink)',
          maxWidth: '440px',
          width: '100%',
          padding: '36px 32px'
        }}
      >
        <span className="lb">First-time profile setup</span>
        <h3 className="sf" style={{ fontSize: '26px', margin: '8px 0 12px' }}>
          Instructor designation
        </h3>
        <p className="mu" style={{ fontSize: '14px', marginBottom: '24px' }}>
          Please specify the name or title to display on your classroom ledgers and student portals.
        </p>

        {error && (
          <div style={{ padding: '10px 12px', border: '1px solid var(--no)', color: 'var(--no)', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '24px' }}>
            <span className="lb">Your Name or Title</span>
            <input
              type="text"
              className="archival-input"
              placeholder="e.g. Prof. Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </label>

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Saving designation...' : 'Confirm designation'}
          </button>
        </form>
      </div>
    </div>
  );
}
