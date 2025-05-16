<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { UserCheck, ChevronLeft, Save, Trash2, Search, AlertCircle, CheckSquare, Square } from 'lucide-vue-next'; // Import necessary icons

// --- Props ---
const props = defineProps({
  session: {
    type: Object,
    required: true
  },
  participants: { // Full list of participants, used if initialAttendance is just IDs
    type: Array,
    required: true,
    default: () => []
  },
  sessions: { // session attendance
    type: Array,
    required: true,
    default: () => []
  },
  initialAttendance: { // Attendance records specifically for this session, passed from parent
    type: Array,
    required: true,
    default: () => []
  },
  loading: { // Loading state for fetching attendance
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  }
});

// --- Emits ---
const emit = defineEmits([
  'back',             // Signal to go back to the session list
  'save-attendance',  // Send updated attendance data to parent
  'delete-session',   // Request parent to delete the current session
  'refresh-attendance' // Request parent to re-fetch attendance data (optional)
]);

// --- State ---
const localAttendance = ref([]);
// Search term for filtering participants in the list
const searchQuery = ref('');
// State for showing save confirmation message
const showSaveConfirmation = ref(false);
// State for potential errors specific to this component (e.g., if saving fails)
const componentError = ref(null);

const attendanceSummaryMap = ref({});
const totalSessions = ref (0);

const hasUnsavedChanges = ref(false);

// --- Helper Functions ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const offset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + offset);
        return adjustedDate.toLocaleDateString('en-CA');
    } catch (e) { return 'Invalid Date'; }
};

const isPastSession = computed(() => {
  if (!props.session?.session_date) return false;
  const today = new Date().toISOString().split('T')[0];
  return props.session.session_date < today;
});


// --- Watchers ---
watch(() => props.initialAttendance, (newAttendanceData) => {
  // Create a deep copy to avoid modifying the prop directly
  localAttendance.value = JSON.parse(JSON.stringify(newAttendanceData));
  // Sort alphabetically by participant name
  localAttendance.value.sort((a, b) => a.participant_name.localeCompare(b.participant_name));
}, { immediate: true, deep: true }); // immediate: run on mount, deep: watch for nested changes

// --- Computed Properties ---
const filteredAttendance = computed(() => {
  if (!searchQuery.value) {
    return localAttendance.value;
  }
  const query = searchQuery.value.toLowerCase();
  return localAttendance.value.filter(att =>
    att.participant_name.toLowerCase().includes(query) ||
    att.participant_id.toString().includes(query)
  );
});

const fetchAttendanceSummary = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/participants/attendance-summary');
    if (!response.ok) throw new Error('Erreur de chargement du résumé de présence');

    const data = await response.json();

    const map = {};
    data.forEach(entry => {
      map[entry.id] = entry.attended_sessions;
    });

    attendanceSummaryMap.value = map;
    totalSessions.value = data.length > 0 ? data[0].total : 0;
    console.log(data);

  } catch (err) {
    console.error("Erreur fetchAttendanceSummary:", err);
  }
};

// Calculate attendance counts
const attendanceCount = computed(() => {
  const attended = localAttendance.value.filter(a => a.attended).length;
  const total = localAttendance.value.length;
  return { attended, total };
});

// --- Methods ---
const handleAttendanceChange = (participantId, isChecked) => {
  const record = localAttendance.value.find(att => att.participant_id === participantId);
  if (record) {
    if (record.attended !== isChecked) {
      hasUnsavedChanges.value = true;
    }
    record.attended = isChecked;
    hasUnsavedChanges.value = true;
  }
};

const goBack = () => {
  // if (hasUnsavedChanges.value) {
  //   const confirmed = window.confirm("Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter sans enregistrer ?");
  //   if (!confirmed) return;
  // }
  emit('back');
};

const saveAttendance = async () => {
    componentError.value = null;
    const errorMsg = await emit('save-attendance', localAttendance.value);
    if (errorMsg) {
        componentError.value = errorMsg;
    } else {
        hasUnsavedChanges.value = false;
        showSaveConfirmation.value = true; // Show success confirmation
        setTimeout(() => { showSaveConfirmation.value = false; }, 3000); // Hide after 3s
    }
};

const requestDeleteSession = () => {
  emit('delete-session', props.session.id);
};

// Filter participants based on search query
const filterParticipants = () => {
    if (!searchQuery.value) {
        localAttendance.value = props.initialAttendance;
        return;
    }

    const query = searchQuery.value.toLowerCase();
    localAttendance.value = props.initialAttendance.filter(record => 
        record.participant_name.toLowerCase().includes(query) ||
        record.participant_id.toString().includes(query)
    );
};


// Initialize filtered attendance
onMounted(async () => {
  localAttendance.value = props.initialAttendance;
  filterParticipants();
  await fetchAttendanceSummary(); // 👈 ajout ici
});

defineExpose({
  hasUnsavedChanges,
  saveAttendance,
});


// Watch for changes in attendance
watch(() => props.initialAttendance, (newAttendance) => {
    localAttendance.value = newAttendance;
    filterParticipants();
}, { deep: true });

