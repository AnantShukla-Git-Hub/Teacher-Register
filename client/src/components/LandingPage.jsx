import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api, setAuthToken, setStoredTeacher } from '../api';

export default function LandingPage({ onTeacherLogin, onStudentEnter }) {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [teacherError, setTeacherError] = useState('');
  const [showDocs, setShowDocs] = useState(false);

  // Google OAuth Success
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setTeacherError('');
      const data = await api.googleLogin(credentialResponse.credential);
      setAuthToken(data.token);
      setStoredTeacher(data.teacher);
      onTeacherLogin(data.teacher, data.isNewUser);
    } catch (err) {
      console.error(err);
      setTeacherError(err.message || 'Google authentication failed. Please verify credentials.');
    }
  };

  // Student Join
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setStudentError('');

    if (!roomId.trim() || !password.trim() || !rollNo.trim()) {
      setStudentError('Please provide Room ID, Room Password, and your Roll Number.');
      return;
    }

    try {
      setStudentLoading(true);
      const data = await api.studentJoin({
        roomId: roomId.trim(),
        password: password.trim(),
        rollNo: rollNo.trim(),
      });
      onStudentEnter(data);
    } catch (err) {
      console.error(err);
      setStudentError(err.message || 'Unable to join classroom. Verify your credentials.');
    } finally {
      setStudentLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
      {/* HEADER */}
      <header className="archival-header">
        <span className="sf brand">Teacher Register</span>
        <div className="header-meta">
          <span className="mu hidden sm:inline" style={{ fontSize: '13px' }}>Classroom attendance & assessment</span>
          <button 
            type="button" 
            className="lk lk-sm" 
            style={{ fontSize: '13px' }}
            onClick={() => setShowDocs(!showDocs)}
          >
            {showDocs ? 'Close guide' : 'System guide'}
          </button>
        </div>
      </header>

      {/* SYSTEM GUIDE DRAWER (IF TOGGLED) */}
      {showDocs && (
        <section style={{ borderBottom: '1px solid var(--ink)', padding: '24px 20px', backgroundColor: '#EDE8DE' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <span className="lb">System Guide & Verification Standards</span>
            <h2 style={{ fontSize: '24px', margin: '8px 0 16px' }}>Operating Rules & Access Architecture</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', fontSize: '14px' }}>
              <div>
                <b style={{ fontWeight: 600 }}>1. For Teachers</b>
                <p className="mu" style={{ margin: '6px 0 0' }}>
                  Sign in once via Google OAuth. Create classrooms with room ID and password. Upload student roster CSV or add students individually. Mark daily attendance with one click and create custom assessment columns.
                </p>
              </div>
              <div>
                <b style={{ fontWeight: 600 }}>2. For Students</b>
                <p className="mu" style={{ margin: '6px 0 0' }}>
                  Enter room credentials and your roll number (e.g. 1, 2, 3, or college roll number). View your verified attendance percentage, attendance history, and private grades in real time.
                </p>
              </div>
              <div>
                <b style={{ fontWeight: 600 }}>3. Real-Time Sync</b>
                <p className="mu" style={{ margin: '6px 0 0' }}>
                  WebSocket channels deliver live updates the instant attendance is stamped. Students only receive events for their own roll number.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* HERO SECTION */}
      <section className="hero-section">
        <h1 className="hero-title">Attendance and marks, kept the way a register is kept.</h1>
        <p className="mu" style={{ fontSize: '16px', maxWidth: '620px', margin: '20px 0 0', lineHeight: 1.6 }}>
          Teachers mark each day in a ruled sheet and add columns for assignments and tests. Students see only their own record, updated as it changes.
        </p>
      </section>

      {/* TWO COLUMNS SECTION */}
      <section className="two">
        {/* TEACHERS */}
        <div>
          <span className="lb">For teachers</span>
          <h2 style={{ fontSize: '32px', margin: '8px 0 12px' }}>Open your classrooms</h2>
          <p className="mu" style={{ margin: '0 0 28px', maxWidth: '420px' }}>
            One sign-in with your Google account. Create a classroom, import a roll list, and start marking.
          </p>

          {teacherError && (
            <div style={{ padding: '12px', border: '1px solid var(--no)', color: 'var(--no)', marginBottom: '20px', fontSize: '13px' }}>
              {teacherError}
            </div>
          )}

          <div style={{ maxWidth: '320px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setTeacherError('Google Sign-In was cancelled or failed.')}
              shape="rectangular"
              size="large"
              text="signin_with"
              width="100%"
            />
          </div>
          <p className="mu" style={{ fontSize: '13px', margin: '16px 0 0' }}>
            Secure sign-in via verified Google OAuth.
          </p>
        </div>

        {/* STUDENTS */}
        <div>
          <span className="lb">For students</span>
          <h2 style={{ fontSize: '32px', margin: '8px 0 12px' }}>See your record</h2>

          {studentError && (
            <div style={{ padding: '12px', border: '1px solid var(--no)', color: 'var(--no)', marginBottom: '20px', fontSize: '13px' }}>
              {studentError}
            </div>
          )}

          <form onSubmit={handleStudentSubmit} style={{ maxWidth: '460px' }}>
            <label>
              <span className="lb">Room ID</span>
              <input
                type="text"
                className="archival-input"
                placeholder="e.g. CS-101"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                required
              />
            </label>
            <label>
              <span className="lb">Room password</span>
              <input
                type="password"
                className="archival-input"
                placeholder="Enter room password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label style={{ marginBottom: '24px' }}>
              <span className="lb">Class roll number</span>
              <input
                type="text"
                className="archival-input"
                placeholder="e.g. 1, 2, 3 or full roll number"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn" disabled={studentLoading}>
              {studentLoading ? 'Verifying...' : 'View my record'}
            </button>
          </form>
          <p className="mu" style={{ fontSize: '13px', margin: '16px 0 0' }}>
            You can only view your own attendance and marks.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '32px 56px', borderTop: '1px solid var(--rule)', marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
        <span className="mu">Teacher Register System — Free, Secure, Archival Ledger</span>
        <span className="mono mu">WS_ONLINE</span>
      </footer>
    </div>
  );
}
