import React, { useState } from "react";
import { api } from "../api";

export default function TeacherAuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("ahmad.hasan@ietlucknow.ac.in");
  const [password, setPassword] = useState("teacher123");
  const [name, setName] = useState("Dr. Ahmad Hasan");
  const [title, setTitle] = useState("Prof.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.teacherAuth({
        email: email.trim(),
        password: password.trim(),
        name: name.trim(),
        title: title,
      });
      localStorage.setItem("tr_teacher_token", res.token);
      onLoginSuccess(res.teacher);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to login. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded border border-gray-400 max-w-sm w-full p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h3 className="text-sm font-bold text-gray-900">Teacher Login</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-2 text-xs bg-red-100 text-red-800 border border-red-300 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3 text-xs">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Email</label>
            <input
              type="email"
              required
              placeholder="e.g. faculty@ietlucknow.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Title</label>
              <select
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden bg-white"
              >
                <option value="Prof.">Prof.</option>
                <option value="Dr.">Dr.</option>
                <option value="Er.">Er.</option>
                <option value="Mr.">Mr.</option>
                <option value="Ms.">Ms.</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-gray-700 font-medium mb-1">Name</label>
              <input
                type="text"
                required
                placeholder="Faculty Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
