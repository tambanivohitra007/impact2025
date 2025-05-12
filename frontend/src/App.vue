<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Needed for modal JS control

// Import Child Components
import BaseModal from './components/BaseModal.vue';
import ParticipantForm from './components/ParticipantForm.vue';
import ParticipantList from './components/ParticipantList.vue';
import SessionForm from './components/SessionForm.vue';
import SessionList from './components/SessionList.vue';
import AttendanceTracker from './components/AttendanceTracker.vue';
import Dashboard from './components/Dashboard.vue';
import Admin from './components/Admin.vue';

// Import Icons
import { BookOpen, Users, Calendar, AlertCircle, XCircle, Save, PlusCircle, UserCheck, BarChart2 } from 'lucide-vue-next';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3001/api'; // Backend API URL

// --- State ---
const view = ref('dashboard'); // Current view: 'dashboard', 'participants', 'sessions', 'attendance', 'admin'
const participants = ref([]);    // Array of all participants
const sessions = ref([]);        // Array of all sessions
const selectedSession = ref(null); // The session object currently being viewed/edited for attendance
const currentAttendance = ref([]); // Attendance records for the selectedSession

// Loading States
const loading = reactive({
  participants: false,
  sessions: false,
  attendance: false,
  app: true, // Initial app load
});
// Saving State (used for disabling buttons during API calls)
const saving = ref(false);
// Global Error Message
const error = ref(null);

// Success notification state
const successNotification = ref({
  show: false,
  message: '',
  participantId: null
});

// --- Modal State & Refs ---
// Participant Modal
const showParticipantModal = ref(false);
const editingParticipant = ref(null);
const participantFormRef = ref(null);

// Session Modal
const showSessionModal = ref(false);
const sessionFormRef = ref(null);

// --- API Call Function ---
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
            console.error(`API Error (${response.status}) ${method} ${url}: ${data?.error || response.statusText}`, data?.details);
            errorMessage = `Error: ${data?.error || response.statusText}.`;
            throw new Error(errorMessage);
        }
        error.value = null;
        return data;
    } catch (err) {
        console.error(`API Call failed: ${method} ${url}`, err);
        if (!errorMessage) {
            errorMessage = `Network error or failed to fetch. Is the backend running?`;
        }
        error.value = errorMessage;
        throw err;
    } finally {
       if(method !== 'GET') saving.value = false;
    }
}

// --- Data Fetching Functions ---
const fetchParticipants = async () => {
    loading.participants = true;
    error.value = null;
    try {
        participants.value = await apiCall('/participants');
    } catch (err) { /* Handled by apiCall */ }
    finally { loading.participants = false; }
};

const fetchSessions = async () => {
    loading.sessions = true;
    error.value = null;
    try {
        sessions.value = await apiCall('/sessions');
    } catch (err) { /* Handled by apiCall */ }
    finally { loading.sessions = false; }
};

const fetchInitialData = async () => {
    loading.app = true;
    error.value = null;
    try {
        await Promise.all([fetchParticipants(), fetchSessions()]);
    } catch (err) { /* Handled by apiCall */ }
    finally { loading.app = false; }
};

