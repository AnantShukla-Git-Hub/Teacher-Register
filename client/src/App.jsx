import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import LandingPage from './components/LandingPage';
import TeacherDashboard from './components/TeacherDashboard';
import ClassroomRegister from './components/ClassroomRegister';
import StudentPortal from './components/StudentPortal';
import TeacherNameModal from './components/TeacherNameModal';
import { getAuthToken, getStoredTeacher, setAuthToken, setStoredTeacher, api } from './api';

// Google OAuth Client ID
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '961008536205-92pbtpdrau354iha2c054u8u0rf09hao.apps.googleusercontent.com';

export default function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'teacher_dashboard' | 'classroom_register' | 'student_portal'
  const [teacher, setTeacher] = useState(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState(null);
  const [studentData, setStudentData] = useState(null);

  // First time teacher name prompt
  const [showNameModal, setShowNameModal] = useState(false);

  // Check stored teacher session on mount
  useEffect(() => {
    const token = getAuthToken();
    const stored = getStoredTeacher();

    if (token && stored) {
      setTeacher(stored);
      setView('teacher_dashboard');

      // Optionally verify with server in background
      api.getMe()
        .then((res) => {
          if (res?.teacher) {
            setTeacher(res.teacher);
            setStoredTeacher(res.teacher);
          }
        })
        .catch(() => {
          // Token expired or invalid
          setAuthToken('');
          setStoredTeacher(null);
          setTeacher(null);
          setView('landing');
        });
    }
  }, []);

  // Handle teacher login
  const handleTeacherLogin = (teacherProfile, isNewUser) => {
    setTeacher(teacherProfile);
    if (isNewUser) {
      setShowNameModal(true);
    } else {
      setView('teacher_dashboard');
    }
  };

  // Handle teacher first-time name saved
  const handleNameSaved = (updatedTeacher) => {
    setTeacher(updatedTeacher);
    setShowNameModal(false);
    setView('teacher_dashboard');
  };

  // Teacher sign out
  const handleSignOut = () => {
    setAuthToken('');
    setStoredTeacher(null);
    setTeacher(null);
    setSelectedClassroomId(null);
    setView('landing');
  };

  // Open Classroom Register
  const handleOpenClassroom = (classroomId) => {
    setSelectedClassroomId(classroomId);
    setView('classroom_register');
  };

  // Back to Teacher Dashboard
  const handleBackToDashboard = () => {
    setSelectedClassroomId(null);
    setView('teacher_dashboard');
  };

  // Student enters classroom
  const handleStudentEnter = (data) => {
    setStudentData(data);
    setView('student_portal');
  };

  // Student leaves classroom
  const handleStudentLeave = () => {
    setStudentData(null);
    setView('landing');
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        
        {/* LANDING PAGE (First Page with Teacher & Student Blocks) */}
        {view === 'landing' && (
          <LandingPage
            onTeacherLogin={handleTeacherLogin}
            onStudentEnter={handleStudentEnter}
          />
        )}

        {/* TEACHER DASHBOARD */}
        {view === 'teacher_dashboard' && (
          <TeacherDashboard
            teacher={teacher}
            onOpenClassroom={handleOpenClassroom}
            onSignOut={handleSignOut}
          />
        )}

        {/* CLASSROOM REAL-LIFE REGISTER */}
        {view === 'classroom_register' && (
          <ClassroomRegister
            classroomId={selectedClassroomId}
            onBack={handleBackToDashboard}
          />
        )}

        {/* STUDENT PORTAL (READ-ONLY & LIVE) */}
        {view === 'student_portal' && studentData && (
          <StudentPortal
            initialData={studentData}
            onLeave={handleStudentLeave}
          />
        )}

        {/* FIRST-TIME TEACHER NAME MODAL */}
        {showNameModal && (
          <TeacherNameModal
            currentName={teacher?.name}
            onSave={handleNameSaved}
          />
        )}
      </div>
    </GoogleOAuthProvider>
  );
}
