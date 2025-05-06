<script setup>
import { Calendar, UserCheck, Trash2 } from 'lucide-vue-next'; // Import necessary icons

// --- Props ---
// sessions: The array of session objects passed from the parent (App.vue)
// loading: Boolean indicating if the session data is currently being fetched
const props = defineProps({
  sessions: {
    type: Array,
    required: true,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

// --- Emits ---
// view-attendance: Emits the session object when the 'Attendance' button is clicked
// delete-session: Emits the session ID when the 'Delete' button is clicked
const emit = defineEmits(['view-attendance', 'delete-session']);

// --- Helper Functions ---
// Formats date string to a readable format (e.g., YYYY-MM-DD)
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        // Adjust for timezone offset to display the correct local date
        const offset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + offset);
        return adjustedDate.toLocaleDateString('en-CA'); // Or 'en-US', etc.
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Invalid Date';
    }
};

// --- Methods ---
// Emits the 'view-attendance' event with the session object
const handleViewAttendanceClick = (session) => {
  emit('view-attendance', session);
};

// Emits the 'delete-session' event with the session ID
const handleDeleteSessionClick = (sessionId) => {
  // Optional: Add confirmation dialog here if preferred within the component
  // if (confirm('Are you sure you want to delete this session and its attendance records?')) {
       emit('delete-session', sessionId);
  // }
};

</script>

<template>
  <div class="card shadow-sm">
    <div class="card-header bg-light p-3">
      <h5 class="card-title mb-1 d-flex align-items-center">
        <Calendar class="me-2" :size="20" /> Study Sessions
      </h5>
      <p class="card-subtitle text-muted small">View past sessions or track attendance.</p>
      </div>

    <div class="card-body p-0">
      <div v-if="loading" class="text-center p-4 text-muted">
        <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
        <span class="ms-2">Loading sessions...</span>
      </div>

      <div v-else class="table-responsive">
        <table class="table table-hover table-striped mb-0">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Topic</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loading && sessions.length === 0">
              <td colspan="3" class="text-center text-muted py-4">
                No sessions recorded yet.
              </td>
            </tr>
            <tr v-for="s in sessions" :key="s.id">
              <td class="fw-medium align-middle">{{ formatDate(s.session_date) }}</td>
              <td class="align-middle">{{ s.topic || 'N/A' }}</td>
              <td class="text-end align-middle">
                <button
                  @click="handleViewAttendanceClick(s)"
                  title="View/Edit Attendance"
                  class="btn btn-sm btn-outline-primary me-1"
                >
                  <UserCheck class="me-1" :size="16" /> Attendance
                </button>
                <button
                  @click="handleDeleteSessionClick(s.id)"
                  title="Delete Session"
                  class="btn btn-sm btn-outline-danger px-1 py-0"
                >
                  <Trash2 :size="16" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
     </div>
</template>

<style scoped>
/* Scoped styles for SessionList component */
.table th {
    font-weight: 500;
    white-space: nowrap;
}
.table td {
    vertical-align: middle;
}
.btn-sm {
    /* Ensure buttons align well */
    display: inline-flex;
    align-items: center;
}
</style>