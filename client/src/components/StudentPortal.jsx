import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Key,
  Hash,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Award,
  Radio,
  LogOut,
  Clock,
  ArrowRight
} from "lucide-react";
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
  const [liveFlash, setLiveFlash] = useState(false);

  // Restore saved session from session storage if present
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

  // Socket.IO Subscription for Live Updates
  useEffect(() => {
    if (!studentSession) return;

    const rId = studentSession.room_id;
    const rNo = studentSession.student.roll_no;

    // Join private student channel
    socket.emit("join_student_channel", { room_id: rId, roll_no: rNo });

    function handleLiveUpdate(payload) {
      console.log("Real-time live update received:", payload);
      // Flash indicator to show student the live pulse
      setLiveFlash(true);
      setTimeout(() => setLiveFlash(false), 2000);

      // Refresh student dashboard data
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
      console.error("Dashboard refresh error:", err);
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
      setError(err.message || "Failed to enter classroom. Check your Room ID, Password, and Roll Number.");
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
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-stone-900">Student Portal</h2>
            <p className="text-xs text-stone-500 mt-1">
              Enter Room credentials provided by your instructor to view your live attendance and internal marks.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Room ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE-3A"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="w-full text-xs font-mono uppercase bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Room Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Classroom password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Your Roll Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. 2500520100112"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  className="w-full text-xs font-mono bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                * Zero sign-up required. Your roll number provides instant access to your records.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-stone-900 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2 mt-2"
            >
              <span>{loading ? "Verifying..." : "View My Attendance & Marks"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-center space-x-2 text-[11px] text-stone-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Channel-Scoped Privacy • Rate-Limited Authentication</span>
          </div>
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
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Student Banner */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-stone-100 text-stone-800 rounded border border-stone-200">
              {studentSession.room_id}
            </span>
            <span className="text-xs text-stone-500 font-medium">
              {dashboardData?.classroom_name}
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-stone-900 mt-1">
            {studentSession.student.name}
          </h1>

          <div className="flex items-center space-x-3 text-xs text-stone-500 mt-1">
            <span>Roll No: <b className="font-mono text-stone-800">{studentSession.student.roll_no}</b></span>
            <span>•</span>
            <span>Instructor: <b className="text-stone-800">{dashboardData?.teacher_name}</b></span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Live Sync Status Indicator */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              liveFlash
                ? "bg-amber-100 text-amber-800 border-amber-300 scale-105"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>{liveFlash ? "Syncing..." : "Live Active"}</span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition border border-stone-200"
            title="Leave Classroom"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 75% Compliance Notification Banner */}
      <div
        className={`rounded-2xl p-5 border shadow-xs flex items-start space-x-3.5 transition-colors ${
          isCompliant
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
            : "bg-red-50/80 border-red-200 text-red-900"
        }`}
      >
        {isCompliant ? (
          <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold uppercase tracking-wide">
              {isCompliant ? "COMPLIANCE STATUS: ELIGIBLE" : "ATTENDANCE SHORTAGE WARNING"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isCompliant ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {stats?.percentage}%
            </span>
          </div>
          <p className="text-xs mt-1 leading-relaxed opacity-90">
            {isCompliant
              ? "Your attendance is above the mandatory 75% threshold required by AKTU regulations. Keep it up!"
              : "Warning: Your current attendance is below the mandatory 75% threshold. Please attend upcoming lectures to avoid being debarred from semester examinations."}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-500">Total Lectures</span>
          <div className="text-2xl font-bold text-stone-900 mt-1 font-mono">
            {stats?.total_sessions ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs text-emerald-700 font-medium">Attended (P)</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
            {stats?.present_count ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs text-amber-700 font-medium">Late (L)</span>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">
            {stats?.late_count ?? 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-xs text-red-700 font-medium">Absent (A)</span>
          <div className="text-2xl font-bold text-red-700 mt-1 font-mono">
            {stats?.absent_count ?? 0}
          </div>
        </div>
      </div>

      {/* Continuous Assessment Marks Table */}
      {evaluations.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-stone-900">
              Continuous Assessment & Internal Marks
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                  <th className="p-3">Evaluation Component</th>
                  <th className="p-3 text-center">Marks Obtained</th>
                  <th className="p-3 text-center">Max Marks</th>
                  <th className="p-3 text-right">Score %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {evaluations.map((ev) => {
                  const score = ev.score || 0;
                  const pct = ev.max_marks > 0 ? ((score / ev.max_marks) * 100).toFixed(1) : 0;
                  return (
                    <tr key={ev.column_id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-medium text-stone-900">{ev.name}</td>
                      <td className="p-3 text-center font-bold font-mono text-stone-800">{score}</td>
                      <td className="p-3 text-center text-stone-500 font-mono">{ev.max_marks}</td>
                      <td className="p-3 text-right font-semibold text-blue-700">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session-Wise Attendance History */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-stone-700" />
          <h3 className="text-sm font-bold text-stone-900">Lecture Session History</h3>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-stone-400 py-6 text-center">
            No lecture sessions have been recorded by the instructor yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                  <th className="p-3">Session Date</th>
                  <th className="p-3">Topic / Title</th>
                  <th className="p-3 text-right">Your Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((h) => {
                  let badge = (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-stone-100 text-stone-600">
                      Unmarked
                    </span>
                  );
                  if (h.status === "P") {
                    badge = (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 text-white shadow-2xs">
                        Present
                      </span>
                    );
                  } else if (h.status === "A") {
                    badge = (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-600 text-white shadow-2xs">
                        Absent
                      </span>
                    );
                  } else if (h.status === "L") {
                    badge = (
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500 text-white shadow-2xs">
                        Late
                      </span>
                    );
                  }

                  return (
                    <tr key={h.session_id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-mono text-stone-800">{h.session_date}</td>
                      <td className="p-3 text-stone-600">{h.title}</td>
                      <td className="p-3 text-right">{badge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
