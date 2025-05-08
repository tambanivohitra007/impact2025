<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { UserCheck, ChevronLeft, Save, Trash2, Search, AlertCircle } from 'lucide-vue-next'; // Import necessary icons

// --- Props ---
const props = defineProps({
  session: { // The session object being viewed
    type: Object,
    required: true
  },
  participants: { // The full list of all participants
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
  saving: { // Saving state for updating attendance
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
// Local reactive copy of attendance records to track changes
const localAttendance = ref([]);
// Search term for filtering participants in the list
const searchQuery = ref('');
// State for showing save confirmation message
const showSaveConfirmation = ref(false);
// State for potential errors specific to this component (e.g., if saving fails)
const componentError = ref(null);

// --- Helper Functions ---
// Formats date string to a readable format (e.g., YYYY-MM-DD)
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const offset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + offset);
        return adjustedDate.toLocaleDateString('en-CA');
    } catch (e) { return 'Invalid Date'; }
};

// --- Watchers ---
// Watch the initialAttendance prop passed from the parent.
// When it changes (data is loaded/reloaded), update the local copy.
watch(() => props.initialAttendance, (newAttendanceData) => {
  // Create a deep copy to avoid modifying the prop directly
  localAttendance.value = JSON.parse(JSON.stringify(newAttendanceData));
  // Sort alphabetically by participant name
  localAttendance.value.sort((a, b) => a.participant_name.localeCompare(b.participant_name));
}, { immediate: true, deep: true }); // immediate: run on mount, deep: watch for nested changes

// --- Computed Properties ---
// Filter the local attendance records based on the search term
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

// Calculate attendance counts
const attendanceCount = computed(() => {
  const attended = localAttendance.value.filter(a => a.attended).length;
  const total = localAttendance.value.length;
  return { attended, total };
});

// --- Methods ---
// Handle checkbox change: update the local attendance state
const handleAttendanceChange = (participantId, isChecked) => {
  const record = localAttendance.value.find(att => att.participant_id === participantId);
  if (record) {
    record.attended = isChecked;
  }
};

// Emit event to go back to the session list
const goBack = () => {
  emit('back');
};

// Emit event to save the current state of localAttendance
const saveAttendance = async () => {
    componentError.value = null; // Clear previous errors
    // Pass the local state up to the parent for the API call
    const errorMsg = await emit('save-attendance', localAttendance.value);
    if (errorMsg) {
        componentError.value = errorMsg; // Show error if parent returns one
    } else {
        showSaveConfirmation.value = true; // Show success confirmation
        setTimeout(() => { showSaveConfirmation.value = false; }, 3000); // Hide after 3s
    }
};

// Emit event to request session deletion
const requestDeleteSession = () => {
    // Confirmation is typically handled in the parent (App.vue) before API call
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
onMounted(() => {
    localAttendance.value = props.initialAttendance;
    filterParticipants();
});

// Watch for changes in attendance
watch(() => props.initialAttendance, (newAttendance) => {
    localAttendance.value = newAttendance;
    filterParticipants();
}, { deep: true });

</script>

<template>
  <div class="card shadow-sm">
    <div class="card-header bg-light p-3">
      <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center mb-2">
        <button @click="goBack" class="btn btn-sm btn-outline-secondary mb-2 mb-sm-0">
          <ChevronLeft class="me-1" :size="16" /> Back to Sessions
        </button>
        <div v-if="showSaveConfirmation" class="alert alert-success py-1 px-2 small animate-pulse mb-2 mb-sm-0" role="alert">
          Attendance saved!
        </div>
        <button @click="requestDeleteSession" title="Delete Session" class="btn btn-sm btn-danger">
          <Trash2 class="me-1" :size="16" /> Delete Session
        </button>
      </div>

      <h5 class="card-title mb-1 d-flex align-items-center">
        <UserCheck class="me-2" :size="20" /> Attendance for {{ formatDate(session.session_date) }}
      </h5>
      <p class="card-subtitle text-muted small mb-2">
        Topic: {{ session.topic || 'N/A' }} |
        Attended: {{ attendanceCount.attended }} / {{ attendanceCount.total }}
      </p>
       <div class="input-group input-group-sm" style="max-width: 300px;">
        <span class="input-group-text"><Search :size="16"/></span>
        <input
          type="search"
          class="form-control"
          placeholder="Rechercher par nom ou ID..."
          v-model="searchQuery"
          @input="filterParticipants"
        >
      </div>
    </div>

    <div class="card-body p-0">
      <div v-if="componentError" class="alert alert-warning p-2 small m-2" role="alert">
         <AlertCircle class="me-1" :size="16" /> {{ componentError }}
      </div>

      <div v-if="loading" class="text-center p-4 text-muted">
        <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
        <span class="ms-2">Loading attendance records...</span>
      </div>

      <div v-else class="table-responsive" style="max-height: 55vh; overflow-y: auto;">
        <table class="table table-hover mb-0">
          <thead class="table-light" style="position: sticky; top: 0; z-index: 1;">
            <tr>
              <th scope="col" class="text-center" style="width: 80px;">Attended</th>
              <th scope="col">ID</th>
              <th scope="col">Nom</th>
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
                    :disabled="saving"
                  >
                </div>
              </td>
              <td class="align-middle">{{ att.participant_id }}</td>
              <td class="align-middle">{{ att.participant_name }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card-footer text-end p-2 bg-light">
      <button
        @click="saveAttendance"
        :disabled="saving || loading"
        class="btn btn-primary btn-sm"
      >
        <span v-if="saving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        <Save v-else class="me-1" :size="16" />
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
.form-check-input {
    /* Make checkbox slightly larger and easier to click */
    width: 1.25em;
    height: 1.25em;
    cursor: pointer;
}
.form-check-label {
    cursor: pointer;
}
.input-group-text {
    background-color: #e9ecef;
    border-right: 0;
}
.form-control {
    border-left: 0;
}
.form-control:focus {
     border-color: #dee2e6;
     box-shadow: none;
     border-left: 0;
}
/* Simple pulse animation */
.animate-pulse {
    animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}

.table td {
    vertical-align: middle;
}

.form-control-sm {
    display: none;
}

.input-group-text {
    background-color: #f8f9fa;
    border-right: none;
}

.input-group .form-control {
    border-left: none;
}

.input-group .form-control:focus {
    border-color: #ced4da;
    box-shadow: none;
}

.input-group:focus-within {
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}
</style>