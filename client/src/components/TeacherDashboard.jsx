import React, { useState, useEffect } from "react";
import { Plus, Users, Calendar, ArrowRight, Trash2, Copy, Check, Key, BookOpen, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../api";

export default function TeacherDashboard({ teacher, onSelectClassroom }) {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state
  const [roomId, setRoomId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadClassrooms();
  }, []);

  async function loadClassrooms() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getClassrooms();
      setClassrooms(data);
    } catch (err) {
      setError(err.message || "Failed to load classrooms");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClassroom(e) {
    e.preventDefault();
    if (!roomId.trim() || !roomName.trim() || !roomPassword.trim()) return;

    setCreating(true);
    setError("");
    try {
      await api.createClassroom(roomId.trim(), roomName.trim(), roomPassword.trim());
      setIsCreateModalOpen(false);
      setRoomId("");
      setRoomName("");
      setRoomPassword("");
      await loadClassrooms();
    } catch (err) {
      setError(err.message || "Could not create classroom");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteClassroom(rId) {
    if (!window.confirm(`Are you sure you want to delete classroom ${rId}? All attendance and marks records will be deleted.`)) {
      return;
    }
    try {
      await api.deleteClassroom(rId);
      await loadClassrooms();
    } catch (err) {
      alert(err.message || "Could not delete classroom");
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Dashboard Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            Instructor Portal
          </span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">
            Welcome, {teacher?.title} {teacher?.name}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage your courses, take classroom attendance, and grade continuous assessments.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadClassrooms}
            className="p-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition border border-stone-200"
            title="Refresh Classrooms"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Classroom</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Classrooms Grid */}
      {loading ? (
        <div className="text-center py-16 text-stone-400 text-xs">
          Loading your classrooms...
        </div>
      ) : classrooms.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-stone-200 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800 mb-1">No Classrooms Yet</h3>
          <p className="text-xs text-stone-500 mb-5 leading-relaxed">
            Create your first classroom room to import your student roster and open the attendance ledger.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition"
          >
            Create Classroom
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((cls) => (
            <div
              key={cls.id}
              className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-stone-100 text-stone-800 rounded-md border border-stone-200">
                    {cls.room_id}
                  </span>
                  <button
                    onClick={() => handleDeleteClassroom(cls.room_id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete Classroom"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-bold text-base text-stone-900 mb-1 leading-snug">
                  {cls.room_name}
                </h3>

                {/* Credentials reminder for students */}
                <div className="my-3 p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-[11px] text-stone-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-500">Room Password:</span>
                    <span className="font-mono font-semibold text-stone-800">{cls.room_password}</span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Room ID: ${cls.room_id} | Password: ${cls.room_password}`,
                        cls.room_id
                      )
                    }
                    className="w-full mt-1.5 pt-1 border-t border-stone-200 flex items-center justify-center space-x-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold"
                  >
                    {copiedId === cls.room_id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Credentials Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Login Info for Students</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-stone-500">
                  <div className="flex items-center space-x-1.5 bg-stone-50 p-2 rounded-lg border border-stone-150">
                    <Users className="w-3.5 h-3.5 text-stone-400" />
                    <span>{cls.student_count} Students</span>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-stone-50 p-2 rounded-lg border border-stone-150">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>{cls.session_count} Lectures</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => onSelectClassroom(cls.room_id)}
                className="mt-5 w-full py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center space-x-2"
              >
                <span>Open Register Sheet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Classroom Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Create New Classroom</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClassroom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Classroom / Course Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design & Analysis of Algorithms (CS-302)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Unique Room ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE-3A or DAA-2026"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="w-full text-xs font-mono uppercase border border-stone-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Students will use this Room ID to find your register.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Room Password
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. iet2026"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Prevents unauthorized students outside this section from entering.
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition shadow-xs"
                >
                  {creating ? "Creating..." : "Create Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
