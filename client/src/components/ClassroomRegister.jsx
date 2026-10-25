import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import socket from '../socket';
import { api, getAuthToken } from '../api';

export default function ClassroomRegister({ classroomId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected date in local timezone (avoids UTC drift)
  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(getTodayDate());

  // Filter input
  const [searchTerm, setSearchTerm] = useState('');

  // Modals / Panels
  const [activePanel, setActivePanel] = useState(null); // 'csv' | 'add_student' | 'add_column' | null
  const [newRollNo, setNewRollNo] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newColTitle, setNewColTitle] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvError, setCsvError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Inline cell editing for evaluation marks
  const [editingCell, setEditingCell] = useState(null); // `${studentId}_${colId}`
  const [editingValue, setEditingValue] = useState('');

  // Copy notification
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Fetch register data
  const fetchRegisterData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getClassroomDetails(classroomId);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load classroom register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisterData();
  }, [classroomId]);

  // WebSocket subscriptions
  useEffect(() => {
    if (!data?.classroom?.room_id) return;

    const roomId = data.classroom.room_id.toUpperCase();
    const token = getAuthToken();

    const joinRoom = () => {
      socket.emit('join_classroom', {
        token,
        role: 'teacher',
        roomId,
      });
    };

    joinRoom();
    socket.on('connect', joinRoom);

    const handleAttendanceUpdated = (payload) => {
      if (payload.classroomId === classroomId) {
        setData((prev) => {
          if (!prev) return prev;
          const updated = [...prev.attendance];
          const idx = updated.findIndex(
            (a) => a.student_id === payload.studentId && a.date === payload.date
          );

          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              status: payload.status,
              updated_at: payload.updatedAt,
            };
          } else {
            updated.push({
              student_id: payload.studentId,
              date: payload.date,
              status: payload.status,
              updated_at: payload.updatedAt,
            });
          }
          return { ...prev, attendance: updated };
        });
      }
    };

    const handleMarksUpdated = (payload) => {
      if (payload.classroomId === classroomId) {
        setData((prev) => {
          if (!prev) return prev;
          const updated = [...prev.marks];
          const idx = updated.findIndex(
            (m) => m.student_id === payload.studentId && m.column_id === payload.columnId
          );

          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              value: payload.value,
              updated_at: payload.updatedAt,
            };
          } else {
            updated.push({
              student_id: payload.studentId,
              column_id: payload.columnId,
              value: payload.value,
              updated_at: payload.updatedAt,
            });
          }
          return { ...prev, marks: updated };
        });
      }
    };

    socket.on('attendance_updated', handleAttendanceUpdated);
    socket.on('marks_updated', handleMarksUpdated);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('attendance_updated', handleAttendanceUpdated);
      socket.off('marks_updated', handleMarksUpdated);
    };
  }, [data?.classroom?.room_id, classroomId]);

  // Attendance helpers
  const getAttendanceStatus = (studentId, date) => {
    if (!data?.attendance) return 'NONE';
    const record = data.attendance.find((a) => a.student_id === studentId && a.date === date);
    return record ? record.status : 'NONE';
  };

  const handleMarkAttendance = async (studentId, statusKey) => {
    const statusMap = { p: 'PRESENT', a: 'ABSENT', l: 'LATE' };
    const targetStatus = statusMap[statusKey] || 'NONE';
    const current = getAttendanceStatus(studentId, selectedDate);
    const newStatus = current === targetStatus ? 'NONE' : targetStatus;

    // Optimistic UI update
    setData((prev) => {
      if (!prev) return prev;
      const updated = [...prev.attendance];
      const idx = updated.findIndex((a) => a.student_id === studentId && a.date === selectedDate);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], status: newStatus };
      } else {
        updated.push({ student_id: studentId, date: selectedDate, status: newStatus });
      }
      return { ...prev, attendance: updated };
    });

    try {
      await api.markAttendance(classroomId, {
        student_id: studentId,
        date: selectedDate,
        status: newStatus,
      });
    } catch (err) {
      console.error('Failed to save attendance:', err);
      fetchRegisterData();
    }
  };

  // Mark all present
  const handleMarkAllPresent = async () => {
    if (!data?.students?.length) return;
    if (!window.confirm(`Mark all ${data.students.length} students PRESENT for ${selectedDate}?`)) {
      return;
    }

    setData((prev) => {
      if (!prev) return prev;
      const updated = [...prev.attendance];
      prev.students.forEach((s) => {
        const idx = updated.findIndex((a) => a.student_id === s.id && a.date === selectedDate);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], status: 'PRESENT' };
        } else {
          updated.push({ student_id: s.id, date: selectedDate, status: 'PRESENT' });
        }
      });
      return { ...prev, attendance: updated };
    });

    try {
      await api.bulkMarkAttendance(classroomId, {
        date: selectedDate,
        status: 'PRESENT',
      });
    } catch (err) {
      alert(err.message || 'Failed to mark all present');
      fetchRegisterData();
    }
  };

  // Marks helpers
  const getStudentMark = (studentId, columnId) => {
    if (!data?.marks) return '';
    const match = data.marks.find((m) => m.student_id === studentId && m.column_id === columnId);
    return match ? match.value : '';
  };

  const handleSaveMark = async (studentId, columnId, value) => {
    const cleanVal = String(value).trim();
    setData((prev) => {
      if (!prev) return prev;
      const updated = [...prev.marks];
      const idx = updated.findIndex((m) => m.student_id === studentId && m.column_id === columnId);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], value: cleanVal };
      } else {
        updated.push({ student_id: studentId, column_id: columnId, value: cleanVal });
      }
      return { ...prev, marks: updated };
    });

    try {
      await api.updateMarks(classroomId, {
        student_id: studentId,
        column_id: columnId,
        value: cleanVal,
      });
    } catch (err) {
      console.error('Failed to save mark:', err);
      fetchRegisterData();
    }
  };

  // Date navigation using local date components
  const shiftDate = (days) => {
    const parts = selectedDate.split('-').map(Number);
    const cur = new Date(parts[0], parts[1] - 1, parts[2]);
    cur.setDate(cur.getDate() + days);
    const year = cur.getFullYear();
    const month = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const formatDateDisplay = (isoStr) => {
    try {
      const d = new Date(isoStr + 'T00:00:00');
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  // Student & Column management
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newRollNo.trim() || !newStudentName.trim()) return;

    try {
      setActionLoading(true);
      await api.addStudent(classroomId, {
        rollNo: newRollNo.trim(),
        name: newStudentName.trim(),
      });
      setNewRollNo('');
      setNewStudentName('');
      setActivePanel(null);
      fetchRegisterData();
    } catch (err) {
      alert(err.message || 'Failed to add student');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Remove "${studentName}" from this classroom register?`)) return;
    try {
      await api.deleteStudent(classroomId, studentId);
      fetchRegisterData();
    } catch (err) {
      alert(err.message || 'Failed to remove student');
    }
  };

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColTitle.trim()) return;

    try {
      setActionLoading(true);
      await api.addColumn(classroomId, newColTitle.trim());
      setNewColTitle('');
      setActivePanel(null);
      fetchRegisterData();
    } catch (err) {
      alert(err.message || 'Failed to add evaluation column');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteColumn = async (columnId, colTitle) => {
    if (!window.confirm(`Delete column "${colTitle}" and all recorded student marks for it?`)) return;
    try {
      await api.deleteColumn(classroomId, columnId);
      fetchRegisterData();
    } catch (err) {
      alert(err.message || 'Failed to delete column');
    }
  };

  // CSV Import
  const handleProcessCsv = async () => {
    setCsvError('');
    if (!csvText.trim()) {
      setCsvError('Please paste CSV text or select a file.');
      return;
    }

    try {
      setActionLoading(true);
      const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
      if (!parsed.data || parsed.data.length === 0) {
        throw new Error('No valid records found in CSV.');
      }

      const normalized = parsed.data
        .map((row) => {
          const rollKey = Object.keys(row).find((k) => /roll|id|number|s\.?no|reg/i.test(k.trim()));
          const nameKey = Object.keys(row).find((k) => /name|student/i.test(k.trim()));
          let rollNo = rollKey ? String(row[rollKey]).trim() : '';
          const name = nameKey ? String(row[nameKey]).trim() : '';
          // Clean decimal artifacts if exported from Excel (e.g. 1.0 -> 1)
          rollNo = rollNo.replace(/\.0+$/, '');
          return rollNo && name ? { rollNo, name } : null;
        })
        .filter(Boolean);

      if (normalized.length === 0) {
        throw new Error('CSV must contain "Roll No" and "Name" columns.');
      }

      await api.importStudents(classroomId, normalized);
      setCsvText('');
      setActivePanel(null);
      fetchRegisterData();
    } catch (err) {
      setCsvError(err.message || 'Failed to import CSV');
    } finally {
      setActionLoading(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!data?.students?.length) {
      alert('No students to export.');
      return;
    }

    const headers = ['Roll No', 'Student Name', `Attendance (${selectedDate})`];
    data.customColumns.forEach((c) => headers.push(c.title));

    const rows = data.students.map((s) => {
      const status = getAttendanceStatus(s.id, selectedDate);
      const row = [s.roll_no, s.name, status];
      data.customColumns.forEach((c) => {
        row.push(getStudentMark(s.id, c.id) || '');
      });
      return row;
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${data.classroom.name.replace(/\s+/g, '_')}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyInvite = () => {
    const text = `Class: ${data.classroom.name}\nRoom ID: ${data.classroom.room_id}\nRoom Password: ${data.classroom.room_password}`;
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
        <header className="archival-header">
          <span className="sf brand">Teacher Register</span>
          <button className="lk" onClick={onBack}>Back to classrooms</button>
        </header>
        <div className="pad mu mono">Loading classroom register records...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
        <header className="archival-header">
          <span className="sf brand">Teacher Register</span>
          <button className="lk" onClick={onBack}>Back to classrooms</button>
        </header>
        <div className="pad">
          <div style={{ padding: '16px', border: '1px solid var(--no)', color: 'var(--no)', marginBottom: '20px' }}>
            {error || 'Classroom records not found.'}
          </div>
          <button className="btn" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  // Filter students
  const filteredStudents = data.students.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return s.roll_no.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
      {/* HEADER */}
      <header className="archival-header">
        <span className="sf brand">Teacher Register</span>
        <button className="lk" onClick={onBack}>Back to classrooms</button>
      </header>

      {/* REGISTER PAD */}
      <section className="pad flex-1">
        {/* TITLE & DATE PAGER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="lb">Classroom register</span>
            <h1 style={{ fontSize: '40px' }}>{data.classroom.name}</h1>
            <span className="mu mono" style={{ fontSize: '13px' }}>
              Room {data.classroom.room_id} &nbsp; Password {data.classroom.room_password} &nbsp;
              <button className="lk lk-sm" onClick={copyInvite} style={{ fontSize: '12px' }}>
                {copiedInvite ? 'Copied' : 'Copy invite'}
              </button>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="lk" onClick={() => shiftDate(-1)}>Previous</button>
            <span className="mono" style={{ fontSize: '15px' }}>{formatDateDisplay(selectedDate)}</span>
            <button className="lk" onClick={() => shiftDate(1)}>Next</button>
            {selectedDate !== getTodayDate() && (
              <button className="lk lk-sm mu" onClick={() => setSelectedDate(getTodayDate())}>
                Jump to today
              </button>
            )}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bar">
          <label style={{ flex: 1, margin: 0, minWidth: '220px' }}>
            <span className="lb" style={{ position: 'absolute', left: '-9999px' }}>Filter</span>
            <input
              id="flt"
              placeholder="Filter by roll number or name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="archival-input"
              style={{ border: 0, padding: '12px 0' }}
            />
          </label>

          <button className="lk" onClick={() => setActivePanel(activePanel === 'csv' ? null : 'csv')}>
            Import CSV
          </button>
          <button className="lk" onClick={() => setActivePanel(activePanel === 'add_student' ? null : 'add_student')}>
            Add student
          </button>
          <button className="lk" onClick={() => setActivePanel(activePanel === 'add_column' ? null : 'add_column')}>
            Add column
          </button>
          <button className="lk" onClick={handleMarkAllPresent}>
            Mark all present
          </button>
          <button className="btn" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>

        {/* INLINE PANELS FOR ACTIONS */}
        {activePanel === 'add_student' && (
          <div style={{ border: '1px solid var(--ink)', padding: '20px 24px', margin: '16px 0', backgroundColor: '#EDE8DE' }}>
            <span className="lb">Add individual student</span>
            <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginTop: '12px', flexWrap: 'wrap' }}>
              <label style={{ margin: 0, minWidth: '120px' }}>
                <span className="lb">Roll No</span>
                <input
                  className="archival-input"
                  placeholder="e.g. 21"
                  value={newRollNo}
                  onChange={(e) => setNewRollNo(e.target.value)}
                  required
                />
              </label>
              <label style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                <span className="lb">Student Name</span>
                <input
                  className="archival-input"
                  placeholder="e.g. Simran Kaur"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="btn btn-sm" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save student'}
              </button>
              <button type="button" className="lk lk-sm" onClick={() => setActivePanel(null)}>Cancel</button>
            </form>
          </div>
        )}

        {activePanel === 'add_column' && (
          <div style={{ border: '1px solid var(--ink)', padding: '20px 24px', margin: '16px 0', backgroundColor: '#EDE8DE' }}>
            <span className="lb">Add continuous assessment column</span>
            <form onSubmit={handleAddColumn} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginTop: '12px', flexWrap: 'wrap' }}>
              <label style={{ margin: 0, flex: 1, minWidth: '240px' }}>
                <span className="lb">Column Title</span>
                <input
                  className="archival-input"
                  placeholder="e.g. Assignment 2, Quiz 1, Midterm"
                  value={newColTitle}
                  onChange={(e) => setNewColTitle(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="btn btn-sm" disabled={actionLoading}>
                {actionLoading ? 'Creating...' : 'Create column'}
              </button>
              <button type="button" className="lk lk-sm" onClick={() => setActivePanel(null)}>Cancel</button>
            </form>
          </div>
        )}

        {activePanel === 'csv' && (
          <div style={{ border: '1px solid var(--ink)', padding: '20px 24px', margin: '16px 0', backgroundColor: '#EDE8DE' }}>
            <span className="lb">Import student roster from CSV</span>
            {csvError && (
              <div style={{ padding: '8px 12px', border: '1px solid var(--no)', color: 'var(--no)', margin: '10px 0', fontSize: '13px' }}>
                {csvError}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <textarea
                rows="5"
                className="archival-input"
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', border: '1px solid var(--rule)', padding: '8px', background: 'transparent' }}
                placeholder="Roll No,Name&#10;1,Aarav Patel&#10;2,Aditi Sharma&#10;3,Ananya Gupta"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setCsvText(ev.target.result);
                      reader.readAsText(file);
                    }
                  }}
                  style={{ fontSize: '12px' }}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-sm" onClick={handleProcessCsv} disabled={actionLoading}>
                    {actionLoading ? 'Importing...' : 'Confirm import'}
                  </button>
                  <button type="button" className="lk lk-sm" onClick={() => setActivePanel(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REGISTER TABLE */}
        <div className="scroll">
          <table className="archival-table" style={{ marginTop: '8px' }}>
            <thead>
              <tr>
                <th style={{ width: '64px' }}>Roll</th>
                <th>Student name</th>
                <th style={{ width: '150px' }}>{selectedDate === getTodayDate() ? 'Today' : formatDateDisplay(selectedDate)}</th>
                {data.customColumns.map((col) => (
                  <th key={col.id} style={{ width: '140px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{col.title}</span>
                      <button
                        className="lk lk-sm"
                        style={{ color: 'var(--no)', fontSize: '11px', minHeight: 'auto', border: 0 }}
                        onClick={() => handleDeleteColumn(col.id, col.title)}
                        title="Delete column"
                      >
                        [x]
                      </button>
                    </div>
                  </th>
                ))}
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4 + data.customColumns.length} className="mu" style={{ textAlign: 'center', height: '100px' }}>
                    {data.students.length === 0 
                      ? 'No students enrolled. Click "Import CSV" or "Add student" above to populate the ledger.'
                      : `No students match filter "${searchTerm}".`}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const status = getAttendanceStatus(s.id, selectedDate);
                  const isP = status === 'PRESENT';
                  const isA = status === 'ABSENT';
                  const isL = status === 'LATE';

                  return (
                    <tr key={s.id}>
                      <td className="mono" style={{ width: '64px' }}>
                        {s.roll_no}
                      </td>

                      <td>
                        <span style={{ fontWeight: 500 }}>{s.name}</span>
                      </td>

                      {/* MECHANICAL P / A / L STATUS BUTTONS */}
                      <td style={{ width: '150px' }}>
                        <button
                          type="button"
                          className={`m ${isP ? 'p' : ''}`}
                          aria-label="Present"
                          onClick={() => handleMarkAttendance(s.id, 'p')}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          className={`m ${isA ? 'a' : ''}`}
                          aria-label="Absent"
                          onClick={() => handleMarkAttendance(s.id, 'a')}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          className={`m ${isL ? 'l' : ''}`}
                          aria-label="Late"
                          onClick={() => handleMarkAttendance(s.id, 'l')}
                        >
                          L
                        </button>
                      </td>

                      {/* DYNAMIC EVALUATION COLUMNS */}
                      {data.customColumns.map((col) => {
                        const cellKey = `${s.id}_${col.id}`;
                        const isEditing = editingCell === cellKey;
                        const markVal = getStudentMark(s.id, col.id);

                        return (
                          <td key={col.id} className="mono" style={{ width: '140px' }}>
                            {isEditing ? (
                              <input
                                autoFocus
                                type="text"
                                className="archival-input"
                                style={{ padding: '2px 0', fontSize: '13px' }}
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={() => {
                                  handleSaveMark(s.id, col.id, editingValue);
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveMark(s.id, col.id, editingValue);
                                    setEditingCell(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => {
                                  setEditingCell(cellKey);
                                  setEditingValue(markVal);
                                }}
                                style={{
                                  display: 'inline-block',
                                  width: '100%',
                                  cursor: 'text',
                                  minHeight: '24px',
                                  color: markVal ? 'var(--ink)' : 'var(--mu)',
                                }}
                                title="Click to enter mark"
                              >
                                {markVal || '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* REMOVE STUDENT */}
                      <td style={{ width: '60px', textAlign: 'right' }}>
                        <button
                          className="lk lk-sm mu"
                          style={{ fontSize: '12px', color: 'var(--mu)' }}
                          onClick={() => handleDeleteStudent(s.id, s.name)}
                          title="Remove student"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mu" style={{ fontSize: '13px', margin: '16px 0 0' }}>
          Changes reach students as soon as you mark them.
        </p>
      </section>
    </div>
  );
}
