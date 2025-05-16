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

// Import Icons
import { BookOpen, Users, Calendar, AlertCircle, Save, PlusCircle, UserCheck, BarChart2, Settings, LogOut, ChevronDown, Menu, List, ChurchIcon, ListCheck } from 'lucide-vue-next';

// --- Configuration ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- State ---
const view = ref(''); // Start with no view, determine in onMounted
const participants = ref([]);
const sessions = ref([]);
const selectedSession = ref(null);
const currentAttendance = ref([]);
const installPromptEvent = ref(null);

const loading = reactive({
  participants: false,
  sessions: false,
  attendance: false,
  app: true,
});
const saving = ref(false);
const error = ref(null);
const successNotification = ref({ show: false, message: '', participantId: null });
const isMobileNavOpen = ref(false);

// Authentication state
const loggedIn = ref(false);
const showRegistration = ref(false); // Controls visibility between LoginView and RegistrationView

// --- Modal State & Refs ---
const showParticipantModal = ref(false);
const editingParticipant = ref(null);
const participantFormRef = ref(null);

const showSessionModal = ref(false);
const sessionFormRef = ref(null);

const attendanceRef = ref(null);

// --- API Call Function ---
// In App.vue <script setup>

async function apiCall(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            // Authorization header will be added here
        },
    };

    // Retrieve the token from localStorage (or wherever you store it)
    const token = localStorage.getItem('authToken');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    } else {
        // Optional: If a route absolutely requires a token and it's not there,
        // you might want to prevent the API call or redirect to login.
        // For now, the server will deny access if the token is required and missing.
        console.warn(`No auth token found for API call to ${url}`);
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    // Your loading/saving state management
    if (method !== 'GET') saving.value = true; // Or a more generic loading state
    error.value = null; // Clear previous errors

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, options);
        const data = await response.json();

        if (!response.ok) {
            // Prefer error message from API response if available
            const errorMessage = data?.error || `API Error: ${response.status} ${response.statusText}`;
            const errorDetails = data?.details || '';
            console.error(`API call failed to ${url}:`, errorMessage, errorDetails);
            throw new Error(data?.error || `${response.status} ${response.statusText}`);
        }
        return data;
    } catch (err) {
        console.error(`Error in apiCall to ${url}:`, err);
        error.value = err.message || 'An unexpected error occurred.';
        throw err; // Re-throw so the calling component can also catch it if needed
    } finally {
        if (method !== 'GET') saving.value = false; // Or a more generic loading state
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
        attendanceRef.value.hasUnsavedChanges = false; // Reset flag in child
    }

    if (pendingNavigationTarget.value === 'sessions') {
        selectedSession.value = null;
        currentAttendance.value = [];
    }
    if (pendingNavigationTarget.value) {
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
    loading.participants = true; error.value = null;
    try { participants.value = await apiCall('/participants'); }
    catch (err) { /* Handled by apiCall */ }
    finally { loading.participants = false; }
};
const fetchSessions = async () => {
    loading.sessions = true; error.value = null;
    try { sessions.value = await apiCall('/sessions'); }
    catch (err) { /* Handled by apiCall */ }
    finally { loading.sessions = false; }
};

const fetchInitialData = async () => {
    loading.app = true; error.value = null;
    try {
        const token = localStorage.getItem('authToken');
        if (token) {
            // Here you might want to verify the token with the backend
            // For now, we assume if a token exists, the user is logged in
            loggedIn.value = true;
            view.value = 'dashboard'; // Default view after login
            await Promise.all([fetchParticipants(), fetchSessions()]);
        } else {
            loggedIn.value = false;
            view.value = 'login'; // Default view if not logged in
            showRegistration.value = false; // Ensure registration form is hidden initially
        }
    } catch (err) {
        // If fetching initial data fails (e.g. token invalid), log out user
        console.error("Error fetching initial data or invalid token:", err);
        loggedIn.value = false;
        localStorage.removeItem('authToken');
        view.value = 'login';
        showRegistration.value = false;
        // error.value is already set by apiCall if it's an API error
    }
    finally { loading.app = false; }
};

onMounted(fetchInitialData);

