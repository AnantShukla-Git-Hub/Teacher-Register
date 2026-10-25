const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('auth_token') || '';
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getStoredTeacher() {
  try {
    const raw = localStorage.getItem('teacher_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredTeacher(teacher) {
  if (teacher) {
    localStorage.setItem('teacher_profile', JSON.stringify(teacher));
  } else {
    localStorage.removeItem('teacher_profile');
  }
}

async function request(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Server request failed');
  }
  return data;
}

export const api = {
  // Authentication
  googleLogin: (credential) => request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  updateTeacherName: (name) => request('/auth/update-name', { method: 'POST', body: JSON.stringify({ name }) }),
  getMe: () => request('/auth/me'),

  // Classrooms
  getClassrooms: () => request('/classrooms'),
  createClassroom: (data) => request('/classrooms', { method: 'POST', body: JSON.stringify(data) }),
  deleteClassroom: (id) => request(`/classrooms/${id}`, { method: 'DELETE' }),
  getClassroomDetails: (id) => request(`/classrooms/${id}`),

  // Student Roster
  addStudent: (classroomId, student) => {
    const s = {
      roll_no: student.roll_no || student.rollNo,
      name: student.name
    };
    return request(`/classrooms/${classroomId}/students`, { 
      method: 'POST', 
      body: JSON.stringify({ students: [s] }) 
    });
  },
  importStudents: (classroomId, students) => {
    const list = (students || []).map((s) => ({
      roll_no: s.roll_no || s.rollNo,
      name: s.name
    }));
    return request(`/classrooms/${classroomId}/students`, { 
      method: 'POST', 
      body: JSON.stringify({ students: list }) 
    });
  },
  uploadStudents: (classroomId, students) => {
    const list = (students || []).map((s) => ({
      roll_no: s.roll_no || s.rollNo,
      name: s.name
    }));
    return request(`/classrooms/${classroomId}/students`, { 
      method: 'POST', 
      body: JSON.stringify({ students: list }) 
    });
  },
  deleteStudent: (classroomId, studentId) => 
    request(`/classrooms/${classroomId}/students/${studentId}`, { method: 'DELETE' }),

  // Evaluation Columns
  addColumn: (classroomId, title) => 
    request(`/classrooms/${classroomId}/columns`, { 
      method: 'POST', 
      body: JSON.stringify({ title: typeof title === 'object' ? title.title : title }) 
    }),
  addCustomColumn: (classroomId, data) => 
    request(`/classrooms/${classroomId}/columns`, { 
      method: 'POST', 
      body: JSON.stringify(typeof data === 'string' ? { title: data } : data) 
    }),
  deleteColumn: (classroomId, colId) => 
    request(`/classrooms/${classroomId}/columns/${colId}`, { method: 'DELETE' }),
  deleteCustomColumn: (classroomId, colId) => 
    request(`/classrooms/${classroomId}/columns/${colId}`, { method: 'DELETE' }),

  // Attendance
  markAttendance: (classroomId, data) => 
    request(`/classrooms/${classroomId}/attendance`, { method: 'POST', body: JSON.stringify(data) }),
  bulkMarkAttendance: (classroomId, data) => 
    request(`/classrooms/${classroomId}/attendance/bulk`, { method: 'POST', body: JSON.stringify(data) }),

  // Evaluation Marks
  updateMarks: (classroomId, data) => 
    request(`/classrooms/${classroomId}/marks`, { method: 'POST', body: JSON.stringify(data) }),

  // Student Portal
  studentJoin: (data) => 
    request('/student/join', { method: 'POST', body: JSON.stringify(data) }),
};
