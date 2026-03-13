/**
 * This file shows how the React frontend's Axios instance
 * should be configured to talk to this backend.
 * Place this in your frontend src/services/api.ts
 */

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem("mediconnect-auth");
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {}
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response.data, // unwrap .data directly
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mediconnect-auth");
      window.location.href = "/login";
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;

// ── Example service calls that map to this backend ──────────────────────────

export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  getMe: () => api.get("/auth/me"),
  updateMe: (data) => api.put("/auth/me", data),
};

export const hospitalAPI = {
  getAll: (params) => api.get("/hospitals", { params }),
  getById: (id) => api.get(`/hospitals/${id}`),
  getBeds: (id) => api.get(`/hospitals/${id}/beds`),
  getDoctors: (id) => api.get(`/hospitals/${id}/doctors`),
  getStats: (id) => api.get(`/hospitals/${id}/stats`),
  update: (id, data) => api.put(`/hospitals/${id}`, data),
};

export const admissionAPI = {
  create: (data) => api.post("/admissions", data),
  getMy: (params) => api.get("/admissions/my", { params }),
  getById: (id) => api.get(`/admissions/${id}`),
  getHospitalAdmissions: (params) => api.get("/admissions/hospital", { params }),
  updateStatus: (id, data) => api.put(`/admissions/${id}/status`, data),
};

export const bedAPI = {
  getByHospital: (hospitalId) => api.get(`/beds/hospital/${hospitalId}`),
  create: (data) => api.post("/beds", data),
  update: (id, data) => api.put(`/beds/${id}`, data),
  delete: (id) => api.delete(`/beds/${id}`),
};

export const doctorAPI = {
  getByHospital: (hospitalId, params) => api.get(`/doctors/hospital/${hospitalId}`, { params }),
  create: (data) => api.post("/doctors", data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  delete: (id) => api.delete(`/doctors/${id}`),
};

export const reportAPI = {
  upload: (admissionId, formData) =>
    api.post(`/reports/upload/${admissionId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getByAdmission: (admissionId) => api.get(`/reports/admission/${admissionId}`),
  delete: (id) => api.delete(`/reports/${id}`),
};


export const analyticsAPI = {
  summary: () => api.get("/analytics/summary"),
  admissionsByMonth: () => api.get("/analytics/admissions-by-month"),
  bedOccupancy: () => api.get("/analytics/bed-occupancy"),
  hospitalPerformance: () => api.get("/analytics/hospital-performance"),
};

export const aiAPI = {
  chat: (message, conversationHistory) =>
    api.post("/ai/chat", { message, conversationHistory }),
  recommendHospitals: (data) => api.post("/ai/recommend-hospitals", data),
  compareHospitals: (hospitalIds) => api.post("/ai/compare-hospitals", { hospitalIds }),
};
