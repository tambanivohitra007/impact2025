<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Ensure Bootstrap CSS is also loaded

// Import Child Components
import BaseModal from './components/BaseModal.vue';
import ParticipantForm from './components/ParticipantForm.vue';
import ParticipantList from './components/ParticipantList.vue';
import SessionForm from './components/SessionForm.vue';
import SessionList from './components/SessionList.vue';
import AttendanceTracker from './components/AttendanceTracker.vue';
import DashboardView from './components/DashboardView.vue';
import logo from './assets/mahabo.png';
import Admin from './components/Admin.vue';
import LoginView from './components/LoginView.vue';
import RegistrationView from './components/RegistrationView.vue';
import { useToast } from 'vue-toastification';
// Import Icons
import { BookOpen, Users, Calendar, AlertCircle, Save, PlusCircle, UserCheck, BarChart2, Settings, LogOut, ChevronDown, Menu, List, ChurchIcon, ListCheck } from 'lucide-vue-next';

// --- Configuration ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- State ---
const view = ref('');
const participants = ref([]);
const sessions = ref([]);
const selectedSession = ref(null);
const currentAttendance = ref([]);
const toast = useToast();
// const installPromptEvent = ref(null); // Not used in provided code, can be removed if not needed

const loading = reactive({
  participants: false,
  sessions: false,
  attendance: false,
  app: true,
});
const saving = ref(false);
const error = ref(null);
const successNotification = ref({ show: false, message: '', participantId: null }); // Assuming this is for a custom notification system
// const isMobileNavOpen = ref(false); // Not directly used for toggling, Bootstrap handles offcanvas

// Authentication state
const loggedIn = ref(false);
const currentUserRole = ref(null); // NEW: To store the role of the logged-in user
const showRegistration = ref(false);

// --- Modal State & Refs ---
const showParticipantModal = ref(false);
const editingParticipant = ref(null);
const participantFormRef = ref(null);

const showSessionModal = ref(false);
const sessionFormRef = ref(null);

const attendanceRef = ref(null);

const newlyCreatedId = ref(null);

// --- Computed Properties ---
const isAdmin = computed(() => {
  return loggedIn.value && currentUserRole.value === 'admin';
});

const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString + 'T00:00:00'); // Treat as local time
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        console.warn("Error formatting date:", dateString, e);
        return dateString;
    }
};

// --- Helper to decode JWT (basic client-side for UI hints) ---
function decodeJwt(token) {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode JWT:", e);
        return null;
    }
}


// --- API Call Function ---
async function apiCall(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    const token = localStorage.getItem('authToken');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    } else {
        console.warn(`No auth token found for API call to ${url}`);
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    if (method !== 'GET') saving.value = true;
    let lastError = null; // Store last error locally to avoid race conditions with global error ref

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, options);

        if (response.status === 401) {
            // Token expired or invalid: clear all sensitive state and redirect to login
            localStorage.removeItem('authToken');
            loggedIn.value = false;
            currentUserRole.value = null;
            participants.value = [];
            sessions.value = [];
            selectedSession.value = null;
            currentAttendance.value = [];
            view.value = 'login';
            showRegistration.value = false;
            error.value = 'Session expired. Please log in again.';
            window.location.reload(); // Force reroute to login immediately
            return;
        }
        
        const data = await response.json();
        if (!response.ok) {
            const errorMessageContent = data?.error || data?.message || `API Error: ${response.status} ${response.statusText}`;
            lastError = errorMessageContent;
            console.error(`API call failed to ${url}:`, errorMessageContent, data?.details || '');
            throw new Error(errorMessageContent);
        }
        error.value = null; // Clear global error on successful API call
        return data;
    } catch (err) {
        error.value = lastError || err.message || 'An unexpected error occurred during API call.';
        throw err;
    } finally {
        if (method !== 'GET') saving.value = false;
    }
}

// --- Unsaved Changes Modal ---
const showUnsavedModal = ref(false);
const pendingNavigationTarget = ref(null);

