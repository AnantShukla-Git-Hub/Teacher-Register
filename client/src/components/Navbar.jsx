import React from "react";

export default function Navbar({ currentView, setView, teacher, onLogout, onOpenTeacherAuth }) {
  return (
    <nav className="bg-white border-b border-gray-300 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => setView("landing")}
          className="cursor-pointer font-bold text-gray-900 text-base flex items-center space-x-2"
        >
          <span>Teacher Register</span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => setView("landing")}
            className={`px-3 py-1 rounded border ${
              currentView === "landing"
                ? "bg-gray-100 border-gray-400 font-medium text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Home
          </button>

          <button
            onClick={() => setView("student")}
            className={`px-3 py-1 rounded border ${
              currentView === "student"
                ? "bg-gray-100 border-gray-400 font-medium text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
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
            className={`px-3 py-1 rounded border ${
              currentView.startsWith("teacher")
                ? "bg-gray-100 border-gray-400 font-medium text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Instructor Portal
          </button>

          {teacher && (
            <div className="flex items-center space-x-2 pl-3 border-l border-gray-300">
              <span className="text-xs text-gray-700 font-medium">
                {teacher.title} {teacher.name}
              </span>
              <button
                onClick={onLogout}
                className="text-xs text-red-600 hover:text-red-800 underline ml-2"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
