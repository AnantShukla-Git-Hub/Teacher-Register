import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import AuthPortal from "./components/AuthPortal";
import TeacherDashboard from "./components/TeacherDashboard";
import ClassroomRegister from "./components/ClassroomRegister";
import StudentPortal from "./components/StudentPortal";
import { api } from "./api";

export default function App() {
  const [role, setRole] = useState(null); // 'teacher' | 'student' | null
  const [teacher, setTeacher] = useState(null);
  const [studentSession, setStudentSession] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Check existing session on boot
  useEffect(() => {
    const savedRole = localStorage.getItem("tr_role") || sessionStorage.getItem("tr_role");
    const token = localStorage.getItem("tr_token") || localStorage.getItem("tr_teacher_token");
    const savedStudent = sessionStorage.getItem("tr_student");

    if (savedRole === "teacher" && token) {
      api
        .getTeacherProfile()
        .then((profile) => {
          setRole("teacher");
          setTeacher(profile);
          sessionStorage.removeItem("tr_student");
        })
        .catch(() => {
          handleLogout();
        })
        .finally(() => setInitializing(false));
    } else if (savedRole === "student" && savedStudent) {
      try {
        const parsed = JSON.parse(savedStudent);
        setRole("student");
        setStudentSession(parsed);
        localStorage.removeItem("tr_token");
        localStorage.removeItem("tr_teacher_token");
      } catch (e) {
        handleLogout();
      }
      setInitializing(false);
    } else {
      setInitializing(false);
    }
  }, []);

  function handleTeacherLogin(teacherData, token) {
    // Clear student session to guarantee complete isolation!
    sessionStorage.clear();
    localStorage.setItem("tr_role", "teacher");
    localStorage.setItem("tr_token", token);
    setRole("teacher");
    setTeacher(teacherData);
    setStudentSession(null);
    setActiveRoomId(null);
  }

  function handleStudentLogin(studentData) {
    // Clear teacher session to guarantee complete isolation!
    localStorage.removeItem("tr_role");
    localStorage.removeItem("tr_token");
    localStorage.removeItem("tr_teacher_token");
    sessionStorage.setItem("tr_role", "student");
    sessionStorage.setItem("tr_student", JSON.stringify(studentData));
    setRole("student");
    setStudentSession(studentData);
    setTeacher(null);
    setActiveRoomId(null);
  }

  function handleLogout() {
    localStorage.removeItem("tr_role");
    localStorage.removeItem("tr_token");
    localStorage.removeItem("tr_teacher_token");
    sessionStorage.clear();
    setRole(null);
    setTeacher(null);
    setStudentSession(null);
    setActiveRoomId(null);
  }

  function handleNavigateHome() {
    if (role === "teacher") {
      setActiveRoomId(null);
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xs text-gray-500 font-sans">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      <Navbar
        role={role}
        teacher={teacher}
        studentSession={studentSession}
        onNavigateHome={handleNavigateHome}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {/* If Logged Out: Show AuthPortal */}
        {role === null && (
          <AuthPortal
            onTeacherLogin={handleTeacherLogin}
            onStudentLogin={handleStudentLogin}
          />
        )}

        {/* If Logged In as Teacher */}
        {role === "teacher" && (
          <>
            {activeRoomId ? (
              <ClassroomRegister
                roomId={activeRoomId}
                onBack={() => setActiveRoomId(null)}
              />
            ) : (
              <TeacherDashboard
                teacher={teacher}
                onSelectClassroom={(rId) => setActiveRoomId(rId)}
              />
            )}
          </>
        )}

        {/* If Logged In as Student */}
        {role === "student" && (
          <StudentPortal
            studentSession={studentSession}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
}