const confirmIfUnsavedChanges = async (nextView = null) => {
    if (view.value === 'attendance' && attendanceRef.value?.hasUnsavedChanges) {
        pendingNavigationTarget.value = nextView;
        showUnsavedModal.value = true;
        return false;
    }
    return true;
};

function discardUnsavedChanges() {
    showUnsavedModal.value = false;
    if (attendanceRef.value) {
        attendanceRef.value.hasUnsavedChanges = false;
    }
    if (pendingNavigationTarget.value) {
        if (pendingNavigationTarget.value === 'sessions') {
            selectedSession.value = null;
            currentAttendance.value = [];
        }
        view.value = pendingNavigationTarget.value;
    }
    pendingNavigationTarget.value = null;
}

function cancelUnsavedNavigation() {
    showUnsavedModal.value = false;
    pendingNavigationTarget.value = null;
}

// --- Data Fetching ---
const fetchParticipants = async () => {
    loading.participants = true;
    try { participants.value = await apiCall('/participants'); }
    catch (err) { /* Handled by apiCall setting global error */ }
    finally { loading.participants = false; }
};
const fetchSessions = async () => {
    loading.sessions = true;
    try { sessions.value = await apiCall('/sessions'); }
    catch (err) { /* Handled by apiCall setting global error */ }
    finally { loading.sessions = false; }
};

const fetchInitialData = async () => {
    loading.app = true;
    error.value = null; // Clear previous errors
    const token = localStorage.getItem('authToken');

    if (token) {
        const decodedToken = decodeJwt(token);
        if (decodedToken && decodedToken.id && decodedToken.role) {
            // Optionally, you could verify token with a lightweight backend endpoint here
            // For now, trust client-side decoded role for UI purposes
            loggedIn.value = true;
            currentUserRole.value = decodedToken.role;
            view.value = 'dashboard';
            try {
                await Promise.all([fetchParticipants(), fetchSessions()]);
            } catch (fetchErr) {
                console.error("Error fetching protected data after initial load:", fetchErr);
                // If fetching protected data fails (e.g. token actually expired despite being present)
                // then log out the user.
                await handleLogout(true); // Pass a flag to indicate it's an auto-logout
                return; // Stop further execution in this function
            }
        } else {
            // Token exists but is malformed or doesn't contain role
            console.warn("Token found but malformed or missing role. Logging out.");
            await handleLogout(true); // Auto-logout
        }
    } else {
        loggedIn.value = false;
        currentUserRole.value = null;
        view.value = 'login';
        showRegistration.value = false;
    }
    loading.app = false;
};

onMounted(fetchInitialData);

const fetchAttendanceForSession = async (sessionId) => {
    if (!sessionId) return;
    loading.attendance = true;
    try {
        const rawAttendance = await apiCall(`/attendance/${sessionId}`);
        const attendanceMap = rawAttendance.reduce((acc, record) => {
            acc[record.participant_id] = { attended: !!record.attended, notes: record.notes || '' };
            return acc;
        }, {});
        currentAttendance.value = participants.value.map(p => ({
            participant_id: p.id,
            participant_name: p.name,
            attended: attendanceMap[p.id]?.attended || false,
            notes: attendanceMap[p.id]?.notes || '',
        }));
    } catch (err) { /* Handled by apiCall */ }
    finally { loading.attendance = false; }
};

// --- Navigation ---
const handleNavigation = async (newView) => {
    if (!loggedIn.value && newView !== 'login' && newView !== 'register') {
        view.value = 'login';
        showRegistration.value = false;
        return;
    }
    // Prevent non-admins from navigating to admin view
    if (newView === 'admin' && !isAdmin.value) {
        console.warn("Attempt to navigate to admin view by non-admin user denied.");
        // Optionally, show a notification or redirect to dashboard
        view.value = 'dashboard'; // Or current view
        return;
    }

    const okToNavigate = await confirmIfUnsavedChanges(newView);
    if (!okToNavigate) return;

    view.value = newView;
    // isMobileNavOpen.value = false; // Bootstrap handles offcanvas toggle

    if (newView === 'sessions' || newView === 'dashboard') {
        selectedSession.value = null;
        currentAttendance.value = [];
    }
    nextTick(() => {
        const mainContent = document.getElementById('mainContentArea');
        if (mainContent) mainContent.scrollTop = 0;
    });
};

