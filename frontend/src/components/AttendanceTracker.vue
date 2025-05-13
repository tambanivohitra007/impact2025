<script setup>
import { ref, computed, watch } from 'vue';
import { UserCheck, ChevronLeft, Save, Trash2, Search, AlertCircle, CheckSquare, Square } from 'lucide-vue-next';

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
  initialAttendance: { // This will be the processed list from App.vue
    type: Array,
    required: true,
    default: () => []
  },
  loading: {
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
  'back',
  'save-attendance',
  'delete-session',
]);

// --- State ---
const localAttendance = ref([]);
const searchTerm = ref('');
const showSaveConfirmation = ref(false);
const componentError = ref(null); // For errors specific to this component's actions

// --- Helper Functions ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const offset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + offset);
        return adjustedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return 'Invalid Date'; }
};

// --- Watchers ---
watch(() => props.initialAttendance, (newAttendanceData) => {
  // Create a deep copy to ensure localAttendance is mutable and independent
  localAttendance.value = JSON.parse(JSON.stringify(newAttendanceData));
  // Sort alphabetically by participant name for consistent display
  localAttendance.value.sort((a, b) => {
      if (a.participant_name && b.participant_name) {
          return a.participant_name.localeCompare(b.participant_name);
      }
      return 0; // Fallback if names are missing
  });
}, { immediate: true, deep: true });

// --- Computed Properties ---
const filteredAttendance = computed(() => {
  if (!searchTerm.value) {
    return localAttendance.value;
  }
  const lowerSearch = searchTerm.value.toLowerCase();
  return localAttendance.value.filter(att =>
    att.participant_name && att.participant_name.toLowerCase().includes(lowerSearch)
  );
});

const attendanceCount = computed(() => {
  const attended = localAttendance.value.filter(a => a.attended).length;
  const total = localAttendance.value.length;
  return { attended, total };
});

// --- Methods ---
const handleAttendanceChange = (participantId, isChecked) => {
  const record = localAttendance.value.find(att => att.participant_id === participantId);
  if (record) {
    record.attended = isChecked;
  }
};

const goBack = () => {
  emit('back');
};

const saveAttendance = async () => {
    componentError.value = null;
    const errorMsg = await emit('save-attendance', localAttendance.value);
    if (errorMsg) {
        componentError.value = errorMsg;
    } else {
        showSaveConfirmation.value = true;
        setTimeout(() => { showSaveConfirmation.value = false; }, 3000);
    }
};

const requestDeleteSession = () => {
  emit('delete-session', props.session.id);
};

// Toggle all participants' attendance
const toggleSelectAll = () => {
    const allCurrentlySelected = filteredAttendance.value.length > 0 && filteredAttendance.value.every(p => p.attended);
    const newAttendedState = !allCurrentlySelected;
    filteredAttendance.value.forEach(p => {
        // Ensure we modify the original record in localAttendance if filteredAttendance is a subset
        const originalRecord = localAttendance.value.find(orig => orig.participant_id === p.participant_id);
        if (originalRecord) {
            originalRecord.attended = newAttendedState;
        }
    });
};

const isAllSelected = computed(() => {
    return filteredAttendance.value.length > 0 && filteredAttendance.value.every(p => p.attended);
});


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
          placeholder="Search participants..."
          v-model="searchTerm"
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

      <div v-else-if="!localAttendance.length && !loading" class="text-center p-5 text-muted">
         <Users :size="48" class="mb-2" />
         <p class="mb-1 fw-bold">No participants found.</p>
         <p class="small">There might be no participants in the system, or none loaded for this session.</p>
      </div>

      <div v-else class="list-group list-group-flush">
        <div v-if="filteredAttendance.length > 0" class="list-group-item px-3 py-2 bg-light-subtle">
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="checkbox"
                    id="selectAllCheckbox"
                    :checked="isAllSelected"
                    @change="toggleSelectAll"
                    :disabled="saving"
                >
                <label class="form-check-label fw-medium small" for="selectAllCheckbox">
                    {{ isAllSelected ? 'Deselect All Shown' : 'Select All Shown' }} ({{ filteredAttendance.length }})
                </label>
            </div>
        </div>

        <div
            v-for="att in filteredAttendance"
            :key="att.participant_id"
            class="list-group-item px-3 py-2"
            role="button"
            @click="!saving && handleAttendanceChange(att.participant_id, !att.attended)"
            :class="{ 'list-group-item-success': att.attended, 'disabled-interaction': saving }"
            style="cursor: pointer;"
        >
          <div class="d-flex justify-content-between align-items-center">
            <span class="text-truncate me-2">{{ att.participant_name }}</span>
            <div @click.stop> <input
                    class="form-check-input visually-hidden"
                    type="checkbox"
                    :id="'att-check-' + att.participant_id"
                    :checked="att.attended"
                    @change="handleAttendanceChange(att.participant_id, $event.target.checked)"
                    :disabled="saving"
                >
                 <label :for="'att-check-' + att.participant_id" class="custom-checkbox-display" role="button" :aria-label="'Mark ' + att.participant_name + (att.attended ? ' as not attended' : ' as attended')">
                    <CheckSquare v-if="att.attended" :size="22" class="text-success" />
                    <Square v-else :size="22" class="text-muted" />
                </label>
            </div>
          </div>
           </div>
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
