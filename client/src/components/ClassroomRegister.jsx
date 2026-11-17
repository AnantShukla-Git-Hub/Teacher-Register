import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Download,
  Upload,
  UserPlus,
  Search,
  CheckCheck,
  Trash2,
  Calendar,
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Award
} from "lucide-react";
import { api } from "../api";
import { socket } from "../socket";

export default function ClassroomRegister({ roomId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Modals
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [newSessionTitle, setNewSessionTitle] = useState("Lecture");

  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColMaxMarks, setNewColMaxMarks] = useState("20");

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentMode, setStudentMode] = useState("csv"); // 'csv' or 'manual'
  const [singleRoll, setSingleRoll] = useState("");
  const [singleName, setSingleName] = useState("");
  const [csvContent, setCsvContent] = useState("");

  const [copiedCredentials, setCopiedCredentials] = useState(false);

  useEffect(() => {
    loadRegister();

    // Socket.IO Room Connection for Teacher
    socket.emit("join_teacher_channel", { room_id: roomId });

    socket.on("live_update", () => {
      // Background sync if any multi-device edits occur
    });

    return () => {
      socket.off("live_update");
    };
  }, [roomId]);

  async function loadRegister() {
    setLoading(true);
    setError("");
    try {
      const res = await api.getClassroomRegister(roomId);
      setData(res);
      if (res.sessions && res.sessions.length > 0) {
        // Set most recent session as active
        setActiveSessionId(res.sessions[res.sessions.length - 1].id);
      }
    } catch (err) {
      setError(err.message || "Failed to load classroom register");
    } finally {
      setLoading(false);
    }
  }

  // --- Attendance Cycle: P -> A -> L -> P ---
  async function handleCycleAttendance(sessionId, studentId, currentStatus) {
    let nextStatus = "P";
    if (currentStatus === "P") nextStatus = "A";
    else if (currentStatus === "A") nextStatus = "L";
    else if (currentStatus === "L") nextStatus = "P";

    // Optimistic UI update
    setData((prev) => {
      if (!prev) return prev;
      const updatedAtt = { ...prev.attendance };
      if (!updatedAtt[sessionId]) updatedAtt[sessionId] = {};
      updatedAtt[sessionId][studentId] = nextStatus;
      return { ...prev, attendance: updatedAtt };
    });

    try {
      await api.updateAttendance(roomId, sessionId, [
        { student_id: studentId, status: nextStatus },
      ]);
      // Silently refresh stats in background
      const res = await api.getClassroomRegister(roomId);
      setData(res);
    } catch (err) {
      alert("Failed to update attendance: " + err.message);
      loadRegister();
    }
  }

  // --- Mark All Present for active session ---
  async function handleMarkAllPresent(sessionId) {
    if (!sessionId || !data?.students) return;

    const records = data.students.map((st) => ({
      student_id: st.id,
      status: "P",
    }));

    // Optimistic UI update
    setData((prev) => {
      if (!prev) return prev;
      const updatedAtt = { ...prev.attendance };
      if (!updatedAtt[sessionId]) updatedAtt[sessionId] = {};
      records.forEach((r) => {
        updatedAtt[sessionId][r.student_id] = "P";
      });
      return { ...prev, attendance: updatedAtt };
    });

    try {
      await api.updateAttendance(roomId, sessionId, records);
      const res = await api.getClassroomRegister(roomId);
      setData(res);
    } catch (err) {
      alert("Failed to mark all present: " + err.message);
      loadRegister();
    }
  }

  // --- Add Session ---
  async function handleCreateSession(e) {
    e.preventDefault();
    try {
      await api.createSession(roomId, newSessionDate, newSessionTitle);
      setIsAddSessionOpen(false);
      await loadRegister();
    } catch (err) {
      alert(err.message || "Could not add session");
    }
  }

  // --- Delete Session ---
  async function handleDeleteSession(sessionId) {
    if (!window.confirm("Are you sure you want to delete this lecture session?")) return;
    try {
      await api.deleteSession(roomId, sessionId);
      await loadRegister();
    } catch (err) {
      alert(err.message || "Could not delete session");
    }
  }

  // --- Add Evaluation Column ---
  async function handleAddColumn(e) {
    e.preventDefault();
    if (!newColName.trim()) return;
    try {
      await api.addEvaluationColumn(roomId, newColName.trim(), parseFloat(newColMaxMarks) || 100);
      setIsAddColumnOpen(false);
      setNewColName("");
      setNewColMaxMarks("20");
      await loadRegister();
    } catch (err) {
      alert(err.message || "Could not add evaluation column");
    }
  }

  // --- Delete Evaluation Column ---
  async function handleDeleteColumn(columnId) {
    if (!window.confirm("Delete this evaluation column and all student marks in it?")) return;
    try {
      await api.deleteEvaluationColumn(roomId, columnId);
      await loadRegister();
    } catch (err) {
      alert(err.message || "Could not delete column");
    }
  }

  // --- Inline Score Update ---
  async function handleScoreChange(columnId, studentId, value) {
    const num = parseFloat(value) || 0;

    setData((prev) => {
      if (!prev) return prev;
      const updatedScores = { ...prev.scores };
      if (!updatedScores[columnId]) updatedScores[columnId] = {};
      updatedScores[columnId][studentId] = num;
      return { ...prev, scores: updatedScores };
    });

    try {
      await api.updateScore(roomId, columnId, studentId, num);
    } catch (err) {
      console.error("Score update error:", err);
    }
  }

  // --- Add Student / CSV Import ---
  async function handleAddStudentsSubmit(e) {
    e.preventDefault();
    let studentList = [];

    if (studentMode === "manual") {
      if (!singleRoll.trim() || !singleName.trim()) return;
      studentList.push({ roll_no: singleRoll.trim(), name: singleName.trim() });
    } else {
      // Parse CSV
      const lines = csvContent.trim().split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          // If first line has header "roll" or "name", skip it
          if (i === 0 && (parts[0].toLowerCase().includes("roll") || parts[1].toLowerCase().includes("name"))) {
            continue;
          }
          studentList.push({ roll_no: parts[0], name: parts[1] });
        }
      }
    }

    if (studentList.length === 0) {
      alert("No valid student records found to import.");
      return;
    }

    try {
      await api.addStudents(roomId, studentList);
      setIsAddStudentOpen(false);
      setSingleRoll("");
      setSingleName("");
      setCsvContent("");
      await loadRegister();
    } catch (err) {
      alert(err.message || "Could not import students");
    }
  }

  // CSV File Picker Helper
  function handleCsvFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result);
    };
    reader.readAsText(file);
  }

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    if (!searchQuery.trim()) return data.students;
    const q = searchQuery.toLowerCase().trim();
    return data.students.filter(
      (st) =>
        st.name.toLowerCase().includes(q) || st.roll_no.toLowerCase().includes(q)
    );
  }, [data?.students, searchQuery]);

  function copyStudentCredentials() {
    if (!data?.classroom) return;
    const text = `Join Teacher Register:\nRoom ID: ${data.classroom.room_id}\nRoom Password: ${data.classroom.room_password}\nLogin at: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-stone-500">
        Loading classroom register...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
        <p className="text-xs font-semibold text-red-700 mb-3">{error || "Classroom not found"}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold"
        >
          Back to Classrooms
        </button>
      </div>
    );
  }

  const { classroom, sessions, attendance, evaluations, scores, student_stats } = data;

  return (
    <div className="max-w-[98%] mx-auto py-6 space-y-4">
      {/* Top Ledger Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition border border-stone-200"
            title="Back to Classrooms"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">
                {classroom.room_name}
              </h1>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">
                {classroom.room_id}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Instructor: {classroom.teacher_title} {classroom.teacher_name} • Ruled Attendance & Assessment Register
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={copyStudentCredentials}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl border border-stone-200 transition flex items-center space-x-1.5"
            title="Copy credentials for students"
          >
            {copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCredentials ? "Copied!" : "Share Room Info"}</span>
          </button>

          <button
            onClick={() => setIsAddStudentOpen(true)}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl border border-stone-200 transition flex items-center space-x-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-stone-600" />
            <span>Import Roster</span>
          </button>

          <button
            onClick={() => setIsAddColumnOpen(true)}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl border border-stone-200 transition flex items-center space-x-1.5"
          >
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span>+ Evaluation Column</span>
          </button>

          <button
            onClick={() => setIsAddSessionOpen(true)}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Lecture Date</span>
          </button>

          <a
            href={api.getExportUrl(roomId)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Control Strip: Search & Batch Action */}
      <div className="bg-white rounded-xl p-3 border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by Roll No or Student Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2 text-stone-600">
            <span className="font-semibold text-stone-900">{filteredStudents.length}</span> students enrolled
          </div>

          {sessions.length > 0 && (
            <div className="flex items-center space-x-2 border-l border-stone-200 pl-3">
              <span className="text-[11px] text-stone-500 font-medium">Active Session:</span>
              <select
                value={activeSessionId || ""}
                onChange={(e) => setActiveSessionId(Number(e.target.value))}
                className="text-xs bg-stone-50 border border-stone-200 rounded-md px-2 py-1 focus:outline-hidden font-medium"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.session_date} ({s.title})
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleMarkAllPresent(activeSessionId)}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-xs font-semibold flex items-center space-x-1 transition"
                title="Mark all students present for selected session"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Mark All Present</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ruled Register Table Grid */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse register-grid">
            {/* Header Row */}
            <thead>
              <tr className="bg-stone-100 text-stone-700 text-xs font-semibold uppercase tracking-wider sticky top-0 z-20 shadow-2xs">
                <th className="p-3 w-12 text-center bg-stone-100 sticky left-0 z-30">#</th>
                <th className="p-3 min-w-[140px] bg-stone-100 sticky left-12 z-30">Roll No</th>
                <th className="p-3 min-w-[180px] bg-stone-100 sticky left-[188px] z-30 border-r-2 border-stone-300">
                  Student Name
                </th>

                {/* Attendance Date Columns */}
                {sessions.map((s) => (
                  <th key={s.id} className="p-2 min-w-[90px] text-center bg-emerald-50/50">
                    <div className="text-[11px] font-bold text-stone-800">{s.session_date}</div>
                    <div className="text-[9px] text-stone-500 font-normal truncate max-w-[80px] mx-auto">
                      {s.title}
                    </div>
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="text-stone-300 hover:text-red-500 text-[10px] mt-0.5 inline-block"
                      title="Delete this lecture session"
                    >
                      ×
                    </button>
                  </th>
                ))}

                {/* Summary Metrics */}
                <th className="p-2.5 min-w-[70px] text-center bg-stone-100">Attended</th>
                <th className="p-2.5 min-w-[90px] text-center bg-stone-100">Attendance %</th>

                {/* Continuous Assessment Columns */}
                {evaluations.map((ev) => (
                  <th key={ev.id} className="p-2.5 min-w-[110px] text-center bg-blue-50/60 border-l border-blue-200">
                    <div className="text-[11px] font-bold text-stone-800 truncate">{ev.name}</div>
                    <div className="text-[9px] text-blue-700 font-semibold">Max: {ev.max_marks}</div>
                    <button
                      onClick={() => handleDeleteColumn(ev.id)}
                      className="text-stone-300 hover:text-red-500 text-[10px] mt-0.5 inline-block"
                      title="Delete evaluation column"
                    >
                      ×
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Student Rows */}
            <tbody className="text-xs divide-y divide-stone-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + sessions.length + evaluations.length}
                    className="p-12 text-center text-stone-400"
                  >
                    No students found. Click "Import Roster" above to add students from CSV.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => {
                  const stats = student_stats[st.id] || {
                    attended_count: 0,
                    percentage: 100.0,
                    is_compliant: true,
                  };

                  return (
                    <tr key={st.id} className="hover:bg-stone-50/80 transition-colors">
                      {/* Index */}
                      <td className="p-2.5 text-center text-stone-400 bg-white sticky left-0 z-10 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Roll Number */}
                      <td className="p-2.5 font-mono font-medium text-stone-800 bg-white sticky left-12 z-10">
                        {st.roll_no}
                      </td>

                      {/* Student Name */}
                      <td className="p-2.5 font-medium text-stone-900 bg-white sticky left-[188px] z-10 border-r-2 border-stone-300">
                        {st.name}
                      </td>

                      {/* Session Attendance Stamps */}
                      {sessions.map((s) => {
                        const status = attendance[s.id]?.[st.id] || "-";

                        let badgeClass = "bg-stone-100 text-stone-400 border-stone-200";
                        if (status === "P") badgeClass = "bg-emerald-600 text-white border-emerald-700 font-bold shadow-2xs";
                        else if (status === "A") badgeClass = "bg-red-600 text-white border-red-700 font-bold shadow-2xs";
                        else if (status === "L") badgeClass = "bg-amber-500 text-white border-amber-600 font-bold shadow-2xs";

                        return (
                          <td key={s.id} className="p-1.5 text-center">
                            <button
                              onClick={() => handleCycleAttendance(s.id, st.id, status)}
                              title={`Click to toggle attendance for ${st.name} (P / A / L)`}
                              className={`w-7 h-7 rounded-md border text-[11px] transition-transform active:scale-95 inline-flex items-center justify-center cursor-pointer ${badgeClass}`}
                            >
                              {status === "-" ? "•" : status}
                            </button>
                          </td>
                        );
                      })}

                      {/* Summary Attended */}
                      <td className="p-2 text-center font-semibold text-stone-700">
                        {stats.attended_count} / {sessions.length}
                      </td>

                      {/* Summary Percentage & 75% Compliance */}
                      <td className="p-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            stats.is_compliant
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {stats.percentage}%
                        </span>
                      </td>

                      {/* Evaluation Scores (Inline Edit) */}
                      {evaluations.map((ev) => {
                        const score = scores[ev.id]?.[st.id] ?? "";

                        return (
                          <td key={ev.id} className="p-1.5 text-center border-l border-blue-100">
                            <input
                              type="number"
                              min="0"
                              max={ev.max_marks}
                              step="0.5"
                              value={score}
                              placeholder="0"
                              onChange={(e) => handleScoreChange(ev.id, st.id, e.target.value)}
                              className="w-16 text-center text-xs py-1 px-1.5 border border-stone-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between text-[11px] text-stone-500 gap-2">
          <div className="flex items-center space-x-4">
            <span className="font-semibold text-stone-700">Stamp Legend:</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-4 h-4 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-[9px]">
                P
              </span>
              <span>Present</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-4 h-4 rounded bg-red-600 text-white font-bold flex items-center justify-center text-[9px]">
                A
              </span>
              <span>Absent</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-4 h-4 rounded bg-amber-500 text-white font-bold flex items-center justify-center text-[9px]">
                L
              </span>
              <span>Late</span>
            </div>
          </div>
          <div className="text-[10px] text-stone-400">
            * Single-click any cell to cycle P → A → L. All edits sync live to connected students.
          </div>
        </div>
      </div>

      {/* MODAL 1: Add Session */}
      {isAddSessionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-stone-200 p-5 space-y-4">
            <h3 className="font-bold text-sm text-stone-900">Add Attendance Lecture Date</h3>
            <form onSubmit={handleCreateSession} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Session Date</label>
                <input
                  type="date"
                  required
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Title / Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Lecture 5: Query Optimization"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSessionOpen(false)}
                  className="flex-1 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-xs"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Evaluation Column */}
      {isAddColumnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-stone-200 p-5 space-y-4">
            <h3 className="font-bold text-sm text-stone-900">Add Continuous Assessment Column</h3>
            <form onSubmit={handleAddColumn} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Column Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assignment 1, Quiz, Midterm"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Maximum Marks</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="1000"
                  value={newColMaxMarks}
                  onChange={(e) => setNewColMaxMarks(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddColumnOpen(false)}
                  className="flex-1 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-xs"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Students (CSV / Manual) */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-stone-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Import Student Roster</h3>
              <div className="flex bg-stone-100 p-0.5 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setStudentMode("csv")}
                  className={`px-2.5 py-1 rounded-md transition ${studentMode === "csv" ? "bg-white text-stone-900 shadow-2xs font-semibold" : "text-stone-500"}`}
                >
                  CSV Upload
                </button>
                <button
                  type="button"
                  onClick={() => setStudentMode("manual")}
                  className={`px-2.5 py-1 rounded-md transition ${studentMode === "manual" ? "bg-white text-stone-900 shadow-2xs font-semibold" : "text-stone-500"}`}
                >
                  Single Add
                </button>
              </div>
            </div>

            <form onSubmit={handleAddStudentsSubmit} className="space-y-3">
              {studentMode === "manual" ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Roll Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2500520100112"
                      value={singleRoll}
                      onChange={(e) => setSingleRoll(e.target.value)}
                      className="w-full text-xs font-mono border border-stone-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Student Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anant Shukla"
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      className="w-full text-xs border border-stone-300 rounded-lg p-2"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Upload CSV File</label>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileUpload}
                      className="w-full text-xs text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Or Paste CSV Text (Roll No, Name)
                    </label>
                    <textarea
                      rows={5}
                      placeholder={`Roll No,Name\n2500520100112,Anant Shukla\n2500520100131,Harsh Vardhan Singh`}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      className="w-full text-xs font-mono border border-stone-300 rounded-lg p-2 leading-relaxed"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">
                      Supports up to 2,000 students. Format: Roll No, Name (one per line).
                    </p>
                  </div>
                </>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="flex-1 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs bg-stone-900 hover:bg-black text-white font-semibold rounded-lg shadow-xs"
                >
                  Save to Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