</script>

<template>
  <div class="card shadow-sm mb-4">
    <div class="card-header bg-light p-3">
      <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center mb-2 gap-2">
        <button @click="goBack" class="btn btn-sm btn-outline-secondary d-flex align-items-center">
          <ChevronLeft class="me-1" :size="16" /> Back
        </button>
        <div v-if="showSaveConfirmation" class="alert alert-success py-1 px-2 small m-0 flex-grow-1 text-center" role="alert">
          Attendance saved!
        </div>
        <button @click="requestDeleteSession" title="Delete Session" class="btn btn-sm btn-outline-danger d-flex align-items-center">
          <Trash2 class="me-1" :size="16" /> Delete Session
        </button>
      </div>

      <h5 class="card-title mb-1 d-flex align-items-center">
        <UserCheck class="me-2" :size="20" /> Attendance
      </h5>
      <p class="card-subtitle text-muted small mb-2">
        Session: <span class="fw-medium">{{ formatDate(session.session_date) }}</span> - {{ session.topic || 'General Study' }}
      </p>
      <p class="card-subtitle text-muted small">
        Marked: <span class="fw-medium">{{ attendanceCount.attended }} / {{ attendanceCount.total }}</span>
      </p>
      <div class="input-group input-group-sm mt-2" style="max-width: 320px;">
        <span class="input-group-text bg-white border-end-0"><Search :size="16"/></span>
        <input
          type="search"
          class="form-control border-start-0"
          placeholder="Rechercher par nom ou ID..."
          v-model="searchQuery"
          aria-label="Search participants in attendance list"
        >
      </div>
    </div>

    <div class="card-body p-0">
      <div v-if="componentError" class="alert alert-warning p-2 small m-2 d-flex align-items-center" role="alert">
         <AlertCircle class="me-1 flex-shrink-0" :size="16" /> {{ componentError }}
      </div>

      <div v-if="loading" class="text-center p-5 text-muted">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 mb-0">Loading attendance...</p>
      </div>

      <div v-else class="table-responsive" style="max-height: 55vh; overflow-y: auto;">
        <table class="table table-hover mb-0">
          <thead class="table-light" style="position: sticky; top: 0; z-index: 1;">
            <tr>
              <th scope="col" class="text-center" style="width: 80px;">Attended</th>
              <th scope="col">ID</th>
              <th scope="col">Nom</th>
              <th scope="col">Sessions assistées</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loading && filteredAttendance.length === 0">
              <td colspan="3" class="text-center text-muted py-4">
                {{ searchQuery ? 'No participants found matching search.' : (participants.length === 0 ? 'No participants exist in the system.' : 'No attendance records found.') }}
              </td>
            </tr>
            <tr v-for="att in filteredAttendance" :key="att.participant_id">
              <td class="text-center align-middle">
                <div class="form-check d-flex justify-content-center">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :id="'att-' + att.participant_id"
                    :checked="att.attended"
                    @change="handleAttendanceChange(att.participant_id, $event.target.checked)"
                    :disabled="saving || isPastSession"  
                  >
                </div>
              </td>
              <td class="align-middle">{{ att.participant_id }}</td>
              <td class="align-middle">{{ att.participant_name }}</td>
              <td class="align-middle">
                {{ attendanceSummaryMap[att.participant_id] || 0 }} / {{ totalSessions }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card-footer text-end p-2 bg-light">
      <button
        @click="saveAttendance"
        :disabled="saving || loading || !localAttendance.length"
        class="btn btn-primary btn-sm d-flex align-items-center justify-content-center w-100 w-sm-auto"
      >
        <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        <Save v-else class="me-2" :size="16" />
        {{ saving ? 'Saving...' : 'Save Attendance' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles for AttendanceTracker component */
.table th {
    font-weight: 500;
}
.table td, .table th {
    vertical-align: middle;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
}
.list-group-item {
    transition: background-color 0.15s ease-in-out;
}
.list-group-item.disabled-interaction {
    cursor: not-allowed !important;
    opacity: 0.7;
}
.list-group-item-success {
    /* background-color: #d1e7dd; */ /* Bootstrap's default success background */
    /* border-left: 4px solid var(--bs-success); */ /* Accent border for attended items */
}
.custom-checkbox-display svg {
    vertical-align: middle;
}
.form-check-input.visually-hidden + .custom-checkbox-display {
    /* Styles for the label that looks like a checkbox */
    padding: 0.25rem; /* Make it a bit easier to tap */
}

.card-title .badge {
    font-size: 0.7em;
    padding: 0.3em 0.5em;
    vertical-align: middle;
}
.input-group-text {
    background-color: #fff;
    border-right: 0;
}
.form-control.border-start-0 {
    border-left: 0;
}
.form-control:focus {
     border-color: #86b7fe;
     box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}
.form-control.border-start-0:focus {
    border-left:0;
}
.animate-pulse {
    animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .6; }
}
.bg-light-subtle { /* For select all bar */
    background-color: rgba(var(--bs-secondary-rgb), 0.1) !important;
}
</style>
