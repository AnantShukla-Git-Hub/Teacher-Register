import React, { useState, useEffect } from "react";
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
    if (!window.confirm(`Delete classroom ${rId}? All records will be removed.`)) {
      return;
    }
    try {
      await api.deleteClassroom(rId);
      await loadClassrooms();
    } catch (err) {
      alert(err.message || "Could not delete classroom");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-300 pb-4 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Instructor Dashboard</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Faculty: {teacher?.title} {teacher?.name} ({teacher?.email})
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition self-start sm:self-auto"
        >
          + Create New Classroom
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-800 border border-red-300 rounded text-xs">
          {error}
        </div>
      )}

      {/* Classrooms List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-xs">Loading classrooms...</div>
      ) : classrooms.length === 0 ? (
        <div className="border border-gray-300 bg-white p-8 text-center rounded text-xs text-gray-600 space-y-3">
          <p className="font-semibold text-gray-800">No classrooms created yet.</p>
          <p>Click the "Create New Classroom" button above to add your first room.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {classrooms.map((cls) => (
            <div
              key={cls.id}
              className="bg-white border border-gray-300 p-4 rounded flex flex-col justify-between space-y-3 hover:border-gray-400"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                    {cls.room_id}
                  </span>
                  <button
                    onClick={() => handleDeleteClassroom(cls.room_id)}
                    className="text-xs text-red-600 hover:text-red-800"
                    title="Delete Classroom"
                  >
                    Delete
                  </button>
                </div>

                <h3 className="font-semibold text-sm text-gray-900 pt-1">{cls.room_name}</h3>

                <div className="text-xs text-gray-600 pt-1 border-t border-gray-100 space-y-0.5">
                  <div>Password: <span className="font-mono text-gray-800">{cls.room_password}</span></div>
                  <div>Students: <span className="font-medium text-gray-800">{cls.student_count}</span> | Lectures: <span className="font-medium text-gray-800">{cls.session_count}</span></div>
                </div>
              </div>

              <button
                onClick={() => onSelectClassroom(cls.room_id)}
                className="w-full py-1.5 bg-gray-800 hover:bg-black text-white text-xs font-medium rounded transition"
              >
                Open Register Sheet
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Classroom Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-400 max-w-sm w-full p-5 space-y-4 shadow-md text-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h3 className="font-bold text-gray-900 text-sm">Create New Classroom</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-500 hover:text-black font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClassroom} className="space-y-3">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Classroom / Course Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Database Management Systems"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Room ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE-3A"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="w-full uppercase font-mono border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Room Password</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. iet123"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
                >
                  {creating ? "Creating..." : "Save Classroom"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