const fetchAttendanceForSession = async (sessionId) => {
    if (!sessionId) return;
    loading.attendance = true; error.value = null; currentAttendance.value = [];
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
    // If user is not logged in, only allow navigation to 'login' or if they are already on 'login' (which covers the registration flow)
    if (!loggedIn.value && newView !== 'login' && view.value !== 'login') {
        view.value = 'login';
        showRegistration.value = false; // Ensure registration form is hidden when redirecting to login
        return;
    }

    const okToNavigate = await confirmIfUnsavedChanges(newView);
    if (!okToNavigate) return;

    view.value = newView;
    isMobileNavOpen.value = false; // Close mobile nav if open

    if (newView === 'sessions' || newView === 'dashboard') {
        selectedSession.value = null;
        currentAttendance.value = [];
    }
    // Scroll to top of main content area on view change
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
    editingParticipant.value = { ...participant }; // Clone to avoid direct mutation if form is cancelled
    showParticipantModal.value = true;
};

const handleSaveParticipant = async (participantData) => {
    let apiError = null;
    try {
        let savedParticipant;
        if (editingParticipant.value?.id) {
            savedParticipant = await apiCall(`/participants/${editingParticipant.value.id}`, 'PUT', participantData);
            successNotification.value = { show: true, message: `Participant "${participantData.name}" updated.`, details: '' };
        } else {
            savedParticipant = await apiCall('/participants', 'POST', participantData);
            successNotification.value = { show: true, message: `Participant "${savedParticipant.name}" created.`, details: `ID: ${savedParticipant.id}` };
        }
        showParticipantModal.value = false;
        await fetchParticipants(); // Refresh participant list
    } catch (err) { apiError = error.value; /* error.value is set by apiCall */ }
    finally { setTimeout(() => successNotification.value.show = false, 4000); }
    return apiError; // Return error to form for display if needed
};
const handleDeleteParticipant = async (participantId) => {
    const pToDelete = participants.value.find(p => p.id === participantId);
    if (window.confirm(`Delete "${pToDelete?.name || 'this participant'}"? This action cannot be undone.`)) {
        try {
            await apiCall(`/participants/${participantId}`, 'DELETE');
            successNotification.value = { show: true, message: `Participant "${pToDelete?.name || 'ID: '+participantId}" deleted.`, details: '' };
            await fetchParticipants(); // Refresh list
            // If current view is attendance for a session, refresh attendance data as participant is gone
            if (view.value === 'attendance' && selectedSession.value) {
                await fetchAttendanceForSession(selectedSession.value.id);
            }
        } catch (err) { /* Handled by apiCall */ }
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
        showSessionModal.value = false;
        await fetchSessions(); // Refresh session list
    } catch (err) { apiError = error.value; }
    finally { setTimeout(() => successNotification.value.show = false, 4000); }
    return apiError;
};
const handleDeleteSession = async (sessionId) => {
    const sToDelete = sessions.value.find(s => s.id === sessionId);
    if (window.confirm(`Delete session for ${formatDateForDisplay(sToDelete?.session_date)} and all its attendance records? This action cannot be undone.`)) {
        try {
            await apiCall(`/sessions/${sessionId}`, 'DELETE');
            successNotification.value = { show: true, message: `Session for ${formatDateForDisplay(sToDelete?.session_date)} deleted.`, details: '' };
            await fetchSessions(); // Refresh list
            // If the deleted session was being viewed for attendance, go back to sessions list
            if (view.value === 'attendance' && selectedSession.value?.id === sessionId) {
                handleBackToSessions(); // This already handles unsaved changes confirmation
            }
        } catch (err) { /* Handled by apiCall */ }
        finally { setTimeout(() => successNotification.value.show = false, 4000); }
    }
};

// --- Attendance Actions ---
const handleViewAttendance = async (session) => {
    // No need to confirm unsaved changes here, as we are navigating TO attendance
    selectedSession.value = session;
    view.value = 'attendance';
    await fetchAttendanceForSession(session.id);
};
const handleBackToSessions = async () => {
    const okToNavigate = await confirmIfUnsavedChanges('sessions');
    if (!okToNavigate) return;

    selectedSession.value = null;
    currentAttendance.value = [];
    view.value = 'sessions';
};

