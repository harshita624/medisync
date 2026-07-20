"use client";
import axios from "axios";
import Cookies from "js-cookie";

// ── Axios instance ────────────────────────────────────────────────────────────
// ALWAYS use /api as the baseURL so requests go through Next.js rewrites.
// This means the browser never tries to reach localhost:5000 directly —
// Next.js proxies /api/* → BACKEND_URL on the server side.
// NEXT_PUBLIC_API_URL should NOT be set (or set to /api) in production;
// only BACKEND_URL (server-only, no NEXT_PUBLIC_) should point to your backend.
const API = axios.create({
  baseURL: "/api",   // ← always relative; Next.js proxy handles the rest
  timeout: 30000,
  withCredentials: true,
});

export { API };

// ── Request interceptor — attach token ───────────────────────────────────────
API.interceptors.request.use(config => {
  const token =
    Cookies.get("token") ||
    (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Don't force Content-Type for FormData — let browser set it with boundary
  if (config.data instanceof FormData) delete config.headers["Content-Type"];
  return config;
});

// ── Response interceptor — handle 401 ────────────────────────────────────────
API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      Cookies.remove("token");
      Cookies.remove("user");
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────────────────────
export const registerUser    = data => API.post("/auth/register", data);
export const loginUser       = data => API.post("/auth/login", data);
export const getMe           = ()   => API.get("/auth/me");
export const updateProfile   = data => API.put("/auth/update-profile", data);
export const changePassword  = data => API.put("/auth/change-password", data);

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — PROFILE
// ─────────────────────────────────────────────────────────────────────────────
export const getPatientProfile    = ()   => API.get("/patient/profile");
export const updatePatientProfile = data => API.put("/patient/profile", data);

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — VITALS
// ─────────────────────────────────────────────────────────────────────────────
export const getVitals    = ()        => API.get("/patient/vitals");
export const addVitals    = data      => API.post("/patient/vitals", data);
export const deleteVitals = readingId => API.delete(`/patient/vitals/${readingId}`);

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const getPatientDocuments   = ()   => API.get("/patient/documents");
export const addPatientDocument    = data => API.post("/patient/documents", data);
export const deletePatientDocument = id   => API.delete(`/patient/documents/${id}`);

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — APPOINTMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const getMyAppointments = () => API.get("/patient/appointments");

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — MEDICINE REMINDERS
// ─────────────────────────────────────────────────────────────────────────────
export const getMedicineReminders   = ()         => API.get("/patient/medicine-reminders");
export const createMedicineReminder = data       => API.post("/patient/medicine-reminders", data);
export const updateMedicineReminder = (id, data) => API.put(`/patient/medicine-reminders/${id}`, data);
export const logMedicineReminder    = (id, data) => API.post(`/patient/medicine-reminders/${id}/log`, data);
export const deleteMedicineReminder = id         => API.delete(`/patient/medicine-reminders/${id}`);

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — BILLS
// ─────────────────────────────────────────────────────────────────────────────
export const getPatientBills = ()         => API.get("/patient/bills");
export const payPatientBill  = (id, data) => API.post(`/patient/bills/${encodeURIComponent(id)}/pay`, data);

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — SOS
// ─────────────────────────────────────────────────────────────────────────────
export const getSosEvents = ()   => API.get("/patient/sos");
export const triggerSos   = data => API.post("/patient/sos", data);

// ─────────────────────────────────────────────────────────────────────────────
//  PATIENT — INSURANCE & CLAIMS
// ─────────────────────────────────────────────────────────────────────────────
export const getMyPolicies = () => API.get("/patient/policies");
export const getMyClaims   = () => API.get("/patient/claims");

// ─────────────────────────────────────────────────────────────────────────────
//  APPOINTMENTS (general)
// ─────────────────────────────────────────────────────────────────────────────
export const bookAppointment   = data => API.post("/appointments", data);
export const cancelAppointment = id   => API.put(`/appointments/${id}/cancel`);
export const bookSlot          = data => API.post("/appointments/book-slot", data);

export const getConsultationRoom     = meetingId        => API.get(`/appointments/meeting/${meetingId}`);
export const getConsultationMessages = meetingId        => API.get(`/appointments/meeting/${meetingId}/messages`);
export const sendConsultationMessage = (meetingId, msg) => API.post(`/appointments/meeting/${meetingId}/messages`, { message: msg });

// ─────────────────────────────────────────────────────────────────────────────
//  RECORDS
// ─────────────────────────────────────────────────────────────────────────────
export const getMedicalHistory   = ()   => API.get("/records");
export const addMedicalRecord    = data => API.post("/records", data);
export const createMedicalRecord = data => API.post("/doctor/records", data);

// ─────────────────────────────────────────────────────────────────────────────
//  QR
// ─────────────────────────────────────────────────────────────────────────────
export const generateQR = ()    => API.post("/qr/generate");
export const getMyQR    = ()    => API.get("/qr/my");
export const scanQR     = token => API.post("/qr/scan", { token });

// ─────────────────────────────────────────────────────────────────────────────
//  DOCTOR
// ─────────────────────────────────────────────────────────────────────────────
export const getDoctorProfile                  = ()              => API.get("/doctor/profile");
export const updateDoctorProfile               = data            => API.put("/doctor/profile", data);
export const getAllDoctors                      = params          => API.get("/doctor/all", { params });
export const getMyPatients                     = ()              => API.get("/doctor/patients");
export const getDoctorPatients                 = ()              => API.get("/doctor/patients");
export const getDoctorAppointments             = ()              => API.get("/doctor/appointments");
export const updateDoctorAppointmentStatus     = (id, data)      => API.put(`/doctor/appointments/${id}/status`, data);
export const getPatientContextForDoctor        = patientId       => API.get(`/doctor/patient-context/${patientId}`);
export const getPatientRecordsForDoctor        = patientId       => API.get(`/doctor/patient-records/${patientId}`);
export const getDoctorAvailability             = ()              => API.get("/doctor/availability");
export const saveDoctorAvailability            = availability    => API.put("/doctor/availability", { availability });

// Queue
export const getDoctorTodayQueue      = ()         => API.get("/doctor/queue/today");
export const updateAppointmentJourney = (id, data) => API.patch(`/doctor/appointments/${id}/journey`, data);

// Hospital resources
export const getHospitalResources = () => API.get("/doctor/resources");

// ─────────────────────────────────────────────────────────────────────────────
//  INSURANCE (insurance-role portal)
// ─────────────────────────────────────────────────────────────────────────────
export const getInsuranceClaims    = params  => API.get("/insurance/claims", { params });
export const processClaim          = (id, d) => API.put(`/insurance/claim/${id}/process`, d);
export const createPolicy          = data    => API.post("/insurance/policy", data);
export const getInsuranceDashboard = ()      => API.get("/insurance/dashboard");

// ─────────────────────────────────────────────────────────────────────────────
//  CLAIMS (patient-side filing)
// ─────────────────────────────────────────────────────────────────────────────
export const submitClaim  = data => API.post("/claims", data);
export const getClaimById = id   => API.get(`/claims/${id}`);

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminDashboard     = ()       => API.get("/admin/dashboard");
export const getAdminUsers         = params   => API.get("/admin/users", { params });
export const updateAdminUserStatus = (id, d)  => API.put(`/admin/users/${id}/status`, d);
export const getAuditLogs          = params   => API.get("/admin/audit-logs", { params });
export const getAdminMonitoring    = ()       => API.get("/admin/monitoring");

// ─────────────────────────────────────────────────────────────────────────────
//  SYMPTOMS
// ─────────────────────────────────────────────────────────────────────────────
export const checkSymptoms = data => API.post("/symptoms/check", data);

// ─────────────────────────────────────────────────────────────────────────────
//  AVAILABILITY (date-specific)
// ─────────────────────────────────────────────────────────────────────────────
export const getDateAvailability    = ()               => API.get("/doctor/date-availability");
export const saveDateAvailability   = (date, data)     => API.put(`/doctor/date-availability/${date}`, data);
export const deleteDateAvailability = date             => API.delete(`/doctor/date-availability/${date}`);
export const saveWeeklyDefaults     = data             => API.put("/doctor/weekly-defaults", data);
export const getOpenSlots           = (doctorId, date) => API.get(`/doctor/${doctorId}/open-slots`, { params: { date } });
// ── Billing ─────────────────────────────────────────────────────────────────
export const getMyBills = () => API.get('/patient/bills');
export const payBill = (id, data) => API.post(`/patient/bills/${id}/pay`, data);
// ── Health Packages ──────────────────────────────────────────────────────────
export const bookHealthPackage = (data) => API.post('/patient/health-packages', data);
export const getMyHealthPackageBookings = () => API.get('/patient/health-packages');
// ── Health Packages ──────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const getNotifications         = params => API.get("/notifications", { params });
export const markNotificationRead     = id     => API.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = ()     => API.put("/notifications/read-all");

export default API;