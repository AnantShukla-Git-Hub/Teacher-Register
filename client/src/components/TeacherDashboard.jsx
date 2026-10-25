import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function TeacherDashboard({ teacher, onOpenClassroom, onSignOut }) {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New classroom form state
  const [newClassName, setNewClassName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Copy notification state
  const [copiedId, setCopiedId] = useState(null);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getClassrooms();
      setClassrooms(data.classrooms || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve classrooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newClassName.trim() || !newPassword.trim()) {
      setCreateError('Classroom name and password are required.');
      return;
    }

    try {
      setCreating(true);
      setCreateError('');
      await api.createClassroom({
        name: newClassName.trim(),
        subject: newSubject.trim(),
        roomId: newRoomId.trim().toUpperCase(),
        roomPassword: newPassword.trim(),
      });
      setNewClassName('');
      setNewSubject('');
      setNewRoomId('');
      setNewPassword('');
      fetchClassrooms();
    } catch (err) {
      setCreateError(err.message || 'Failed to create classroom');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClassroom = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Delete classroom "${name}"? All student rosters and attendance records will be removed.`)) {
      return;
    }

    try {
      await api.deleteClassroom(id);
      fetchClassrooms();
    } catch (err) {
      alert(err.message || 'Failed to delete classroom');
    }
  };

  const copyRoomDetails = (e, room) => {
    e.stopPropagation();
    const text = `Class: ${room.name} (${room.subject || 'Standard'})\nRoom ID: ${room.room_id}\nRoom Password: ${room.room_password}`;
    navigator.clipboard.writeText(text);
    setCopiedId(room.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const teacherName = teacher?.name || 'Instructor';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
      {/* HEADER */}
      <header className="archival-header">
        <span className="sf brand">Teacher Register</span>
        <div className="header-meta">
          <span className="mu" style={{ fontSize: '13px' }}>Prof. {teacherName}</span>
          <button className="lk" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      {/* DASHBOARD SPLIT VIEW */}
      <div className="dash flex-1">
        {/* LEFT SECTION: CLASSROOM DIRECTORY */}
        <section>
          <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', marginBottom: '20px' }}>Your classrooms</h1>

          {error && (
            <div style={{ padding: '12px', border: '1px solid var(--no)', color: 'var(--no)', marginBottom: '20px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="mu mono" style={{ padding: '40px 0' }}>Loading classroom register index...</div>
          ) : classrooms.length === 0 ? (
            <div style={{ border: '1px solid var(--rule)', padding: '24px', textAlign: 'center', backgroundColor: '#FAF8F5', margin: '16px 0' }}>
              <p className="mu" style={{ margin: 0, fontSize: '14px' }}>
                No classrooms registered yet. Create your first classroom using the form below.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARD VIEW (< 768px) */}
              <div className="block md:hidden">
                {classrooms.map((cls) => (
                  <div key={cls.id} className="mobile-ledger-card">
                    <div>
                      <span className="lb" style={{ marginBottom: '2px' }}>Classroom</span>
                      <h3 style={{ fontSize: '20px', fontWeight: 600 }}>{cls.name}</h3>
                      {cls.subject && (
                        <p className="mu" style={{ margin: '4px 0 0', fontSize: '13px' }}>{cls.subject}</p>
                      )}
                    </div>

                    <div className="mobile-ledger-grid">
                      <div>
                        <span className="lb">Room ID</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{cls.room_id}</span>
                      </div>
                      <div>
                        <span className="lb">Password</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{cls.room_password}</span>
                      </div>
                      <div>
                        <span className="lb">Students</span>
                        <span className="mono">{cls.student_count || 0}</span>
                      </div>
                      <div>
                        <span className="lb">Sessions</span>
                        <span className="mono">{cls.total_sessions || 0}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        style={{ flex: 1, minWidth: '140px', minHeight: '42px', fontSize: '14px' }}
                        onClick={() => onOpenClassroom(cls.id)}
                      >
                        Open register
                      </button>
                      <button
                        className="lk lk-sm mu"
                        style={{ border: '1px solid var(--rule)', padding: '0 12px', minHeight: '42px' }}
                        onClick={(e) => copyRoomDetails(e, cls)}
                        title="Copy student invite"
                      >
                        {copiedId === cls.id ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        className="lk lk-sm"
                        style={{ color: 'var(--no)', border: '1px solid var(--rule)', padding: '0 12px', minHeight: '42px' }}
                        onClick={(e) => handleDeleteClassroom(e, cls.id, cls.name)}
                        title="Delete classroom"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW (>= 768px) */}
              <div className="scroll hidden md:block">
                <table className="archival-table">
                  <thead>
                    <tr>
                      <th>Classroom</th>
                      <th>Room ID</th>
                      <th>Password</th>
                      <th>Students</th>
                      <th>Sessions</th>
                      <th>Action</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {classrooms.map((cls) => (
                      <tr key={cls.id}>
                        <td>
                          <b style={{ fontWeight: 500 }}>{cls.name}</b>
                          {cls.subject && (
                            <>
                              <br />
                              <span className="mu" style={{ fontSize: '13px' }}>{cls.subject}</span>
                            </>
                          )}
                        </td>
                        <td className="mono">{cls.room_id}</td>
                        <td className="mono">{cls.room_password}</td>
                        <td className="mono">{cls.student_count || 0}</td>
                        <td className="mono">{cls.total_sessions || 0}</td>
                        <td>
                          <button className="lk" onClick={() => onOpenClassroom(cls.id)}>
                            Open register
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button
                              className="lk lk-sm mu"
                              onClick={(e) => copyRoomDetails(e, cls)}
                              title="Copy student invite"
                            >
                              {copiedId === cls.id ? 'Copied' : 'Copy'}
                            </button>
                            <button
                              className="lk lk-sm"
                              style={{ color: 'var(--no)' }}
                              onClick={(e) => handleDeleteClassroom(e, cls.id, cls.name)}
                              title="Delete classroom"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="mu" style={{ fontSize: '13px', marginTop: '16px' }}>
            Share the Room ID and password with students so they can sign in.
          </p>
        </section>

        {/* RIGHT SECTION: NEW CLASSROOM */}
        <section>
          <h2 style={{ fontSize: '28px', marginBottom: '24px' }}>New classroom</h2>

          {createError && (
            <div style={{ padding: '12px', border: '1px solid var(--no)', color: 'var(--no)', marginBottom: '20px', fontSize: '13px' }}>
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateSubmit}>
            <label>
              <span className="lb">Name</span>
              <input
                type="text"
                className="archival-input"
                placeholder="e.g. Computer Science, Year 3"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                required
              />
            </label>

            <label>
              <span className="lb">Subject</span>
              <input
                type="text"
                className="archival-input"
                placeholder="e.g. CS302 Operating Systems"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
            </label>

            <label>
              <span className="lb">Room ID</span>
              <input
                type="text"
                className="archival-input"
                placeholder="Auto-generated if empty"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value.toUpperCase())}
              />
            </label>

            <label style={{ marginBottom: '24px' }}>
              <span className="lb">Student password</span>
              <input
                type="text"
                className="archival-input"
                placeholder="Minimum 4 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn" disabled={creating} style={{ width: '100%' }}>
              {creating ? 'Creating classroom...' : 'Create classroom'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