const handleSaveAttendance = async (attendanceData) => {
    if (!selectedSession.value) return 'Error: No session selected.';
    let apiError = null;
    try {
        // Backend should handle upsert logic (create or update)
        const payload = attendanceData.map(att => ({
            session_id: selectedSession.value.id,
            participant_id: att.participant_id,
            attended: att.attended,
            notes: att.notes
        }));
        await apiCall('/attendance', 'POST', { attendance: payload }); // Assuming backend expects a list under an 'attendance' key or similar
        successNotification.value = { show: true, message: `Attendance for ${formatDateForDisplay(selectedSession.value.session_date)} saved.`, details: '' };
        if(attendanceRef.value) attendanceRef.value.hasUnsavedChanges = false; // Reset flag
    } catch (err) {
        apiError = error.value || 'Failed to save one or more attendance records.';
    } finally {
        setTimeout(() => successNotification.value.show = false, 4000);
    }
    return apiError;
};

// In App.vue <script setup>

// --- Authentication Methods ---
const handleLogin = async (credentials) => {
    saving.value = true;
    error.value = null;
    try {
        // Make the REAL API call to your backend
        const responseData = await apiCall('/auth/login', 'POST', credentials);

        if (responseData && responseData.token) {
            // Store the ACTUAL token received from the server
            localStorage.setItem('authToken', responseData.token);
            loggedIn.value = true;
            await fetchInitialData(); // This will fetch data and potentially set view to 'dashboard'
        } else {
            // This case should ideally be handled by apiCall throwing an error
            // or by the server returning a non-OK status that apiCall handles.
            throw new Error("Login failed: No token received from server.");
        }
    } catch (err) {
        // error.value should be set by apiCall if it fails
        // If apiCall doesn't set error.value, you might need to set it here:
        // error.value = err.message || "Login failed.";
        loggedIn.value = false;
        // Ensure error from apiCall is displayed to the user via the `error` ref
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
        // Make the REAL API call to your backend
        const responseData = await apiCall('/auth/register', 'POST', userData);

        if (responseData && responseData.token) {
            // Store the ACTUAL token received from the server
            localStorage.setItem('authToken', responseData.token);
            loggedIn.value = true;
            showRegistration.value = false; // Hide registration form
            await fetchInitialData(); // This will fetch data and potentially set view to 'dashboard'
        } else {
            throw new Error("Registration failed: No token received from server.");
        }
    } catch (err) {
        // error.value should be set by apiCall if it fails
        // error.value = err.message || "Registration failed.";
        // Potentially keep registration form open on error, or provide specific feedback
        // loggedIn.value = false; // User is not logged in if registration fails
    } finally {
        saving.value = false;
    }
};



const handleLogout = async () => {
    const okToNavigate = await confirmIfUnsavedChanges('login'); // Check for unsaved changes before logging out
    if (!okToNavigate) return;

    // await apiCall('/auth/logout', 'POST'); // Optional: Call backend to invalidate token
    localStorage.removeItem('authToken');
    loggedIn.value = false;
    participants.value = []; // Clear data
    sessions.value = [];
    selectedSession.value = null;
    currentAttendance.value = [];
    view.value = 'login'; // Navigate to login screen
    showRegistration.value = false; // Ensure registration form is hidden
    error.value = null; // Clear any global errors
};


// --- Computed Properties ---
const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    try {
        // Assuming dateString is in 'YYYY-MM-DD' or a format Date can parse correctly
        // To ensure correct display regardless of user's local timezone issues with UTC dates,
        // it's often better to parse it as UTC if it is, or treat it as local if it is.
        // If your dates from backend are simple 'YYYY-MM-DD', they might be parsed as UTC midnight.
        const date = new Date(dateString + 'T00:00:00'); // Treat as local time midnight to avoid timezone shifts from UTC
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        console.warn("Error formatting date:", dateString, e);
        return dateString; // Fallback
    }
};

</script>

