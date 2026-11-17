import React from "react";

export default function Navbar({ role, teacher, studentSession, onNavigateHome, onLogout }) {
  return (
    <nav className="bg-white border-b border-gray-300 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand Title */}
        <div
          onClick={onNavigateHome}
          className="cursor-pointer font-bold text-gray-900 text-base tracking-tight"
        >
          Teacher Register
        </div>

        {/* Role-Specific Controls */}
        <div className="flex items-center space-x-3 text-xs">
          {role === "teacher" && (
            <>
              <button
                onClick={onNavigateHome}
                className="px-2.5 py-1 text-gray-700 hover:text-black font-medium border border-gray-300 rounded bg-gray-50 hover:bg-gray-100"
              >
                Classrooms
              </button>
              <div className="text-gray-800 font-medium pl-2 border-l border-gray-300">
                {teacher?.title} {teacher?.name}
              </div>
              <button
                onClick={onLogout}
                className="text-red-600 hover:text-red-800 font-medium underline pl-2"
              >
                Logout
              </button>
            </>
          )}

          {role === "student" && (
            <>
              <div className="text-gray-800 font-medium">
                Student: <b>{studentSession?.student?.name}</b> ({studentSession?.student?.roll_no})
              </div>
              <button
                onClick={onLogout}
                className="text-red-600 hover:text-red-800 font-medium underline pl-3 border-l border-gray-300"
              >
                Exit / Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