const fetchAttendanceForSession = async (sessionId) => {
    if (!sessionId) return;
    loading.attendance = true;
    error.value = null;
    currentAttendance.value = [];
    try {
        const data = await apiCall(`/attendance/${sessionId}`);
        const attendanceMap = data.reduce((acc, record) => {
            acc[record.participant_id] = {
                attended: !!record.attended,
                notes: record.notes || '',
            };
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

// --- Lifecycle Hooks ---
onMounted(fetchInitialData);

// --- Event Handlers for Participant Actions ---
const handleAddParticipant = () => {
    editingParticipant.value = null;
    showParticipantModal.value = true;
};

const handleEditParticipant = (participant) => {
    editingParticipant.value = participant;
    showParticipantModal.value = true;
};

const handleSaveParticipant = async (participantData) => {
    let apiError = null;
    try {
        let response;
        if (editingParticipant.value?.id) {
            response = await apiCall(`/participants/${editingParticipant.value.id}`, 'PUT', participantData);
            successNotification.value = {
                show: true,
                message: 'Participant modifié avec succès',
                participantId: editingParticipant.value.id
            };
        } else {
            response = await apiCall('/participants', 'POST', participantData);
            successNotification.value = {
                show: true,
                message: `Participant créé avec succès (ID: ${response.id})`,
                participantId: response.id
            };
        }
        showParticipantModal.value = false;
        await fetchParticipants();
    } catch (err) {
        apiError = error.value;
    }
    return apiError;
};

const handleDeleteParticipant = async (participantId) => {
    if (window.confirm("Are you sure you want to delete this participant? This might affect attendance records and referrals.")) {
        try {
            await apiCall(`/participants/${participantId}`, 'DELETE');
            await fetchParticipants();
            if (view.value === 'attendance' && selectedSession.value) {
                await fetchAttendanceForSession(selectedSession.value.id);
            }
        } catch (err) { /* Handled by apiCall */ }
    }
};

// --- Event Handlers for Session Actions ---
const handleAddSession = () => {
    showSessionModal.value = true;
};

const handleSaveSession = async (sessionData) => {
    let apiError = null;
    try {
        await apiCall('/sessions', 'POST', sessionData);
        showSessionModal.value = false;
        await fetchSessions();
    } catch (err) {
        apiError = error.value;
    }
    return apiError;
};

const handleDeleteSession = async (sessionId) => {
    if (window.confirm(`Are you sure you want to delete this session and all its attendance records?`)) {
        try {
            await apiCall(`/sessions/${sessionId}`, 'DELETE');
            await fetchSessions();
            if (view.value === 'attendance' && selectedSession.value?.id === sessionId) {
                handleBackToSessions();
            }
        } catch (err) { /* Handled by apiCall */ }
    }
};

// --- Event Handlers for Attendance Actions ---
const handleViewAttendance = async (session) => {
    selectedSession.value = session;
    view.value = 'attendance';
    await fetchAttendanceForSession(session.id);
};

const handleBackToSessions = () => {
    selectedSession.value = null;
    currentAttendance.value = [];
    view.value = 'sessions';
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
    } catch (err) {
        apiError = error.value || 'Failed to save one or more attendance records.';
    }
    return apiError;
};

const formattedSelectedSessionDate = computed(() => {
    if (selectedSession.value?.session_date) {
        try {
            const date = new Date(selectedSession.value.session_date);
            // Adjust for timezone offset to display the date as it was intended
            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            return selectedSession.value.session_date; // fallback
        }
    }
    return '';
});

// Gestionnaire de navigation
const handleNavigation = (newView) => {
    view.value = newView;
    if (newView === 'sessions') {
        selectedSession.value = null;
        currentAttendance.value = [];
    }
};

</script>

<template>
    <div class="app-wrapper bg-light min-vh-100 d-flex flex-column">
        <!-- HEADER TOUJOURS VISIBLE -->
        <header class="py-3 py-md-4 text-center shadow-sm bg-white">
            <div class="d-flex justify-content-between align-items-center container">
                <!-- Logo gauche -->
                <img src="/impact.png" alt="Logo gauche" style="height: 100px;" />

                <!-- Titre central -->
                <div>
                    <h1 class="h2 mb-1 d-flex align-items-center justify-content-center gap-2 text-primary">
                        <BookOpen :size="30" /> IMPACT 2025
                    </h1>
                    <p class="text-muted small mb-0">Participant & Attendance Tracker</p>
                </div>

                <!-- Logo droite -->
                <img src="/MAHABO.png" alt="Logo droite" style="height: 100px;" />
            </div>
        </header>


        <div v-if="error" class="alert alert-danger alert-dismissible fade show container mt-3 mb-0" role="alert">
             <AlertCircle class="me-2 flex-shrink-0" :size="20" />
             {{ error }}
             <button type="button" class="btn-close" @click="error = null" aria-label="Close"></button>
        </div>

        <div v-if="loading.app" class="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-muted p-5">
             <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3 fs-5">Loading application data...</p>
        </div>

        <div v-else class="container py-3 py-md-4 flex-grow-1">
            <div class="row">
                <!-- Navigation latérale -->
                <div class="col-md-3">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title mb-3">Menus</h5>
                            <div class="list-group">
                                <a href="#" class="list-group-item list-group-item-action" 
                                   :class="{ 'active': view === 'dashboard' }"
                                   @click.prevent="handleNavigation('dashboard')">
                                    <BarChart2 class="me-2" :size="18" /> Dashboard
                                </a>
                                <a href="#" class="list-group-item list-group-item-action"
                                   :class="{ 'active': view === 'participants' }"
                                   @click.prevent="handleNavigation('participants')">
                                    <Users class="me-2" :size="18" /> Liste des participants
                                </a>
                                <a href="#" class="list-group-item list-group-item-action"
                                   :class="{ 'active': view === 'sessions' || view === 'attendance' }"
                                   @click.prevent="handleNavigation('sessions')">
                                    <Calendar class="me-2" :size="18" /> Sessions & Présence
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Contenu principal -->
                <div class="col-md-9">
                    <main>
                        <div v-if="view === 'dashboard'">
                            <Dashboard @navigate="handleNavigation" />
                        </div>
                        <div v-if="view === 'participants'" class="card shadow-sm">
                            <div class="card-header bg-white py-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h2 class="h5 mb-0 text-primary d-flex align-items-center">
                                        <Users class="me-2" :size="22" /> Liste des participants
                                    </h2>
                                    <button @click="handleAddParticipant" class="btn btn-primary btn-sm">
                                        <PlusCircle class="me-1" :size="16" /> Ajouter
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                <ParticipantList
                                    :participants="participants"
                                    :loading="loading.participants"
                                    @edit-participant="handleEditParticipant"
                                    @delete-participant="handleDeleteParticipant"
                                />
                            </div>
                        </div>

                        <div v-if="view === 'sessions'" class="card shadow-sm">
                            <div class="card-header bg-white py-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h2 class="h5 mb-0 text-primary d-flex align-items-center">
                                        <Calendar class="me-2" :size="22" /> Sessions & Présence
                                    </h2>
                                    <button @click="handleAddSession" class="btn btn-primary btn-sm">
                                        <PlusCircle class="me-1" :size="16" /> Ajouter
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                <SessionList
                                    :sessions="sessions"
                                    :loading="loading.sessions"
                                    @view-attendance="handleViewAttendance"
                                    @delete-session="handleDeleteSession"
                                />
                            </div>
                        </div>

                        <div v-if="view === 'attendance' && selectedSession" class="card shadow-sm">
                            <div class="card-header bg-white py-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h2 class="h5 mb-0 text-primary d-flex align-items-center">
                                        <UserCheck class="me-2" :size="22" />
                                        Présence: {{ selectedSession.topic || formattedSelectedSessionDate }}
                                    </h2>
                                    <button class="btn btn-outline-secondary btn-sm" @click="handleBackToSessions">
                                        &laquo; Retour aux sessions
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                <AttendanceTracker
                                    :session="selectedSession"
                                    :participants="participants"
                                    :initial-attendance="currentAttendance"
                                    :loading="loading.attendance"
                                    :saving="saving"
                                    @save-attendance="handleSaveAttendance"
                                    @delete-session="handleDeleteSession"
                                />
                            </div>
                        </div>

                        <!-- (ne rien afficher pour view === 'admin') -->
                    </main>
                </div>
            </div>
        </div>

        <BaseModal
            v-model:show="showParticipantModal"
            :title="editingParticipant ? 'Edit Participant' : 'Add New Participant'"
            @close="editingParticipant = null"
        >
             <ParticipantForm
                ref="participantFormRef"
                :initialParticipant="editingParticipant"
                :participants="participants"
                :saving="saving"
                @save="handleSaveParticipant"
                @cancel="showParticipantModal = false"
             />
             <template #footer>
                 <button type="button" class="btn btn-outline-secondary btn-sm" @click="showParticipantModal = false" :disabled="saving">Cancel</button>
                 <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    @click="participantFormRef?.submit()"
                    :disabled="saving"
                 >
                    <span v-if="saving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    <Save v-else class="me-1" :size="16" />
                    {{ saving ? (editingParticipant ? 'Saving...' : 'Adding...') : (editingParticipant ? 'Save Changes' : 'Add Participant') }}
                 </button>
             </template>
        </BaseModal>

        <BaseModal
            v-model:show="showSessionModal"
            title="Add New Study Session"
            @close="showSessionModal = false"
         >
              <SessionForm
                ref="sessionFormRef"
                :saving="saving"
                @save="handleSaveSession"
                @cancel="showSessionModal = false"
              />
              <template #footer>
                 <button type="button" class="btn btn-outline-secondary btn-sm" @click="showSessionModal = false" :disabled="saving">Cancel</button>
                 <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    @click="sessionFormRef?.submit()"
                    :disabled="saving"
                 >
                    <span v-if="saving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    <Save v-else class="me-1" :size="16" />
                    {{ saving ? 'Adding...' : 'Add Session' }}
                 </button>
             </template>
         </BaseModal>

        <!-- Success Notification Modal -->
        <div v-if="successNotification.show" class="modal fade show" style="display: block; z-index: 9999;" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Succès</h5>
                        <button type="button" class="btn-close" @click="successNotification.show = false"></button>
                    </div>
                    <div class="modal-body">
                        <p>{{ successNotification.message }}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" @click="successNotification.show = false">OK</button>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show" style="z-index: 9998;"></div>
        </div>

        <footer class="mt-auto pt-3 pb-3 text-center text-muted small bg-white border-top">
            IMPACT2025 - Madagascar &copy; {{ new Date().getFullYear() }}
        </footer>
    </div>
</template>

<style>
/* Global styles (consider moving to a separate CSS file imported in main.js or a <style> tag in index.html) */
body, html {
    min-height: 100%;
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

#app { /* Assuming your Vue app is mounted to an element with id="app" in index.html */
    min-height: 100%;
    display: flex; /* This helps if #app is the direct child of body for full height flex */
    flex-direction: column;
}

.app-wrapper { /* Renamed from .container-fluid for clarity, still acts as the main flex container */
    /* d-flex flex-column min-vh-100 are applied via class */
}

.nav-pills .nav-link,
.nav-pills .nav-link:hover,
.nav-pills .nav-link.active {
    display: none;
}

.card-header {
    border-bottom: 1px solid #e9ecef; /* Softer border for cards */
}

/* Ensure modals don't cause horizontal scroll */
.modal {
    overflow-x: hidden;
}
/* Adjust button focus rings for better visibility */
.btn:focus, .btn:focus-visible {
    box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.35);
}
.btn-outline-secondary:focus, .btn-outline-secondary:focus-visible {
     box-shadow: 0 0 0 0.25rem rgba(108, 117, 125, 0.35);
}
.btn-danger:focus, .btn-danger:focus-visible,
.btn-outline-danger:focus, .btn-outline-danger:focus-visible {
     box-shadow: 0 0 0 0.25rem rgba(var(--bs-danger-rgb), 0.35);
}

/* Consider adding a nice font like Inter */
/* @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); */
/* Then apply `font-family: 'Inter', sans-serif;` to body or a main wrapper */

/* Styles pour la modal de notification */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
}

.modal-dialog {
    position: relative;
    z-index: 9999;
}

.modal-content {
    position: relative;
    z-index: 9999;
}

/* Styles pour la navigation latérale */
.list-group-item {
    border: none;
    padding: 0.75rem 1rem;
    color: #495057;
}

.list-group-item:hover {
    background-color: #f8f9fa;
}

.list-group-item.active {
    background-color: #0d6efd;
    border-color: #0d6efd;
}

.list-group-item.active:hover {
    background-color: #0b5ed7;
}
</style>