<template>
    <div class="app-wrapper d-flex flex-column bg-body-tertiary min-vh-100">
        <div v-if="!loggedIn" class="d-flex flex-column justify-content-center align-items-center min-vh-100 p-3">
            <div class="auth-form-container" style="max-width: 400px; width: 100%;">
                <div class="text-center mb-4">
                    <img :src="logo" alt="Logo" style="width: 80px; height: 80px; margin-bottom: 1rem;" />
                    <h1 class="h3 mb-1 fw-bold app-title">IMPACT 2025</h1>
                    <p class="mb-0 text-muted" style="line-height: 1.2;">Ho avy indray i Jesosy</p>
                </div>

                <LoginView
                    v-if="!showRegistration"
                    @login="handleLogin"
                    @show-register-form="displayRegistrationForm"
                    :loading="saving"
                    :error-message="error"
                />
                <RegistrationView
                    v-else
                    @register="processRegistration"
                    @cancel="showRegistration = false"
                    :loading="saving"
                    :error-message="error"
                />
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
                <div class="toast show align-items-center text-bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="d-flex">
                        <div class="toast-body">
                            {{ successNotification.message }}
                            <small v-if="successNotification.details" class="d-block opacity-75">{{ successNotification.details }}</small>
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" @click="successNotification.show = false" aria-label="Close"></button>
                    </div>
                </div>
            </div>

            <div class="app-body container-fluid flex-grow-1 d-flex">
                <div class="row flex-grow-1 w-100 gx-0">
                    <nav class="col-lg-2 d-none d-lg-block bg-white sidebar shadow-sm">
                        <div class="sticky-top inner-sidebar-scroll">
                            <ul class="nav nav-pills flex-column mb-auto px-2">
                                <li class="nav-item">
                                    <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'dashboard' }" @click.prevent="handleNavigation('dashboard')">
                                        <BarChart2 class="me-2 flex-shrink-0" :size="18" /> Dashboard
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
                                <li class="nav-item">
                                    <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'admin'}" @click.prevent="handleNavigation('admin')">
                                        <Settings class="me-2 flex-shrink-0" :size="18" /> Admin
                                    </a>
                                </li>
                                <li class="nav-item mt-auto pt-2 border-top">
                                    <a href="#" class="nav-link d-flex align-items-center" @click.prevent="handleLogout" data-bs-dismiss="offcanvas">
                                        <LogOut class="me-2 flex-shrink-0" :size="20" /> Logout
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </nav>

                    <main id="mainContentArea" class="col-12 col-lg-10 main-content-area">
                        <div v-if="loading.app && !loggedIn" class="d-flex justify-content-center align-items-center h-100 text-muted p-5">
                            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"></div>
                            <p class="ms-3 fs-5">Chargement de l'Application...</p>
                        </div>
                        <div v-else-if="loggedIn" class="h-100"> <div v-if="view === 'dashboard'" class="view-wrapper px-md-4 py-3 h-100">
                                <DashboardView @navigate="handleNavigation" :participants-count="participants.length" :sessions-count="sessions.length" class="w-100 h-100" />
                            </div>
                            <div v-else-if="view === 'participants'" class="view-wrapper px-md-4 py-3 h-100 d-flex flex-column">
                                <ParticipantList class="flex-grow-1"
                                    :participants="participants"
                                    :loading="loading.participants"
                                    @add-new-participant="handleAddParticipantRequest"
                                    @edit-participant="handleEditParticipantRequest"
                                    @delete-participant="handleDeleteParticipant"
                                />
                            </div>
                            <div v-else-if="view === 'sessions'" class="view-wrapper px-md-4 py-3 h-100 d-flex flex-column">
                                <SessionList class="flex-grow-1"
                                    :sessions="sessions"
                                    :loading="loading.sessions"
                                    @add-new-session="handleAddSessionRequest"
                                    @view-attendance="handleViewAttendance"
                                    @delete-session="handleDeleteSession"
                                    :format-date="formatDateForDisplay"
                                />
                            </div>
                            <div v-else-if="view === 'attendance' && selectedSession" class="view-wrapper px-md-4 py-3 h-100">
                                <AttendanceTracker
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
                            </div>
                            <div v-if="view === 'admin'" class="view-wrapper px-md-4 py-3">
                                <Admin :api-call="apiCall" />
                            </div>
                             <div v-else-if="view !== 'login' && !loading.app" class="p-4 text-center text-muted">
                                <p v-if="view === 'attendance' && !selectedSession">Please select a session to view attendance.</p>
                                <p v-else>Loading content or view not found.</p>
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
                <div class="offcanvas-body">
                    <ul class="nav nav-pills flex-column sidebar">
                        <li class="nav-item">
                            <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'dashboard' }" @click.prevent="handleNavigation('dashboard')" data-bs-dismiss="offcanvas">
                                <BarChart2 class="me-2 flex-shrink-0" :size="20" /> Dashboard
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
                        <li class="nav-item">
                            <a href="#" class="nav-link d-flex align-items-center" :class="{ 'active': view === 'admin' }" @click.prevent="handleNavigation('admin')" data-bs-dismiss="offcanvas">
                                <Settings class="me-2 flex-shrink-0" :size="20" /> Admin
                            </a>
                        </li>
                         <li class="nav-item mt-auto pt-2 border-top">
                             <a href="#" class="nav-link d-flex align-items-center" @click.prevent="handleLogout" data-bs-dismiss="offcanvas">
                                <LogOut class="me-2 flex-shrink-0" :size="20" /> Logout
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            <BaseModal v-model:show="showParticipantModal" :title="editingParticipant ? 'Edit Participant' : 'Add New Participant'" size="modal-lg" @close="editingParticipant = null">
                <ParticipantForm ref="participantFormRef" :initialParticipant="editingParticipant" :participants="participants" :saving="saving" @save="handleSaveParticipant" @cancel="showParticipantModal = false; editingParticipant = null;" />
                <template #footer>
                    <button type="button" class="btn btn-outline-secondary btn-sm" @click="showParticipantModal = false; editingParticipant = null;" :disabled="saving">Annuler</button>
                    <button type="button" class="btn btn-primary btn-sm d-flex align-items-center" @click="participantFormRef?.submit()" :disabled="saving">
                        <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        <Save v-else class="me-2" :size="16" />
                        {{ saving ? (editingParticipant ? 'Saving...' : 'Adding...') : (editingParticipant ? 'Save Changes' : 'Add Participant') }}
                    </button>
                </template>
            </BaseModal>
            <BaseModal v-model:show="showSessionModal" title="Add New Study Session" @close="showSessionModal = false">
                <SessionForm ref="sessionFormRef" :saving="saving" @save="handleSaveSession" @cancel="showSessionModal = false" />
                <template #footer>
                    <button type="button" class="btn btn-outline-secondary btn-sm" @click="showSessionModal = false" :disabled="saving">Annuler</button>
                    <button type="button" class="btn btn-primary btn-sm d-flex align-items-center" @click="sessionFormRef?.submit()" :disabled="saving">
                        <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        <Save v-else class="me-2" :size="16" />
                        {{ saving ? 'Adding...' : 'Add Session' }}
                    </button>
                </template>
            </BaseModal>
            <BaseModal v-model:show="showUnsavedModal" title="Unsaved Changes" size="modal-md">
                <p>You have unsaved changes. Are you sure you want to discard them?</p>
                <template #footer>
                    <button class="btn btn-outline-secondary btn-sm" @click="cancelUnsavedNavigation">Cancel</button>
                    <button class="btn btn-danger btn-sm" @click="discardUnsavedChanges">Discard Changes</button>
                </template>
            </BaseModal>

            <footer class="app-footer text-center text-muted small py-3 bg-white border-top mt-auto">
                IMPACT2025 - Mahabo &copy; {{ new Date().getFullYear() }}
            </footer>
        </div>
    </div>
