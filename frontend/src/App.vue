<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Import Child Components
import BaseModal from './components/BaseModal.vue';
import ParticipantForm from './components/ParticipantForm.vue';
import ParticipantList from './components/ParticipantList.vue';
import SessionForm from './components/SessionForm.vue';
import SessionList from './components/SessionList.vue';
import AttendanceTracker from './components/AttendanceTracker.vue';
import DashboardView from './components/DashboardView.vue';
// import AdminView from './components/AdminView.vue'; // Assuming you might create this

// Import Icons
import { BookOpen, Users, Calendar, AlertCircle, Save, PlusCircle, UserCheck, BarChart2, Settings, LogOut, ChevronDown, Menu, List, ChurchIcon, ListCheck } from 'lucide-vue-next'; // Changed ChevronDown to Menu for mobile toggle
import Admin from './components/Admin.vue';

// --- Configuration ---
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; 
const API_BASE_URL = 'http://localhost:3001/api'; 

// --- State ---
const view = ref('dashboard');
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
const successNotification = ref({ show: false, message: '', details: '' });
const isMobileNavOpen = ref(false);

// --- Modal State & Refs ---
const showParticipantModal = ref(false);
const editingParticipant = ref(null);
const participantFormRef = ref(null);

const showSessionModal = ref(false);
const sessionFormRef = ref(null);

// --- API Call Function (remains the same) ---
async function apiCall(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    if (method !== 'GET') saving.value = true;
    let errorMessage = null;
    try {
        const response = await fetch(`${API_BASE_URL}${url}`, options);
        const data = await response.json();
        if (!response.ok) {
            errorMessage = `Error: ${data?.error || response.statusText}.`;
            if (data?.details) errorMessage += ` Details: ${data.details}`;
            throw new Error(errorMessage);
        }
        error.value = null;
        return data;
    } catch (err) {
        if (!errorMessage) errorMessage = `Network error. Is backend running?`;
        error.value = errorMessage;
        throw err;
    } finally {
       if(method !== 'GET') saving.value = false;
    }
}

// --- Data Fetching (remains the same) ---
const fetchParticipants = async () => {
    loading.participants = true; error.value = null;
    try { participants.value = await apiCall('/participants'); }
    catch (err) { /* Handled */ }
    finally { loading.participants = false; }
};
const fetchSessions = async () => {
    loading.sessions = true; error.value = null;
    try { sessions.value = await apiCall('/sessions'); }
    catch (err) { /* Handled */ }
    finally { loading.sessions = false; }
};
const fetchInitialData = async () => {
    loading.app = true; error.value = null;
    try { await Promise.all([fetchParticipants(), fetchSessions()]); }
    catch (err) { /* Handled */ }
    finally { loading.app = false; }
};
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
    } catch (err) { /* Handled */ }
    finally { loading.attendance = false; }
};
onMounted(fetchInitialData);

// --- Navigation (remains the same) ---
const handleNavigation = (newView) => {
  view.value = newView;
  isMobileNavOpen.value = false;
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
        showParticipantModal.value = false; await fetchParticipants();
    } catch (err) { apiError = error.value; }
    finally { setTimeout(() => successNotification.value.show = false, 4000); }
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
const handleBackToSessions = () => {
    selectedSession.value = null; currentAttendance.value = []; view.value = 'sessions';
};
const handleSaveAttendance = async (attendanceData) => {
    if (!selectedSession.value) return 'Error: No session selected.';
    let apiError = null;
    try {
        const promises = attendanceData.map(att =>
            apiCall('/attendance', 'POST', {
                session_id: selectedSession.value.id,
                participant_id: att.participant_id,
                attended: att.attended,
                notes: att.notes
            })
        );
        await Promise.all(promises);
    } catch (err) { apiError = error.value || 'Failed to save one or more attendance records.'; }
    return apiError;
};

// --- Computed Properties (remains the same) ---
const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return dateString; }
};

</script>

