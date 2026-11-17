import React, { useState, useEffect } from "react";
import { api } from "../api";
import { socket } from "../socket";

export default function StudentPortal() {
  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [studentSession, setStudentSession] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("tr_student_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStudentSession(parsed);
        fetchDashboard(parsed.room_id, parsed.student.roll_no);
      } catch (e) {
        sessionStorage.removeItem("tr_student_session");
      }
    }
  }, []);

  useEffect(() => {
    if (!studentSession) return;

    const rId = studentSession.room_id;
    const rNo = studentSession.student.roll_no;

    socket.emit("join_student_channel", { room_id: rId, roll_no: rNo });

    function handleLiveUpdate() {
      fetchDashboard(rId, rNo);
    }

    socket.on("live_update", handleLiveUpdate);

    return () => {
      socket.off("live_update", handleLiveUpdate);
    };
  }, [studentSession]);

  async function fetchDashboard(rId, rNo) {
    try {
      const data = await api.getStudentDashboard(rId, rNo);
      setDashboardData(data);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!roomId.trim() || !roomPassword.trim() || !rollNo.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await api.studentLogin(roomId.trim(), roomPassword.trim(), rollNo.trim());
      setStudentSession(res);
      sessionStorage.setItem("tr_student_session", JSON.stringify(res));
      await fetchDashboard(res.room_id, res.student.roll_no);
    } catch (err) {
      setError(err.message || "Invalid Room ID, Password, or Roll Number.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setStudentSession(null);
    setDashboardData(null);
    sessionStorage.removeItem("tr_student_session");
  }

  // --- LOGIN SCREEN ---
  if (!studentSession) {
    return (
      <div className="max-w-sm mx-auto py-12 px-4">
        <div className="bg-white border border-gray-300 p-6 rounded shadow-xs space-y-4">
          <div className="border-b border-gray-200 pb-3">
            <h2 className="text-base font-bold text-gray-900">Student Portal</h2>
            <p className="text-xs text-gray-600 mt-1">
              Enter Room ID, Password, and your Roll Number.
            </p>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3 text-xs">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Room ID</label>
              <input
                type="text"
                required
                placeholder="e.g. CSE-3A"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full uppercase font-mono border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">Room Password</label>
              <input
                type="password"
                required
                placeholder="Classroom password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">Roll Number</label>
              <input
                type="text"
                required
                placeholder="e.g. 2500520100112"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className="w-full font-mono border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition mt-1"
            >
              {loading ? "Checking..." : "View Attendance & Marks"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  const stats = dashboardData?.stats;
  const isCompliant = stats?.is_compliant ?? true;
  const history = dashboardData?.history || [];
  const evaluations = dashboardData?.evaluations || [];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-5 text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-gray-300 p-4 rounded flex items-center justify-between">
        <div>
          <div className="text-gray-500 text-[11px]">
            {studentSession.room_id} • {dashboardData?.classroom_name}
          </div>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">
            {studentSession.student.name}
          </h1>
          <div className="text-gray-600 mt-0.5">
            Roll No: <span className="font-mono font-medium text-gray-800">{studentSession.student.roll_no}</span> | Faculty: {dashboardData?.teacher_name}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-3 py-1.5 border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded text-gray-700 font-medium"
        >
          Logout
        </button>
      </div>

      {/* Attendance Summary Box */}
      <div
        className={`border p-4 rounded ${
          isCompliant ? "bg-green-50 border-green-300 text-green-900" : "bg-red-50 border-red-300 text-red-900"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-sm">
              {isCompliant ? "Status: Compliant (Eligible for Examinations)" : "Status: Shortage Alert (Below 75%)"}
            </span>
            <p className="text-[11px] mt-0.5 text-gray-700">
              {isCompliant
                ? "Attendance meets the mandatory 75% university requirement."
                : "Attendance is below 75%. Please attend upcoming classes."}
            </p>
          </div>
          <div className="text-2xl font-bold font-mono">
            {stats?.percentage}%
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-200/60 text-center text-gray-800">
          <div>
            <div className="text-[11px] text-gray-500">Total Lectures</div>
            <div className="font-bold font-mono text-sm">{stats?.total_sessions ?? 0}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">Present (P)</div>
            <div className="font-bold font-mono text-sm text-green-700">{stats?.present_count ?? 0}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">Late (L)</div>
            <div className="font-bold font-mono text-sm text-amber-700">{stats?.late_count ?? 0}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">Absent (A)</div>
            <div className="font-bold font-mono text-sm text-red-700">{stats?.absent_count ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Internal Assessment Marks Table */}
      {evaluations.length > 0 && (
        <div className="bg-white border border-gray-300 rounded p-4 space-y-2">
          <h3 className="font-bold text-gray-900 text-sm">Continuous Assessment Marks</h3>
          <table className="w-full text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-gray-700 border-b border-gray-200">
                <th className="p-2 border-r border-gray-200">Component</th>
                <th className="p-2 border-r border-gray-200 text-center">Marks Obtained</th>
                <th className="p-2 border-r border-gray-200 text-center">Max Marks</th>
                <th className="p-2 text-right">Score %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {evaluations.map((ev) => {
                const score = ev.score || 0;
                const pct = ev.max_marks > 0 ? ((score / ev.max_marks) * 100).toFixed(1) : 0;
                return (
                  <tr key={ev.column_id} className="hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 font-medium">{ev.name}</td>
                    <td className="p-2 border-r border-gray-200 text-center font-mono font-bold">{score}</td>
                    <td className="p-2 border-r border-gray-200 text-center font-mono text-gray-600">{ev.max_marks}</td>
                    <td className="p-2 text-right font-medium text-blue-700">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Attendance History */}
      <div className="bg-white border border-gray-300 rounded p-4 space-y-2">
        <h3 className="font-bold text-gray-900 text-sm">Attendance History</h3>
        {history.length === 0 ? (
          <p className="text-gray-500 py-4 text-center">No lecture sessions recorded yet.</p>
        ) : (
          <table className="w-full text-left border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-gray-700 border-b border-gray-200">
                <th className="p-2 border-r border-gray-200">Date</th>
                <th className="p-2 border-r border-gray-200">Lecture Topic</th>
                <th className="p-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map((h) => {
                let badge = <span className="text-gray-500">Unmarked</span>;
                if (h.status === "P") badge = <span className="font-bold text-green-700">Present</span>;
                else if (h.status === "A") badge = <span className="font-bold text-red-700">Absent</span>;
                else if (h.status === "L") badge = <span className="font-bold text-amber-700">Late</span>;

                return (
                  <tr key={h.session_id} className="hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 font-mono">{h.session_date}</td>
                    <td className="p-2 border-r border-gray-200 text-gray-700">{h.title}</td>
                    <td className="p-2 text-right">{badge}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
