import React, { useState, useEffect, useMemo } from "react";
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
  const [studentMode, setStudentMode] = useState("csv");
  const [singleRoll, setSingleRoll] = useState("");
  const [singleName, setSingleName] = useState("");
  const [csvContent, setCsvContent] = useState("");

  const [copiedCredentials, setCopiedCredentials] = useState(false);

  useEffect(() => {
    loadRegister();

    socket.emit("join_teacher_channel", { room_id: roomId });

    socket.on("live_update", () => {
      // Background sync if needed
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
        setActiveSessionId(res.sessions[res.sessions.length - 1].id);
      }
    } catch (err) {
      setError(err.message || "Failed to load classroom register");
    } finally {
      setLoading(false);
    }
  }

  // Attendance Toggle: P -> A -> L -> P
  async function handleCycleAttendance(sessionId, studentId, currentStatus) {
    let nextStatus = "P";
    if (currentStatus === "P") nextStatus = "A";
    else if (currentStatus === "A") nextStatus = "L";
    else if (currentStatus === "L") nextStatus = "P";

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
      const res = await api.getClassroomRegister(roomId);
      setData(res);
    } catch (err) {
      alert("Failed to update attendance: " + err.message);
      loadRegister();
    }
  }

  // Mark all present for session
  async function handleMarkAllPresent(sessionId) {
    if (!sessionId || !data?.students) return;

    const records = data.students.map((st) => ({
      student_id: st.id,
      status: "P",
    }));

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

  async function handleDeleteSession(sessionId) {
    if (!window.confirm("Delete this lecture session?")) return;
    try {
      await api.deleteSession(roomId, sessionId);
      await loadRegister();
    } catch (err) {
      alert(err.message || "Could not delete session");
    }
  }

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

  async function handleDeleteColumn(columnId) {
    if (!window.confirm("Delete this evaluation column?")) return;
    try {
      await api.deleteEvaluationColumn(roomId, columnId);
      await loadRegister();
    } catch (err) {
      alert(err.message || "Could not delete column");
    }
  }

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

  async function handleAddStudentsSubmit(e) {
    e.preventDefault();
    let studentList = [];

    if (studentMode === "manual") {
      if (!singleRoll.trim() || !singleName.trim()) return;
      studentList.push({ roll_no: singleRoll.trim(), name: singleName.trim() });
    } else {
      const lines = csvContent.trim().split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          if (i === 0 && (parts[0].toLowerCase().includes("roll") || parts[1].toLowerCase().includes("name"))) {
            continue;
          }
          studentList.push({ roll_no: parts[0], name: parts[1] });
        }
      }
    }

    if (studentList.length === 0) {
      alert("No valid student records found.");
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

  function handleCsvFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result);
    };
    reader.readAsText(file);
  }

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
    const text = `Room ID: ${data.classroom.room_id} | Password: ${data.classroom.room_password}`;
    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2000);
  }

  if (loading) {
    return <div className="p-8 text-center text-xs text-gray-500">Loading register...</div>;
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-8 p-4 bg-red-50 border border-red-300 rounded text-center text-xs">
        <p className="text-red-700 mb-2">{error || "Classroom not found"}</p>
        <button onClick={onBack} className="px-3 py-1 bg-gray-800 text-white rounded">
          Back
        </button>
      </div>
    );
  }

  const { classroom, sessions, attendance, evaluations, scores, student_stats } = data;

  return (
    <div className="max-w-[98%] mx-auto py-6 space-y-4">
      {/* Top Header */}
      <div className="bg-white border border-gray-300 p-4 rounded flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="px-2.5 py-1 text-xs border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900">
              {classroom.room_name} ({classroom.room_id})
            </h1>
            <p className="text-xs text-gray-600">
              Instructor: {classroom.teacher_title} {classroom.teacher_name} | Password: {classroom.room_password}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={copyStudentCredentials}
            className="px-3 py-1.5 border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded text-gray-700"
          >
            {copiedCredentials ? "Copied!" : "Copy Room Login"}
          </button>

          <button
            onClick={() => setIsAddStudentOpen(true)}
            className="px-3 py-1.5 border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded text-gray-700"
          >
            Import Roster
          </button>

          <button
            onClick={() => setIsAddColumnOpen(true)}
            className="px-3 py-1.5 border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded text-gray-700"
          >
            + Add Marks Column
          </button>

          <button
            onClick={() => setIsAddSessionOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded"
          >
            + Add Lecture Date
          </button>

          <a
            href={api.getExportUrl(roomId)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gray-800 hover:bg-black text-white font-medium rounded"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Control Strip */}
      <div className="bg-white border border-gray-300 p-3 rounded flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <input
            type="text"
            placeholder="Search roll no or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded px-2.5 py-1 text-xs w-60"
          />
          <span className="ml-3 text-gray-600">
            Total Students: <b>{filteredStudents.length}</b>
          </span>
        </div>

        {sessions.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Active Lecture:</span>
            <select
              value={activeSessionId || ""}
              onChange={(e) => setActiveSessionId(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.session_date} ({s.title})
                </option>
              ))}
            </select>

            <button
              onClick={() => handleMarkAllPresent(activeSessionId)}
              className="px-2.5 py-1 bg-green-700 hover:bg-green-800 text-white font-medium rounded"
            >
              Mark All Present
            </button>
          </div>
        )}
      </div>

      {/* Register Table */}
      <div className="bg-white border border-gray-300 rounded overflow-x-auto max-h-[70vh]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-800 border-b border-gray-300 sticky top-0 z-20">
              <th className="p-2 border-r border-gray-300 text-center w-10">#</th>
              <th className="p-2 border-r border-gray-300 min-w-[120px]">Roll No</th>
              <th className="p-2 border-r-2 border-gray-400 min-w-[160px]">Student Name</th>

              {/* Attendance Dates */}
              {sessions.map((s) => (
                <th key={s.id} className="p-1.5 border-r border-gray-300 text-center min-w-[85px] bg-gray-50">
                  <div className="font-bold">{s.session_date}</div>
                  <div className="text-[10px] text-gray-500 font-normal truncate max-w-[80px] mx-auto">
                    {s.title}
                  </div>
                  <button
                    onClick={() => handleDeleteSession(s.id)}
                    className="text-gray-400 hover:text-red-600 text-[10px]"
                    title="Delete session"
                  >
                    ×
                  </button>
                </th>
              ))}

              {/* Attendance Metrics */}
              <th className="p-2 border-r border-gray-300 text-center min-w-[70px]">Attended</th>
              <th className="p-2 border-r border-gray-300 text-center min-w-[80px]">Attendance %</th>

              {/* Assessment Columns */}
              {evaluations.map((ev) => (
                <th key={ev.id} className="p-2 border-r border-gray-300 text-center min-w-[95px] bg-blue-50/50">
                  <div className="font-bold truncate">{ev.name}</div>
                  <div className="text-[10px] text-blue-800 font-normal">Max: {ev.max_marks}</div>
                  <button
                    onClick={() => handleDeleteColumn(ev.id)}
                    className="text-gray-400 hover:text-red-600 text-[10px]"
                    title="Delete column"
                  >
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {filteredStudents.length === 0 ? (
              <tr>
                <td
                  colSpan={5 + sessions.length + evaluations.length}
                  className="p-8 text-center text-gray-500"
                >
                  No students in this classroom. Click "Import Roster" to add students.
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
                  <tr key={st.id} className="hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-300 text-center text-gray-500 font-mono">
                      {idx + 1}
                    </td>
                    <td className="p-2 border-r border-gray-300 font-mono font-medium text-gray-900">
                      {st.roll_no}
                    </td>
                    <td className="p-2 border-r-2 border-gray-400 font-medium text-gray-900">
                      {st.name}
                    </td>

                    {/* Attendance stamps */}
                    {sessions.map((s) => {
                      const status = attendance[s.id]?.[st.id] || "-";

                      let btnStyle = "bg-gray-100 text-gray-400 border border-gray-300";
                      if (status === "P") btnStyle = "bg-green-600 text-white font-bold";
                      else if (status === "A") btnStyle = "bg-red-600 text-white font-bold";
                      else if (status === "L") btnStyle = "bg-amber-600 text-white font-bold";

                      return (
                        <td key={s.id} className="p-1 border-r border-gray-300 text-center">
                          <button
                            onClick={() => handleCycleAttendance(s.id, st.id, status)}
                            className={`w-6 h-6 rounded text-xs inline-flex items-center justify-center cursor-pointer ${btnStyle}`}
                            title="Click to cycle P / A / L"
                          >
                            {status === "-" ? "·" : status}
                          </button>
                        </td>
                      );
                    })}

                    {/* Attended / Total */}
                    <td className="p-2 border-r border-gray-300 text-center font-medium">
                      {stats.attended_count} / {sessions.length}
                    </td>

                    {/* Percentage */}
                    <td className="p-2 border-r border-gray-300 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          stats.is_compliant
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {stats.percentage}%
                      </span>
                    </td>

                    {/* Scores */}
                    {evaluations.map((ev) => {
                      const score = scores[ev.id]?.[st.id] ?? "";
                      return (
                        <td key={ev.id} className="p-1 border-r border-gray-300 text-center">
                          <input
                            type="number"
                            min="0"
                            max={ev.max_marks}
                            step="0.5"
                            value={score}
                            placeholder="0"
                            onChange={(e) => handleScoreChange(ev.id, st.id, e.target.value)}
                            className="w-14 text-center border border-gray-300 rounded p-1 text-xs"
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

      {/* Simple Legend */}
      <div className="text-[11px] text-gray-600 bg-gray-50 border border-gray-300 p-2 rounded flex items-center justify-between">
        <div>
          <b>Legend:</b> <span className="text-green-700 font-bold">P</span> = Present,{" "}
          <span className="text-red-700 font-bold">A</span> = Absent,{" "}
          <span className="text-amber-700 font-bold">L</span> = Late. Click cell to cycle status.
        </div>
        <div>Compliant threshold: 75%</div>
      </div>

      {/* MODAL 1: Add Session */}
      {isAddSessionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-400 max-w-xs w-full p-4 space-y-3 shadow-md text-xs">
            <h3 className="font-bold text-gray-900">Add Lecture Date</h3>
            <form onSubmit={handleCreateSession} className="space-y-2">
              <div>
                <label className="block text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Lecture 4"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSessionOpen(false)}
                  className="flex-1 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1 bg-blue-600 text-white rounded font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Evaluation Column */}
      {isAddColumnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-400 max-w-xs w-full p-4 space-y-3 shadow-md text-xs">
            <h3 className="font-bold text-gray-900">Add Assessment Column</h3>
            <form onSubmit={handleAddColumn} className="space-y-2">
              <div>
                <label className="block text-gray-700 mb-1">Column Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assignment 1 or Midterm"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Max Marks</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newColMaxMarks}
                  onChange={(e) => setNewColMaxMarks(e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddColumnOpen(false)}
                  className="flex-1 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1 bg-blue-600 text-white rounded font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Import Students */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-400 max-w-sm w-full p-4 space-y-3 shadow-md text-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h3 className="font-bold text-gray-900">Import Students</h3>
              <div className="space-x-1">
                <button
                  type="button"
                  onClick={() => setStudentMode("csv")}
                  className={`px-2 py-0.5 rounded border ${studentMode === "csv" ? "bg-gray-200 font-bold" : "border-gray-300"}`}
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => setStudentMode("manual")}
                  className={`px-2 py-0.5 rounded border ${studentMode === "manual" ? "bg-gray-200 font-bold" : "border-gray-300"}`}
                >
                  Single
                </button>
              </div>
            </div>

            <form onSubmit={handleAddStudentsSubmit} className="space-y-2">
              {studentMode === "manual" ? (
                <>
                  <div>
                    <label className="block text-gray-700 mb-1">Roll Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2500520100112"
                      value={singleRoll}
                      onChange={(e) => setSingleRoll(e.target.value)}
                      className="w-full border border-gray-300 rounded p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1">Student Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anant Shukla"
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      className="w-full border border-gray-300 rounded p-1.5"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-700 mb-1">Upload CSV</label>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileUpload}
                      className="w-full border border-gray-300 rounded p-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1">Or Paste CSV (Roll No, Name)</label>
                    <textarea
                      rows={4}
                      placeholder={`Roll No,Name\n2500520100112,Anant Shukla\n2500520100131,Harsh Vardhan Singh`}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      className="w-full border border-gray-300 rounded p-1.5 font-mono text-xs"
                    />
                  </div>
                </>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="flex-1 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1 bg-blue-600 text-white rounded font-medium"
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