<template>
    <div class="app-wrapper d-flex flex-column bg-body-tertiary min-vh-100">
        <header class="app-header text-white shadow-sm">
            <div class="container-fluid d-flex align-items-center justify-content-between py-3 px-3 px-md-4"> 
                <div class="d-flex align-items-center">
                    <ChurchIcon :size="30" class="me-2 flex-shrink-0 app-logo-icon" />
                    
                    <!-- Desktop Title and Subtitle -->
                    <div class="d-none d-sm-block"> 
                        <h1 class="h5 mb-0 fw-bold app-title">IMPACT 2025</h1>
                        <p class="mb-0 small text-white-50" style="line-height: 1.2;">Hoavy indray Jesosy</p>
                    </div>

                    <!-- Mobile Title -->
                    <div class="d-sm-none"> 
                        <h1 class="h5 mb-0 fw-bold app-title-mobile">Impact25</h1>
                        <!-- If you want the subtitle on mobile as well, you can add it here: -->
                        <!-- <p class="mb-0 small text-white-50" style="line-height: 1.2;">Hoavy indray Jesosy</p> -->
                    </div>
                </div>
                <button class="btn btn-outline-light d-lg-none p-1 mobile-nav-toggle" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNavOffcanvas" aria-controls="mobileNavOffcanvas" aria-label="Toggle navigation">
                    <Menu :size="24" />
                </button>
            </div>
        </header>

        <div v-if="error" class="global-alert alert alert-danger alert-dismissible fade show border-0 rounded-0 m-0 py-2 small" role="alert">
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
                        </ul>
                    </div>
                </nav>

                
                <main id="mainContentArea" class="col-12 col-lg-10 main-content-area">
                    <div v-if="loading.app" class="d-flex justify-content-center align-items-center h-100 text-muted p-5">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"></div>
                        <p class="ms-3 fs-5">Loading Application...</p>
                    </div>
                    <div v-else class="h-100">
                        <div v-if="view === 'dashboard'" class="view-wrapper px-md-4 py-3 h-100">
                            <DashboardView @navigate="handleNavigation" class="w-100 h-100" />
                        </div>
                        
                        <div v-if="view === 'participants'" class="view-wrapper px-md-4 py-3 h-100 d-flex flex-column">
                            <ParticipantList class="flex-grow-1"
                                :participants="participants"
                                :loading="loading.participants"
                                @add-new-participant="handleAddParticipantRequest"
                                @edit-participant="handleEditParticipantRequest"
                                @delete-participant="handleDeleteParticipant"
                            />
                        </div>

                        <div v-if="view === 'sessions'" class="view-wrapper px-md-4 py-3 h-100 d-flex flex-column">
                            <SessionList class="flex-grow-1"
                                :sessions="sessions"
                                :loading="loading.sessions"
                                @add-new-session="handleAddSessionRequest"
                                @view-attendance="handleViewAttendance"
                                @delete-session="handleDeleteSession"
                            />
                        </div>

                        <div v-if="view === 'attendance' && selectedSession" class="view-wrapper px-md-4 py-3 h-100">
                            <AttendanceTracker 
                                :session="selectedSession"
                                :participants="participants"
                                :initial-attendance="currentAttendance"
                                :loading="loading.attendance"
                                :saving="saving"
                                @back="handleBackToSessions"
                                @save-attendance="handleSaveAttendance"
                                @delete-session="handleDeleteSession"
                            />
                        </div>
                        
                        <div v-if="view === 'admin'" class="view-wrapper px-md-4 py-3 text-center">
                             <Admin />
                            </div>
                    </div>
                </main>
            </div>
        </div>

        <div class="offcanvas offcanvas-start d-lg-none" tabindex="-1" id="mobileNavOffcanvas" aria-labelledby="mobileNavOffcanvasLabel">
            <div class="offcanvas-header border-bottom">
                <h5 class="offcanvas-title d-flex align-items-center" id="mobileNavOffcanvasLabel">
                    <ListCheck  :size="24" class="me-2 text-primary" /> Menu
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
                </ul>
            </div>
        </div>

      
        <BaseModal v-model:show="showParticipantModal" :title="editingParticipant ? 'Edit Participant' : 'Add New Participant'" size="modal-lg" @close="editingParticipant = null">
             <ParticipantForm ref="participantFormRef" :initialParticipant="editingParticipant" :participants="participants" :saving="saving" @save="handleSaveParticipant" @cancel="showParticipantModal = false"/>
             <template #footer>
                 <button type="button" class="btn btn-outline-secondary btn-sm" @click="showParticipantModal = false" :disabled="saving">Cancel</button>
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
                 <button type="button" class="btn btn-outline-secondary btn-sm" @click="showSessionModal = false" :disabled="saving">Cancel</button>
                 <button type="button" class="btn btn-primary btn-sm d-flex align-items-center" @click="sessionFormRef?.submit()" :disabled="saving">
                    <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    <Save v-else class="me-2" :size="16" />
                    {{ saving ? 'Adding...' : 'Add Session' }}
                 </button>
             </template>
         </BaseModal>

        <footer class="app-footer text-center text-muted small py-3 bg-white border-top mt-auto">
            IMPACT2025 - Madagascar &copy; {{ new Date().getFullYear() }}
        </footer>
    </div>
