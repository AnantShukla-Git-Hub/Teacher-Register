import React, { useState } from "react";
import { X, UserCheck, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api";

export default function TeacherAuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [demoName, setDemoName] = useState("Dr. Ahmad Hasan");
  const [demoTitle, setDemoTitle] = useState("Prof.");
  const [demoEmail, setDemoEmail] = useState("ahmad.hasan@ietlucknow.ac.in");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleDemoLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.teacherAuth({
        demo_name: demoName.trim(),
        demo_title: demoTitle,
        demo_email: demoEmail.trim(),
      });
      localStorage.setItem("tr_teacher_token", res.token);
      onLoginSuccess(res.teacher);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-stone-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold">
              TR
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Instructor Sign-In</h3>
              <p className="text-xs text-stone-500">Teacher Register Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Quick Viva / Local Demo Mode */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
            <div className="flex items-center space-x-2 text-emerald-800 text-xs font-semibold mb-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Sessional Exam / Quick Viva Access</span>
            </div>
            <p className="text-xs text-stone-600 mb-3 leading-relaxed">
              Sign in directly with your faculty profile for instant local evaluation without needing external Google Cloud credentials.
            </p>

            <form onSubmit={handleDemoLogin} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">Title</label>
                  <select
                    value={demoTitle}
                    onChange={(e) => setDemoTitle(e.target.value)}
                    className="w-full text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                  >
                    <option value="Prof.">Prof.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Er.">Er.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">Faculty Name</label>
                  <input
                    type="text"
                    required
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    className="w-full text-xs bg-white border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center space-x-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>{loading ? "Authenticating..." : "Enter Instructor Dashboard"}</span>
              </button>
            </form>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-stone-400 justify-center pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
            <span>JWT Signed Session • Verified Classroom Security</span>
          </div>
        </div>
      </div>
    </div>
  );
}
