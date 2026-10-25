import React, { useState, useEffect } from 'react';
import socket from '../socket';

export default function StudentPortal({ initialData, onLeave }) {
  const [classroom] = useState(initialData.classroom);
  const [student] = useState(initialData.student);
  const [customColumns, setCustomColumns] = useState(initialData.customColumns || []);
  const [attendance, setAttendance] = useState(initialData.attendance || []);
  const [marks, setMarks] = useState(initialData.marks || []);
  const [livePulse, setLivePulse] = useState(false);
  const [liveToast, setLiveToast] = useState(null);

  // Real-time WebSocket connection
  useEffect(() => {
    if (!classroom?.room_id) return;

    const roomId = classroom.room_id.toUpperCase();

    const joinRoom = () => {
      socket.emit('join_classroom', {
        token: initialData.token,
        role: 'student',
        roomId,
        rollNo: student.roll_no,
      });
    };

    joinRoom();
    socket.on('connect', joinRoom);

    const handleAttendanceUpdated = (payload) => {
      if (
        payload.studentId === student.id ||
        (payload.rollNo && payload.rollNo.toUpperCase() === student.roll_no.toUpperCase())
      ) {
        setLivePulse(true);
        setLiveToast(`Attendance updated: ${payload.status}`);
        setTimeout(() => setLivePulse(false), 1500);
        setTimeout(() => setLiveToast(null), 3500);

        setAttendance((prev) => {
          const list = [...prev];
          const idx = list.findIndex((a) => a.date === payload.date);
          if (idx >= 0) {
            list[idx] = { ...list[idx], status: payload.status, updated_at: payload.updatedAt };
          } else {
            list.unshift({ date: payload.date, status: payload.status, updated_at: payload.updatedAt });
          }
          return list;
        });
      }
    };

    const handleMarksUpdated = (payload) => {
      if (
        payload.studentId === student.id ||
        (payload.rollNo && payload.rollNo.toUpperCase() === student.roll_no.toUpperCase())
      ) {
        setLivePulse(true);
        setLiveToast('Evaluation marks updated live');
        setTimeout(() => setLivePulse(false), 1500);
        setTimeout(() => setLiveToast(null), 3500);

        setMarks((prev) => {
          const list = [...prev];
          const idx = list.findIndex((m) => m.column_id === payload.columnId);
          if (idx >= 0) {
            list[idx] = { ...list[idx], value: payload.value, updated_at: payload.updatedAt };
          } else {
            list.push({ column_id: payload.columnId, value: payload.value, updated_at: payload.updatedAt });
          }
          return list;
        });
      }
    };

    const handleColumnAdded = (payload) => {
      if (payload.column) {
        setCustomColumns((prev) => [...prev, payload.column]);
      }
    };

    const handleColumnDeleted = (payload) => {
      setCustomColumns((prev) => prev.filter((c) => c.id !== payload.columnId));
      setMarks((prev) => prev.filter((m) => m.column_id !== payload.columnId));
    };

    socket.on('attendance_updated', handleAttendanceUpdated);
    socket.on('marks_updated', handleMarksUpdated);
    socket.on('column_added', handleColumnAdded);
    socket.on('column_deleted', handleColumnDeleted);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('attendance_updated', handleAttendanceUpdated);
      socket.off('marks_updated', handleMarksUpdated);
      socket.off('column_added', handleColumnAdded);
      socket.off('column_deleted', handleColumnDeleted);
    };
  }, [classroom?.room_id, student.id, student.roll_no, initialData.token]);

  // Attendance statistics (only count active recorded sessions: P, A, L)
  const validRecords = attendance.filter((a) => a.status === 'PRESENT' || a.status === 'ABSENT' || a.status === 'LATE');
  const presentDays = validRecords.filter((a) => a.status === 'PRESENT').length;
  const lateDays = validRecords.filter((a) => a.status === 'LATE').length;
  const absentDays = validRecords.filter((a) => a.status === 'ABSENT').length;
  const totalClassesRecorded = validRecords.length;
  const attendedCount = presentDays + lateDays;
  const attendancePercentage =
    totalClassesRecorded > 0 ? Math.round((attendedCount / totalClassesRecorded) * 100) : 100;

  const getMarkForColumn = (colId) => {
    const match = marks.find((m) => m.column_id === colId);
    return match ? match.value : '—';
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = clean.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    try {
      // Normalize UTC timestamp string from database
      const iso = ts.includes('T') ? ts : (ts.replace(' ', 'T') + (ts.endsWith('Z') ? '' : 'Z'));
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
      {/* HEADER */}
      <header className="archival-header">
        <span className="sf brand">Teacher Register</span>
        <div className="header-meta">
          <button className="lk" onClick={onLeave}>Leave classroom</button>
        </div>
      </header>

      {/* STUDENT PROFILE TITLE */}
      <section style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 56px) 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="lb mono">Room {classroom.room_id} &nbsp; Roll No. {student.roll_no}</span>
            <h1 style={{ fontSize: 'clamp(24px, 5vw, 40px)' }}>{student.name}</h1>
          </div>
          {liveToast && (
            <span className="mono" style={{ fontSize: '13px', border: '1px solid var(--ok)', color: 'var(--ok)', padding: '4px 12px' }}>
              {liveToast}
            </span>
          )}
        </div>
      </section>

      {/* TWO COLUMN STUDENT LEDGER */}
      <div className="stu flex-1">
        {/* LEFT COLUMN: ATTENDANCE SUMMARY & MARKS */}
        <section>
          <span className="lb">Attendance</span>
          <div className="sf percentage-stat">
            {attendancePercentage}%
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 500 }}>
            {attendedCount} of {totalClassesRecorded} sessions attended
          </p>
          <p className="mu" style={{ margin: '0 0 32px' }}>
            {absentDays} missed. {attendancePercentage >= 75 ? 'Above the 75% requirement.' : 'Below the 75% requirement.'}
          </p>

          <span className="lb">Evaluation marks</span>
          <table className="archival-table" style={{ marginTop: '8px' }}>
            <tbody>
              {customColumns.length === 0 ? (
                <tr>
                  <td colSpan="2" className="mu" style={{ padding: '16px 0' }}>
                    No continuous evaluation columns added yet.
                  </td>
                </tr>
              ) : (
                customColumns.map((col) => (
                  <tr key={col.id}>
                    <td>{col.title}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {getMarkForColumn(col.id)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* RIGHT COLUMN: ATTENDANCE HISTORY */}
        <section>
          <span className="lb">History</span>
          <table className="archival-table" style={{ marginTop: '8px' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan="3" className="mu" style={{ padding: '24px 0', textAlign: 'center' }}>
                    No attendance records for your roll number yet.
                  </td>
                </tr>
              ) : (
                attendance.map((rec) => {
                  const isPresent = rec.status === 'PRESENT';
                  const isAbsent = rec.status === 'ABSENT';
                  const isLate = rec.status === 'LATE';

                  return (
                    <tr key={rec.date}>
                      <td className="mono">{formatDateDisplay(rec.date)}</td>
                      <td className={isPresent ? 'ok' : isAbsent ? 'no' : isLate ? 'lt' : 'mu'}>
                        {isPresent ? 'Present' : isAbsent ? 'Absent' : isLate ? 'Late' : 'None'}
                      </td>
                      <td className="mono mu">{formatTime(rec.updated_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* FOOTER */}
      <footer style={{ padding: '24px 56px', borderTop: '1px solid var(--rule)', marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
        <span className="mu">Verified Student Portal &mdash; Scoped Session Record</span>
        <span className="mono mu">WS_LIVE</span>
      </footer>
    </div>
  );
}