// --- Participant Actions ---
const handleAddParticipantRequest = () => {
    editingParticipant.value = null;
    showParticipantModal.value = true;
};
const handleEditParticipantRequest = (participant) => {
    editingParticipant.value = participant;
    showParticipantModal.value = true;
    newlyCreatedId.value = null; // Only highlight on create
};

const handleSaveParticipant = async (participantData) => {
    let apiError = null;
    try {
        let savedParticipant;
        if (editingParticipant.value?.id) {
            savedParticipant = await apiCall(`/participants/${editingParticipant.value.id}`, 'PUT', participantData);
            successNotification.value = {
                show: true,
                message: `Participant "${participantData.name}" updated.`,
                details: ''
            };
            newlyCreatedId.value = null; // Only highlight on create
        } else {
            savedParticipant = await apiCall('/participants', 'POST', participantData);
            successNotification.value = {
                show: true,
                message: `Participant "${savedParticipant.name}" created.`,
                details: `ID: ${savedParticipant.id}`
            };
            newlyCreatedId.value = savedParticipant.id; // Highlight new participant

            toast.success(`Participant "${savedParticipant.name}" added.\nID: ${savedParticipant.id}`);            
        }
        showParticipantModal.value = false;
        await fetchParticipants();
    } catch (err) {
        apiError = error.value;
    } finally {
        setTimeout(() => successNotification.value.show = false, 4000);
    }
    return apiError;
};

const handleDeleteParticipant = async (participantId) => {
    const pToDelete = participants.value.find(p => p.id === participantId);
    if (window.confirm(`Delete "${pToDelete?.name || 'this participant'}"?`)) {
        try {
            await apiCall(`/participants/${participantId}`, 'DELETE');
            successNotification.value = { show: true, message: `Participant "${pToDelete?.name || 'ID: '+participantId}" deleted.`, details: '' };
            await fetchParticipants();
            if (view.value === 'attendance' && selectedSession.value) await fetchAttendanceForSession(selectedSession.value.id);
        } catch (err) { /* Handled */ }
        finally { setTimeout(() => successNotification.value.show = false, 4000); }
    }
};

// --- Session Actions ---
const handleAddSessionRequest = () => {
    showSessionModal.value = true;
};

const handleSaveSession = async (sessionData) => {
    let apiError = null;
    try {
        await apiCall('/sessions', 'POST', sessionData);
        successNotification.value = { show: true, message: `Session for ${formatDateForDisplay(sessionData.session_date)} added.`, details: '' };
        showSessionModal.value = false; await fetchSessions();
    } catch (err) { apiError = error.value; }
    finally { setTimeout(() => successNotification.value.show = false, 4000); }
    return apiError;
};
const handleDeleteSession = async (sessionId) => {
    const sToDelete = sessions.value.find(s => s.id === sessionId);
    if (window.confirm(`Delete session for ${formatDateForDisplay(sToDelete?.session_date)} and all attendance?`)) {
        try {
            await apiCall(`/sessions/${sessionId}`, 'DELETE');
            successNotification.value = { show: true, message: `Session for ${formatDateForDisplay(sToDelete?.session_date)} deleted.`, details: '' };
            await fetchSessions();
            if (view.value === 'attendance' && selectedSession.value?.id === sessionId) handleBackToSessions();
        } catch (err) { /* Handled */ }
        finally { setTimeout(() => successNotification.value.show = false, 4000); }
    }
};

// --- Attendance Actions (remains the same) ---
const handleViewAttendance = async (session) => {
    selectedSession.value = session; view.value = 'attendance'; await fetchAttendanceForSession(session.id);
};
const handleBackToSessions = async () => {
  const ok = await confirmIfUnsavedChanges('sessions');
  if (!ok) return;
  selectedSession.value = null;
  currentAttendance.value = [];
  view.value = 'sessions';
};

