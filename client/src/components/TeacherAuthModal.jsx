import React, { useState } from "react";
import { api } from "../api";

export default function TeacherAuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [mode, setMode] = useState("login"); // 'login' or 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Prof.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function fillDemoAccount() {
    setEmail("ahmad.hasan@ietlucknow.ac.in");
    setPassword("teacher123");
    setName("Dr. Ahmad Hasan");
    setTitle("Prof.");
    setMode("login");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let res;
      if (mode === "register") {
        if (!name.trim()) {
          setError("Full name is required to register.");
          setLoading(false);
          return;
        }
        res = await api.teacherRegister(email.trim(), password.trim(), name.trim(), title);
      } else {
        res = await api.teacherLogin(email.trim(), password.trim());
      }

      localStorage.setItem("tr_teacher_token", res.token);
      onLoginSuccess(res.teacher);
      onClose();
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded border border-gray-400 max-w-sm w-full p-5 space-y-4 shadow-md">
        {/* Header & Close */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <div className="flex space-x-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`pb-1 border-b-2 transition ${
                mode === "login"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-black"
              }`}
            >
              Teacher Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`pb-1 border-b-2 transition ${
                mode === "register"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-black"
              }`}
            >
              New Registration
            </button>
          </div>

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

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {mode === "register" && (
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
                <label className="block text-gray-700 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anant Shukla"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-gray-700 font-medium mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="e.g. anantshukla836@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1">
              {mode === "register" ? "Create Password" : "Password"}
            </label>
            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
            >
              {loading
                ? mode === "register"
                  ? "Creating Account..."
                  : "Logging in..."
                : mode === "register"
                ? "Register & Sign In"
                : "Login"}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            {mode === "login" ? (
              <span>
                New teacher?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Register here
                </button>
              </span>
            ) : (
              <span>
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Login here
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={fillDemoAccount}
              className="text-gray-400 hover:text-gray-700 underline"
            >
              Fill Demo Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
