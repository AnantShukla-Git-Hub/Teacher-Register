import React from "react";
import { BookOpen, User, LogOut, GraduationCap } from "lucide-react";

export default function Navbar({ currentView, setView, teacher, onLogout, onOpenTeacherAuth }) {
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => setView("landing")}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-xs group-hover:bg-emerald-800 transition">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-stone-900 text-lg tracking-tight">Teacher Register</span>
              <span className="text-[10px] uppercase font-semibold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded border border-stone-200">
                ICS 354
              </span>
            </div>
            <p className="text-xs text-stone-500">IET Lucknow • Real-Time Attendance & Continuous Assessment</p>
          </div>
        </div>

        {/* Portal Switcher & User Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-medium">
            <button
              onClick={() => setView("student")}
              className={`px-3 py-1.5 rounded-md transition ${
                currentView === "student"
                  ? "bg-white text-stone-900 shadow-xs font-semibold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
              Student Portal
            </button>
            <button
              onClick={() => {
                if (teacher) {
                  setView("teacher");
                } else {
                  onOpenTeacherAuth();
                }
              }}
              className={`px-3 py-1.5 rounded-md transition ${
                currentView.startsWith("teacher")
                  ? "bg-white text-stone-900 shadow-xs font-semibold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <User className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
              Instructor Portal
            </button>
          </div>

          {teacher ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-stone-200">
              <div className="text-right hidden md:block">
                <div className="text-xs font-semibold text-stone-900">
                  {teacher.title} {teacher.name}
                </div>
                <div className="text-[11px] text-stone-500 truncate max-w-[140px]">{teacher.email}</div>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 text-stone-400 hover:text-red-600 hover:bg-stone-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenTeacherAuth}
              className="px-3.5 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition shadow-xs flex items-center space-x-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Teacher Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