</template>

<style>
/* Ensure Bootstrap CSS is linked in your main.js or index.html for this to work fully */
/* For example: import 'bootstrap/dist/css/bootstrap.min.css'; in main.js */

html,
body {
    height: 100%;
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: #f0f2f5; /* Applied to body, app-wrapper will overlay if it has its own bg */
}

#app { /* This is usually the root element Vue mounts to, ensure app-wrapper is the direct child if #app has flex */
    min-height: 100vh;
    display: flex; /* This might conflict if app-wrapper is also trying to be the main flex container */
    flex-direction: column;
}

.app-wrapper {
    /* This is the main container, ensure it takes full height */
    min-height: 100vh;
    /* background-color: #f8f9fa; /* A slightly off-white background for the whole app */
}
.auth-form-container {
    background-color: #ffffff;
    padding: 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.1);
}


/* --- UPDATED HEADER STYLES --- */
.app-header {
    background: linear-gradient(to right, var(--bs-primary, #0d6efd), var(--bs-primary-dark, #0a58ca));
    padding-top: 0.75rem !important;
    padding-bottom: 0.75rem !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.app-header .app-title,
.app-header .app-title-mobile {
    font-weight: 600;
    letter-spacing: 0.5px;
}

.app-header .mobile-nav-toggle {
    border: 1px solid rgba(255, 255, 255, 0.3);
    background-color: transparent;
    transition: background-color 0.2s ease;
}

.app-header .mobile-nav-toggle:hover,
.app-header .mobile-nav-toggle:focus {
    background-color: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.7);
}

/* --- END OF UPDATED HEADER STYLES --- */


.global-alert {
    z-index: 1056; /* Above most Bootstrap components but below modals (1060+) */
    position: sticky;
    top: 0; /* Stick to top of viewport */
}
/* If header is also sticky, adjust top for global-alert */
.app-header.sticky-top ~ .global-alert { /* This selector might need adjustment based on actual DOM structure */
    top: 62px; /* Adjust based on actual header height */
}


.sidebar {
    background-color: #fff; /* Ensure sidebar has a background */
}

.sidebar .inner-sidebar-scroll {
    /* Adjust height based on your header's actual rendered height */
    /* For example, if header is 62px, and you want 1rem padding below it: */
    height: calc(100vh - 62px - 1rem); /* (Viewport Height - Header Height - Top Padding) */
    overflow-y: auto;
    padding-top: 0.5rem; /* Padding for the content inside the scrollable area */
}


.sidebar .nav-link {
    font-weight: 500;
    color: #495057; /* Dark grey for text */
    padding: 0.6rem 0.75rem;
    border-radius: 0.3rem; /* Softer corners */
    margin-bottom: 0.125rem; /* Small gap between items */
    transition: background-color 0.15s ease, color 0.15s ease;
}

.sidebar .nav-link .lucide {
    color: var(--bs-primary); /* Icon color matches primary theme */
    transition: color 0.15s ease;
    margin-right: 0.65rem !important; /* Consistent spacing */
}

.sidebar .nav-link:hover {
    background-color: #e9ecef; /* Light grey hover */
    color: var(--bs-primary); /* Text color changes to primary on hover */
}

.sidebar .nav-link:hover .lucide {
    color: var(--bs-primary);
}

.sidebar .nav-link.active {
    background-image: linear-gradient(to right, var(--bs-primary), #20c997); /* Example: Primary to a teal */
    color: white;
    font-weight: 500; /* Or 600 for more emphasis */
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); /* Subtle shadow for depth */
}

.sidebar .nav-link.active .lucide {
    color: white; /* Icons in active link are white */
}

.main-content-area {
    overflow-y: auto; /* Changed from scroll to auto to only show scrollbar when needed */
    background-color: #f0f2f5; /* Light background for content area */
    /* padding: 1rem; /* Add some padding around the content views */
}
/* If using view-wrapper for padding, main-content-area might not need it */


.view-wrapper {
    /* This wrapper inside main-content-area now holds the padding */
}

/* Ensure that flex children of view-wrapper can scroll if they overflow */
.view-wrapper.d-flex.flex-column > .flex-grow-1 {
    overflow-y: auto; /* Allow this specific child to scroll */
    min-height: 0; /* Important for flex children to scroll correctly */
}


.offcanvas-start {
    width: 280px; /* Standard mobile nav width */
}

.offcanvas-body .nav-link {
    font-size: 1rem; /* Slightly larger for touch targets */
    padding: 0.75rem 1rem;
}

.offcanvas-body .nav-link.active {
    background-color: var(--bs-primary);
    color: white;
}

.offcanvas-body .nav-link .lucide {
    margin-right: 0.75rem;
}

.toast-container {
    z-index: 1100 !important; /* Ensure toasts are on top */
}

.toast.show {
    display: block !important; /* Override Bootstrap's default if necessary */
}

.app-footer {
    font-size: 0.8rem;
    background-color: #ffffff; /* Match sidebar/header parts for consistency */
    border-top: 1px solid #dee2e6; /* Standard Bootstrap border color */
}

/* Custom Scrollbar (optional, for aesthetics) */
::-webkit-scrollbar {
    width: 6px;  /* Thinner scrollbar */
    height: 6px;
}

::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05); /* Lighter track */
}

::-webkit-scrollbar-thumb {
    background: #ced4da; /* Standard Bootstrap muted color */
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: #adb5bd; /* Darken on hover */
}

/* Specific scrollbar for sidebar if needed */
.sidebar .inner-sidebar-scroll::-webkit-scrollbar-thumb {
    background: #e0e0e0;
}
.sidebar .inner-sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background: #c0c0c0;
}

</style>