// In App.vue's <script setup>
const handleSaveAttendance = async (attendanceData) => {
    if (!selectedSession.value) {
        // You might want to use your notification system here too
        error.value = 'Error: No session selected.';
        return 'Error: No session selected.';
    }

    const payload = attendanceData.map(att => ({
        session_id: selectedSession.value.id,
        participant_id: att.participant_id,
        attended: att.attended,
        notes: att.notes
    }));

    // --- ADD THIS CHECK ---
    if (payload.length === 0) {
        console.log("No attendance data to save for this session.");
        // Optionally notify the user that there were no changes or nothing to save.
        // For example, using your successNotification or vue-notification:
        // notify({ type: "info", title: "Attendance", text: "No attendance changes to save." });
        successNotification.value = { show: true, message: `Attendance confirmed (no changes to save).`, details: '' };
        if (attendanceRef.value) attendanceRef.value.hasUnsavedChanges = false; // Still mark as "saved"
        setTimeout(() => successNotification.value.show = false, 4000);
        return; // Exit without making the API call
    }
    // --- END OF ADDED CHECK ---

    saving.value = true; // Moved saving state here
    error.value = null;  // Clear previous errors
    let apiError = null;
    try {
        await apiCall('/attendance', 'POST', { attendance: payload });
        successNotification.value = { show: true, message: `Attendance for ${formatDateForDisplay(selectedSession.value.session_date)} saved.`, details: '' };
        if (attendanceRef.value) attendanceRef.value.hasUnsavedChanges = false;
    } catch (err) {
        // error.value is already set by your modified apiCall
        apiError = error.value || 'Failed to save one or more attendance records.';
    } finally {
        saving.value = false; // Moved saving state here
        // Only set timeout if a notification was actually shown by the try/catch block
        if (successNotification.value.show || apiError) {
             setTimeout(() => {
                successNotification.value.show = false;
                // If you display apiError in a similar toast, clear it too
             }, 4000);
        }
    }
    return apiError;
};


// --- Authentication Methods ---
const handleLogin = async (credentials) => {
    saving.value = true;
    error.value = null;
    try {
        const responseData = await apiCall('/auth/login', 'POST', credentials);
        if (responseData && responseData.token && responseData.user) {
            localStorage.setItem('authToken', responseData.token);
            currentUserRole.value = responseData.user.role; // Store role
            loggedIn.value = true;
            await fetchInitialData(); // Re-fetch initial data, which sets view
        } else {
            throw new Error(responseData.error || "Login failed: Invalid response from server.");
        }
    } catch (err) {
        // error.value is set by apiCall
        loggedIn.value = false;
        currentUserRole.value = null;
    } finally {
        saving.value = false;
    }
};

const displayRegistrationForm = () => {
    showRegistration.value = true;
};

const processRegistration = async (userData) => {
    saving.value = true;
    error.value = null;
    try {
        const responseData = await apiCall('/auth/register', 'POST', userData);
        if (responseData && responseData.user) {
            // Registration successful, but require admin approval
            showRegistration.value = false;
            error.value = null;
            successNotification.value = { show: true, message: 'Inscription réussie. Un administrateur doit approuver votre compte avant de pouvoir vous connecter.', details: '' };
            // Optionally, clear registration form or redirect to login
        } else {
            throw new Error(responseData.error || "Registration failed: Invalid response from server.");
        }
    } catch (err) {
        // error.value is set by apiCall
    } finally {
        saving.value = false;
    }
};

const handleLogout = async (isAutoLogout = false) => {
    if (!isAutoLogout) { // Only confirm if it's a manual logout
        const okToNavigate = await confirmIfUnsavedChanges('login');
        if (!okToNavigate) return;
    }

    // await apiCall('/auth/logout', 'POST'); // Optional: server-side token invalidation
    localStorage.removeItem('authToken');
    loggedIn.value = false;
    currentUserRole.value = null; // Clear role
    participants.value = [];
    sessions.value = [];
    selectedSession.value = null;
    currentAttendance.value = [];
    view.value = 'login';
    showRegistration.value = false;
    error = null;
};