</template>

<style>
html, body {
  height: 100%;
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #f0f2f5;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* --- UPDATED HEADER STYLES --- */
.app-header {
    /* background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%); */ /* Primary to darker primary */
    background: linear-gradient(to right, var(--bs-primary), var(--bs-primary-dark, #7472d3)); /* Use Bootstrap CSS var if available, else fallback */
    /* Or try a different gradient: */
    /* background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); /* Dark blue to lighter blue */
    padding-top: 0.75rem !important; /* py-3 equivalent */
    padding-bottom: 0.75rem !important;
    border-bottom: 1px solid rgba(0,0,0,0.1); /* Subtle border */
}
.app-header .app-title, .app-header .app-title-mobile {
    font-weight: 600; /* Slightly bolder title */
    letter-spacing: 0.5px;
}
.app-header .mobile-nav-toggle {
    border: 1px solid rgba(255,255,255,0.3);
    background-color: transparent;
    transition: background-color 0.2s ease;
}
.app-header .mobile-nav-toggle:hover,
.app-header .mobile-nav-toggle:focus {
    background-color: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.7);
}
.app-logo-icon {
    /* Add a subtle animation or effect if desired */
    /* Example: transform: rotate(-5deg); */
}
/* --- END OF UPDATED HEADER STYLES --- */


.global-alert {
    z-index: 1056;
    position: sticky;
    top: 0;
}
.app-header.sticky-top + .global-alert {
    top: 62px; /* Adjust based on actual header height (py-3 is approx 1rem top/bottom + font) */
}


.sidebar {
  background-color: #fff;
}
.sidebar .inner-sidebar-scroll {
  height: calc(100vh - 62px - 1rem); /* Approx header height & some padding */
  overflow-y: auto;
  padding-top: 0.5rem;
}
.sidebar-heading {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: .05em;
}
.sidebar .nav-link {
  font-weight: 500;
  color: #495057;
  padding: 0.6rem 0.75rem;
  border-radius: 0.3rem;
  margin-bottom: 0.125rem;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.sidebar .nav-link .lucide {
  color: var(--bs-primary);
  transition: color 0.15s ease;
  margin-right: 0.65rem !important;
}
.sidebar .nav-link:hover {
  background-color: #eef2f7;
  color: var(--bs-primary);
}
.sidebar .nav-link:hover .lucide {
  color: var(--bs-primary);
}
.sidebar .nav-link.active {
  background-image: linear-gradient(to right, var(--bs-primary), #24e2d2); /* Example gradient */
  color: white;
  font-weight: 500;
  border: none; /* Optional: remove border if any default is applied that clashes */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
}
.sidebar .nav-link.active .lucide {
  color: white;
}

.main-content-area {
  overflow-y: scroll;
  background-color: #f0f2f5;
}
.view-wrapper {
    /* This wrapper inside main-content-area now holds the padding */
}
.view-wrapper.d-flex.flex-column > .flex-grow-1 {
    overflow-y: auto;
    min-height: 0;
}


.offcanvas-start { width: 280px; }
.offcanvas-body .nav-link { font-size: 1rem; padding: 0.75rem 1rem; }
.offcanvas-body .nav-link.active { background-color: var(--bs-primary); color: white; }
.offcanvas-body .nav-link .lucide { margin-right: 0.75rem; }

.toast-container { z-index: 1100 !important; }
.toast.show { display: block !important; }
.app-footer { font-size: 0.8rem; background-color: #fff; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
::-webkit-scrollbar-thumb { background: #ced4da; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #adb5bd; }

.sidebar .inner-sidebar-scroll::-webkit-scrollbar-thumb { background: #e0e0e0; }
.sidebar .inner-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #c0c0c0; }
</style>