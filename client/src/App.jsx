import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import LandingPage from "./components/LandingPage";
import TeacherDashboard from "./components/TeacherDashboard";
import ClassroomRegister from "./components/ClassroomRegister";
import StudentPortal from "./components/StudentPortal";
import TeacherAuthModal from "./components/TeacherAuthModal";
import { api } from "./api";

export default function App() {
  const [currentView, setCurrentView] = useState("landing"); // 'landing' | 'teacher' | 'register' | 'student'
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Check existing session
  useEffect(() => {
    const token = localStorage.getItem("tr_teacher_token");
    if (token) {
      api
        .getTeacherProfile()
        .then((profile) => {
          setTeacher(profile);
        })
        .catch(() => {
          localStorage.removeItem("tr_teacher_token");
          setTeacher(null);
        });
    }
  }, []);

  function handleTeacherLoginSuccess(teacherData) {
    setTeacher(teacherData);
    setCurrentView("teacher");
  }

  function handleTeacherLogout() {
    localStorage.removeItem("tr_teacher_token");
    setTeacher(null);
    setCurrentView("landing");
  }

  function handleSelectClassroom(roomId) {
    setActiveRoomId(roomId);
    setCurrentView("register");
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans selection:bg-emerald-200">
      <Navbar
        currentView={currentView}
        setView={setCurrentView}
        teacher={teacher}
        onLogout={handleTeacherLogout}
        onOpenTeacherAuth={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1">
        {currentView === "landing" && (
          <LandingPage
            setView={setCurrentView}
            teacher={teacher}
            onOpenTeacherAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentView === "teacher" && (
          <TeacherDashboard
            teacher={teacher}
            onSelectClassroom={handleSelectClassroom}
          />
        )}

        {currentView === "register" && activeRoomId && (
          <ClassroomRegister
            roomId={activeRoomId}
            onBack={() => setCurrentView("teacher")}
          />
        )}

        {currentView === "student" && <StudentPortal />}
      </main>

      <TeacherAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleTeacherLoginSuccess}
      />
    </div>
  );
}