</script>

<template>
    <div class="app-wrapper d-flex flex-column bg-body-tertiary min-vh-100">
        <div v-if="!loggedIn" class="d-flex flex-column justify-content-center align-items-center min-vh-100 p-3">
            <div class="auth-form-container" style="max-width: 400px; width: 100%;">
                <div class="text-center mb-4">
                    <img :src="logo" alt="Logo" style="width: 120px; height: 120px; margin-bottom: 1rem;" />
                    <h1 class="h3 mb-1 fw-bold app-title">IMPACT 2025</h1>
                    <p class="mb-0 text-muted" style="line-height: 1.2;">Eglise Mahabo</p>
                </div>
                <LoginView
                    v-if="!showRegistration"
                    @login="handleLogin"
                    @show-register-form="displayRegistrationForm"
                    :loading="saving"
                    :external-error-message="error" />
                <RegistrationView
                    v-else
                    @register="processRegistration"
                    @cancel="showRegistration = false"
                    :loading="saving"
                    :external-error-message="error" />
                <div v-if="error && (view === 'login' || showRegistration)" class="alert alert-danger mt-3 py-2 small">
                    {{ error }}
                </div>
            </div>
        </div>

        <div v-else class="d-flex flex-column flex-grow-1">
            <header class="app-header text-white shadow-sm">
                <div class="container-fluid d-flex align-items-center justify-content-between py-3 px-3 px-md-4">
                    <div class="d-flex align-items-center">
                        <img :src="logo" alt="Logo" class="me-2 flex-shrink-0 app-logo-icon" style="width: 50px; height: 50px;" />
                        <div class="d-none d-sm-block">
                            <h1 class="h5 mb-0 fw-bold app-title">IMPACT 2025</h1>
                            <p class="mb-0 small text-white-50" style="line-height: 1.2;">Ho avy indray i Jesosy</p>
                        </div>
                        <div class="d-sm-none">
                            <h1 class="h5 mb-0 fw-bold app-title-mobile">Impact25</h1>
                        </div>
                    </div>
                    <button class="btn btn-outline-light d-lg-none p-1 mobile-nav-toggle" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNavOffcanvas" aria-controls="mobileNavOffcanvas" aria-label="Toggle navigation">
                        <Menu :size="24" />
                    </button>
                </div>
            </header>

            <div v-if="error && view !== 'login'" class="global-alert alert alert-danger alert-dismissible fade show border-0 rounded-0 m-0 py-2 small" role="alert">
                <div class="container-fluid d-flex align-items-center">
                    <AlertCircle class="me-2 flex-shrink-0" :size="20" />
                    <strong class="me-1">Error:</strong> {{ error }}
                    <button type="button" class="btn-close btn-sm p-2 ms-auto" @click="error = null" aria-label="Close"></button>
                </div>
            </div>

            <div v-if="successNotification.show" class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1100">
                </div>

            <div class="app-body container-fluid flex-grow-1 d-flex">
                <div class="row flex-grow-1 w-100 gx-0">
                    <nav class="col-lg-2 d-none d-lg-block bg-white sidebar shadow-sm">
                        <div class="sticky-top inner-sidebar-scroll">
                            <ul class="nav nav-pills flex-column mb-auto px-2">
                                <li class="nav-item">
                                    <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'dashboard' }" @click.prevent="handleNavigation('dashboard')">
                                        <BarChart2 class="me-2 flex-shrink-0" :size="18" /> Tableau de bord
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'participants' }" @click.prevent="handleNavigation('participants')">
                                        <Users class="me-2 flex-shrink-0" :size="18" /> Participants
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'sessions' || view === 'attendance' }" @click.prevent="handleNavigation('sessions')">
                                        <Calendar class="me-2 flex-shrink-0" :size="18" /> Sessions
                                    </a>
                                </li>
                                <li v-if="isAdmin" class="nav-item">
                                    <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'admin'}" @click.prevent="handleNavigation('admin')">
                                        <Settings class="me-2 flex-shrink-0" :size="18" /> Gestion d'administration
                                    </a>
                                </li>
                                <li class="nav-item mt-auto pt-2 border-top">
                                    <a href="#" class="nav-link d-flex align-items-center" @click.prevent="handleLogout()">
                                        <LogOut class="me-2 flex-shrink-0" :size="20" /> Logout
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </nav>

                    <main id="mainContentArea" class="col-12 col-lg-10 main-content-area">
                        <div v-if="loading.app && !loggedIn" class="d-flex justify-content-center align-items-center h-100 text-muted p-5">
                            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"></div>
                            <p class="ms-3 fs-5">Loading Application...</p>
                        </div>
                        <div v-else-if="loggedIn" class="h-100">
                            <DashboardView v-if="view === 'dashboard'" @navigate="handleNavigation" :api-call="apiCall" :participants-count="participants.length" :sessions-count="sessions.length" class="w-100 h-100" />
                            <ParticipantList v-else-if="view === 'participants'" class="flex-grow-1"
                                :participants="participants"
                                :loading="loading.participants"
                                :newly-created-id="newlyCreatedId"
                                @add-new-participant="handleAddParticipantRequest"
                                @edit-participant="handleEditParticipantRequest"
                                @delete-participant="handleDeleteParticipant"
                            />
                            <SessionList v-else-if="view === 'sessions'" class="flex-grow-1"
                                :sessions="sessions"
                                :loading="loading.sessions"
                                @add-new-session="handleAddSessionRequest"
                                @view-attendance="handleViewAttendance"
                                @delete-session="handleDeleteSession"
                                :format-date="formatDateForDisplay"
                            />
                            <AttendanceTracker v-else-if="view === 'attendance' && selectedSession"
                                ref="attendanceRef"
                                :session="selectedSession"
                                :participants="participants"
                                :initial-attendance="currentAttendance"
                                :loading="loading.attendance"
                                :saving="saving"
                                @back="handleBackToSessions"
                                @save-attendance="handleSaveAttendance"
                                @delete-session="handleDeleteSession"
                                :format-date="formatDateForDisplay"
                            />
                            <Admin v-else-if="view === 'admin' && isAdmin" :api-call="apiCall" />
                            <div v-else-if="view === 'admin' && !isAdmin" class="p-4 text-center text-danger">
                                <AlertCircle :size="48" class="mb-2" />
                                <h4 class="fw-bold">Access Denied</h4>
                                <p>You do not have permission to view this page.</p>
                                <button class="btn btn-primary btn-sm" @click="handleNavigation('dashboard')">Go to Dashboard</button>
                            </div>

                            <div v-else-if="view !== 'login' && !loading.app && !['dashboard', 'participants', 'sessions', 'attendance', 'admin'].includes(view)" class="p-4 text-center text-muted">
                                <p v-if="view === 'attendance' && !selectedSession">Please select a session to view attendance.</p>
                                <p v-else>View not found or content is loading.</p>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            <div class="offcanvas offcanvas-start d-lg-none" tabindex="-1" id="mobileNavOffcanvas" aria-labelledby="mobileNavOffcanvasLabel">
                <div class="offcanvas-header border-bottom">
                    <h5 class="offcanvas-title d-flex align-items-center" id="mobileNavOffcanvasLabel">
                        <ListCheck :size="24" class="me-2 text-primary" /> Menu
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div class="offcanvas-body d-flex flex-column">
                    <ul class="nav nav-pills flex-column sidebar mb-auto">
                        <li class="nav-item">
                            <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'dashboard' }" @click.prevent="handleNavigation('dashboard')" data-bs-dismiss="offcanvas">
                                <BarChart2 class="me-2 flex-shrink-0" :size="20" /> Tableau de bord
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'participants' }" @click.prevent="handleNavigation('participants')" data-bs-dismiss="offcanvas">
                                <Users class="me-2 flex-shrink-0" :size="20" /> Participants
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'sessions' || view === 'attendance' }" @click.prevent="handleNavigation('sessions')" data-bs-dismiss="offcanvas">
                                <Calendar class="me-2 flex-shrink-0" :size="20" /> Sessions
                            </a>
                        </li>
                        <li v-if="isAdmin" class="nav-item">
                            <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'admin' }" @click.prevent="handleNavigation('admin')" data-bs-dismiss="offcanvas">
                                <Settings class="me-2 flex-shrink-0" :size="20" /> Gestion d'administration
                            </a>
                        </li>
                    </ul>
                    <div class="mt-auto pt-2 border-top">
                         <a href="#" class="nav-link d-flex align-items-center" @click.prevent="handleLogout()" data-bs-dismiss="offcanvas">
                            <LogOut class="me-2 flex-shrink-0" :size="20" /> Logout
                        </a>
                    </div>
                </div>
            </div>

           <BaseModal v-model:show="showParticipantModal" :title="editingParticipant ? 'Edit Participant' : 'Add New Participant'" size="modal-lg" @close="editingParticipant = null">
                <ParticipantForm ref="participantFormRef" :initialParticipant="editingParticipant" :participants="participants" :saving="saving" @save="handleSaveParticipant" @cancel="showParticipantModal = false"/>
                <template #footer>
                    <button type="button" class="btn btn-outline-secondary btn-sm" @click="showParticipantModal = false" :disabled="saving">Annuler</button>
                    <button type="button" class="btn btn-primary btn-sm d-flex align-items-center" @click="participantFormRef?.submit()" :disabled="saving">
                        <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        <Save v-else class="me-2" :size="16" />
                        {{ saving ? (editingParticipant ? 'Saving...' : 'Adding...') : (editingParticipant ? 'Save Changes' : 'Add Participant') }}
                    </button>
                </template>
            </BaseModal>
            <BaseModal v-model:show="showSessionModal" title="Add New Study Session" @close="showSessionModal = false">
                <SessionForm ref="sessionFormRef" :saving="saving" @save="handleSaveSession" @cancel="showSessionModal = false"/>
                <template #footer>
                    <button type="button" class="btn btn-outline-secondary btn-sm" @click="showSessionModal = false" :disabled="saving">Annuler</button>
                    <button type="button" class="btn btn-primary btn-sm d-flex align-items-center" @click="sessionFormRef?.submit()" :disabled="saving">
                        <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        <Save v-else class="me-2" :size="16" />
                        {{ saving ? 'Adding...' : 'Add Session' }}
                    </button>
                </template>
            </BaseModal>
            <BaseModal v-model:show="showUnsavedModal" title="Modifications non enregistrées">
                <p>Vous avez des changements non enregistrés dans la feuille de présence. Voulez-vous les abandonner ?</p>
                <template #footer>
                    <button class="btn btn-outline-secondary btn-sm" @click="cancelUnsavedNavigation">Annuler</button>
                    <button class="btn btn-danger btn-sm" @click="discardUnsavedChanges">Abandonner les changements</button>
                </template>
            </BaseModal>

            <footer class="app-footer text-center text-muted small py-3 bg-white border-top mt-auto">
                IMPACT2025 - Mahabo &copy; {{ new Date().getFullYear() }}
            </footer>
        </div>
    </div>
</template>

<style>
/* Assuming these are correctly imported from external CSS files */
@import './assets/styles/app.css';
@import './assets/styles/auth.css';
@import './assets/styles/header.css';
@import './assets/styles/sidebar.css';
@import './assets/styles/global.css';
@import './assets/styles/scrollbar.css';

/* Add a specific style if needed, e.g., for the app-wrapper if you have two */
#app-wrapper { /* If this is your true root for Vue app instance */
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}
</style>
