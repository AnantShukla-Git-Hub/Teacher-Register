import React from "react";

export default function LandingPage({ setView, teacher, onOpenTeacherAuth }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Teacher Register</h1>
        <p className="text-sm text-gray-600 mt-1">
          Classroom attendance register and continuous assessment system.
        </p>
      </div>

      {/* Main Options */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Teacher Card */}
        <div className="bg-white border border-gray-300 p-5 rounded">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Instructor Portal</h2>
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            Create classrooms, upload student lists via CSV, mark attendance (Present, Absent, Late), add evaluation columns, and export register.
          </p>
          <button
            onClick={() => {
              if (teacher) {
                setView("teacher");
              } else {
                onOpenTeacherAuth();
              }
            }}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
          >
            {teacher ? "Open Instructor Dashboard" : "Instructor Login"}
          </button>
        </div>

        {/* Student Card */}
        <div className="bg-white border border-gray-300 p-5 rounded">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Student Portal</h2>
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            Check your attendance percentage, compliance status (75% requirement), attendance history, and internal assessment marks.
          </p>
          <button
            onClick={() => setView("student")}
            className="w-full py-2 bg-gray-800 hover:bg-black text-white text-xs font-medium rounded transition"
          >
            Open Student Portal
          </button>
        </div>
      </div>

      {/* College Info */}
      <div className="border border-gray-300 bg-gray-50 p-4 rounded text-xs text-gray-700 space-y-1">
        <div className="font-semibold text-gray-900">
          Mini Project (ICS 354)
        </div>
        <div>
          Department of Computer Science and Engineering, Institute of Engineering and Technology, Lucknow
        </div>
        <div className="text-gray-500 pt-1">
          Guide: Ahmad Hasan | Submitted by: Anant Shukla, Harsh Vardhan Singh, Indresh Pratap Singh, Kunal Singh
        </div>
      </div>
    </div>
  );
}
