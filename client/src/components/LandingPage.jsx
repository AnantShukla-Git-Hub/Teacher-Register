import React from "react";
import { BookOpen, Users, CheckCircle2, Zap, Shield, FileSpreadsheet, ArrowRight, Sparkles } from "lucide-react";

export default function LandingPage({ setView, teacher, onOpenTeacherAuth }) {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Mini Project (ICS 354) • Session 2026-27</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-stone-900 tracking-tight leading-tight">
          Teacher Register
        </h1>
        <p className="text-lg sm:text-xl text-stone-600 font-normal mt-3 max-w-2xl mx-auto">
          A web-based classroom attendance register and continuous assessment system designed with an archival paper aesthetic.
        </p>

        {/* Action Cards */}
        <div className="grid sm:grid-cols-2 gap-6 mt-10 text-left">
          {/* Teacher Card */}
          <div className="bg-white rounded-2xl p-6 border-2 border-emerald-600/30 hover:border-emerald-600 shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-4 group-hover:scale-105 transition">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">Instructor Portal</h3>
            <p className="text-xs text-stone-600 leading-relaxed mb-6">
              Create classrooms, upload student rosters via CSV, mark attendance with 1-click P / A / L stamps, add custom assessment columns, and export complete registers.
            </p>
            <button
              onClick={() => {
                if (teacher) {
                  setView("teacher");
                } else {
                  onOpenTeacherAuth();
                }
              }}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2"
            >
              <span>{teacher ? "Go to My Classrooms" : "Teacher Sign-In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Student Card */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 hover:border-stone-400 shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold mb-4 group-hover:scale-105 transition">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">Student Portal</h3>
            <p className="text-xs text-stone-600 leading-relaxed mb-6">
              Instant read-only live dashboard. Log in with your Room ID, Password, and Roll Number — no account registration required. See real-time 75% compliance and marks.
            </p>
            <button
              onClick={() => setView("student")}
              className="w-full py-3 bg-stone-900 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2"
            >
              <span>Open Student View</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-bold text-stone-900 text-center mb-8">
          Core Capabilities & Architecture
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2" />
            <h4 className="font-bold text-sm text-stone-900 mb-1">1-Click P / A / L Stamp</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Fast attendance toggling between Present, Absent, and Late directly on a ruled ledger sheet.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
            <Zap className="w-5 h-5 text-amber-500 mb-2" />
            <h4 className="font-bold text-sm text-stone-900 mb-1">Live WebSocket Updates</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Powered by Socket.IO private rooms (`room:ROOM:student:ROLL`). Updates sync in real-time without refreshing.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 mb-2" />
            <h4 className="font-bold text-sm text-stone-900 mb-1">Continuous Assessment</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Add custom evaluation columns (Assignments, Quizzes, Midterms) and edit marks inline like Excel.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs">
            <Shield className="w-5 h-5 text-stone-700 mb-2" />
            <h4 className="font-bold text-sm text-stone-900 mb-1">75% Compliance Alert</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Automatic university threshold tracking protects students from semester exam shortage.
            </p>
          </div>
        </div>
      </section>

      {/* Project Academic Credits Footer */}
      <section className="max-w-4xl mx-auto px-4 bg-stone-100 rounded-2xl p-6 border border-stone-200 text-center">
        <h3 className="font-bold text-stone-800 text-sm mb-1">
          Institute of Engineering and Technology (IET), Lucknow
        </h3>
        <p className="text-xs text-stone-500 mb-4">
          Department of Computer Science and Engineering • Dr. APJ Abdul Kalam Technical University (AKTU)
        </p>
        <div className="text-xs text-stone-600 border-t border-stone-200 pt-3">
          <span className="font-semibold text-stone-800">Project Guide:</span> Ahmad Hasan &nbsp;|&nbsp; 
          <span className="font-semibold text-stone-800 ml-2">Team Members:</span> Anant Shukla (2500520100112), Harsh Vardhan Singh Kushwaha (2500520100131), Indresh Pratap Singh (2500520100132), Kunal Singh (2500520100137)
        </div>
      </section>
    </div>
  );
}
