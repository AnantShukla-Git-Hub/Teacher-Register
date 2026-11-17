import React, { useState } from "react";
import { api } from "../api";

export default function AuthPortal({ onTeacherLogin, onStudentLogin }) {
  const [activeRole, setActiveRole] = useState("teacher"); // 'teacher' | 'student'
  const [teacherMode, setTeacherMode] = useState("login"); // 'login' | 'register'

  // Teacher Form State
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherTitle, setTeacherTitle] = useState("Prof.");

  // Student Form State
  const [studentRoomId, setStudentRoomId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentRollNo, setStudentRollNo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle Teacher Login or Register
  async function handleTeacherSubmit(e) {
    e.preventDefault();
    if (!teacherEmail.trim() || !teacherPassword.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let res;
      if (teacherMode === "register") {
        if (!teacherName.trim()) {
          setError("Full name is required to create an account.");
          setLoading(false);
          return;
        }
        res = await api.teacherRegister(
          teacherEmail.trim(),
          teacherPassword.trim(),
          teacherName.trim(),
          teacherTitle
        );
      } else {
        res = await api.teacherLogin(teacherEmail.trim(), teacherPassword.trim());
      }

      onTeacherLogin(res.teacher, res.token);
    } catch (err) {
      setError(err.message || "Authentication failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Student Login
  async function handleStudentSubmit(e) {
    e.preventDefault();
    if (!studentRoomId.trim() || !studentPassword.trim() || !studentRollNo.trim()) {
      setError("Please fill in Room ID, Password, and your Roll Number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.studentLogin(
        studentRoomId.trim().toUpperCase(),
        studentPassword.trim(),
        studentRollNo.trim()
      );
      onStudentLogin(res);
    } catch (err) {
      setError(err.message || "Failed to enter classroom. Check your Room ID, Password, and Roll Number.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      {/* Branding Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Teacher Register</h1>
        <p className="text-xs text-gray-600 mt-1">
          Classroom Attendance & Continuous Assessment System
        </p>
      </div>

      <div className="bg-white border border-gray-300 rounded shadow-xs overflow-hidden">
        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 border-b border-gray-300 text-xs font-semibold text-center">
          <button
            type="button"
            onClick={() => {
              setActiveRole("teacher");
              setError("");
            }}
            className={`py-3 transition ${
              activeRole === "teacher"
                ? "bg-white text-blue-700 border-b-2 border-blue-600 font-bold"
                : "bg-gray-50 text-gray-600 hover:text-black border-b border-gray-300"
            }`}
          >
            Instructor Portal
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveRole("student");
              setError("");
            }}
            className={`py-3 transition ${
              activeRole === "student"
                ? "bg-white text-blue-700 border-b-2 border-blue-600 font-bold"
                : "bg-gray-50 text-gray-600 hover:text-black border-b border-gray-300"
            }`}
          >
            Student Access
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-2.5 bg-red-50 text-red-700 border border-red-300 rounded text-xs">
              {error}
            </div>
          )}

          {/* 1. TEACHER AUTH FORM */}
          {activeRole === "teacher" && (
            <form onSubmit={handleTeacherSubmit} className="space-y-3.5 text-xs">
              {/* Login vs Register Toggle */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                <span className="font-bold text-gray-900 text-sm">
                  {teacherMode === "login" ? "Faculty Sign In" : "New Faculty Registration"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherMode(teacherMode === "login" ? "register" : "login");
                    setError("");
                  }}
                  className="text-blue-600 hover:underline font-medium text-xs"
                >
                  {teacherMode === "login" ? "Create Account" : "Already registered? Login"}
                </button>
              </div>

              {teacherMode === "register" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Title</label>
                    <select
                      value={teacherTitle}
                      onChange={(e) => setTeacherTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 bg-white focus:border-blue-500 focus:outline-hidden"
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
                      placeholder="e.g. Dr. Ahmad Hasan"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-medium mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  placeholder="faculty@ietlucknow.ac.in"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition mt-2"
              >
                {loading
                  ? teacherMode === "register"
                    ? "Creating Account..."
                    : "Authenticating..."
                  : teacherMode === "register"
                  ? "Register & Sign In"
                  : "Sign In as Instructor"}
              </button>
            </form>
          )}

          {/* 2. STUDENT AUTH FORM */}
          {activeRole === "student" && (
            <form onSubmit={handleStudentSubmit} className="space-y-3.5 text-xs">
              <div className="border-b border-gray-200 pb-2 mb-3">
                <span className="font-bold text-gray-900 text-sm">Student Access</span>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Enter the Room ID, Password, and your Roll Number to view your records.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Classroom Room ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE-3A"
                  value={studentRoomId}
                  onChange={(e) => setStudentRoomId(e.target.value.toUpperCase())}
                  className="w-full uppercase font-mono border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Room Password</label>
                <input
                  type="password"
                  required
                  placeholder="Classroom password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Your Class Roll Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2500520100112"
                  value={studentRollNo}
                  onChange={(e) => setStudentRollNo(e.target.value)}
                  className="w-full font-mono border border-gray-300 rounded p-2 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gray-800 hover:bg-black text-white font-medium rounded transition mt-2"
              >
                {loading ? "Verifying Credentials..." : "Enter Classroom"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
