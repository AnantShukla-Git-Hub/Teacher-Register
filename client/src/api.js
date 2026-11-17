/**
 * Teacher Register - API Service
 * Clean and lightweight HTTP fetch wrapper for FastAPI backend endpoints.
 */

const API_BASE = "/api";

function getAuthHeaders() {
  const token = localStorage.getItem("tr_teacher_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = "An error occurred";
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errData.message || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Authentication & Profile
  teacherAuth: (payload) =>
    request("/auth/teacher", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getTeacherProfile: () => request("/teacher/me"),

  updateTeacherProfile: (title, name) =>
    request("/teacher/profile", {
      method: "PUT",
      body: JSON.stringify({ title, name }),
    }),

  // Classrooms
  getClassrooms: () => request("/classrooms"),

  createClassroom: (room_id, room_name, room_password) =>
    request("/classrooms", {
      method: "POST",
      body: JSON.stringify({ room_id, room_name, room_password }),
    }),

  deleteClassroom: (room_id) =>
    request(`/classrooms/${encodeURIComponent(room_id)}`, {
      method: "DELETE",
    }),

  getClassroomRegister: (room_id) =>
    request(`/classrooms/${encodeURIComponent(room_id)}`),

  // Roster Management
  addStudents: (room_id, students) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/students`, {
      method: "POST",
      body: JSON.stringify({ students }),
    }),

  deleteStudent: (room_id, student_id) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/students/${student_id}`, {
      method: "DELETE",
    }),

  // Attendance Sessions & Records
  createSession: (room_id, session_date, title) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/sessions`, {
      method: "POST",
      body: JSON.stringify({ session_date, title }),
    }),

  deleteSession: (room_id, session_id) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/sessions/${session_id}`, {
      method: "DELETE",
    }),

  updateAttendance: (room_id, session_id, records) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/attendance`, {
      method: "POST",
      body: JSON.stringify({ session_id, records }),
    }),

  // Continuous Assessment Columns & Scores
  addEvaluationColumn: (room_id, name, max_marks) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/evaluations`, {
      method: "POST",
      body: JSON.stringify({ name, max_marks }),
    }),

  deleteEvaluationColumn: (room_id, column_id) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/evaluations/${column_id}`, {
      method: "DELETE",
    }),

  updateScore: (room_id, column_id, student_id, score) =>
    request(`/classrooms/${encodeURIComponent(room_id)}/evaluations/${column_id}/score`, {
      method: "POST",
      body: JSON.stringify({ student_id, score }),
    }),

  // Export
  getExportUrl: (room_id) => `${API_BASE}/classrooms/${encodeURIComponent(room_id)}/export`,

  // Student Portal
  studentLogin: (room_id, room_password, roll_no) =>
    request("/student/login", {
      method: "POST",
      body: JSON.stringify({ room_id, room_password, roll_no }),
    }),

  getStudentDashboard: (room_id, roll_no) =>
    request(`/student/dashboard?room_id=${encodeURIComponent(room_id)}&roll_no=${encodeURIComponent(roll_no)}`),
};
