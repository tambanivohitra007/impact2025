<script setup>
import { ref, computed } from 'vue';
import { Calendar, UserCheck, Trash2, ListChecks, PlusCircle } from 'lucide-vue-next';

// --- Props ---
const props = defineProps({
  sessions: {
    type: Array,
    required: true,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  itemsPerPage: { // Added prop for items per page
    type: Number,
    default: 5 // Default items per page
  }
});

// --- Emits ---
const emit = defineEmits([
    'view-attendance',
    'delete-session',
    'add-new-session'
]);

// --- Pagination State ---
const currentPage = ref(1);

// --- Computed Properties ---
const paginatedSessions = computed(() => {
  const start = (currentPage.value - 1) * props.itemsPerPage;
  const end = start + props.itemsPerPage;
  return props.sessions.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(props.sessions.length / props.itemsPerPage);
});

// --- Helper Functions ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const offset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + offset);
        return adjustedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Date invalide';
    }
};

// --- Methods ---
const handleViewAttendanceClick = (session) => {
  emit('view-attendance', session);
};

const handleDeleteSessionClick = (sessionId) => {
  emit('delete-session', sessionId);
};

const handleAddNewSessionClick = () => {
  emit('add-new-session');
};

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

</script>

<template>
  <div class="card w-100 shadow-sm mb-4 h-100 d-flex flex-column">
    <div class="card-header bg-light p-3 flex-shrink-0">
      <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center">
        <h2 class="h5 mb-2 mb-sm-0 text-primary d-flex align-items-center">
          <ListChecks class="me-2" :size="22" /> Session List
          <span class="badge bg-danger ms-2">{{ sessions.length }}</span>
        </h2>
        <button @click="handleAddNewSessionClick" class="btn btn-primary btn-sm d-flex align-items-center mt-2">
            <PlusCircle class="me-1" :size="16" /> Ajouter Session
        </button>
      </div>      
    </div>

    <div class="card-body p-0 flex-grow-1" style="overflow-y: auto;">
      <div v-if="loading" class="text-center p-5 text-muted d-flex flex-column justify-content-center align-items-center h-100">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 mb-0">Chargement sessions...</p>
      </div>

      <div v-else-if="!sessions.length" class="text-center p-5 text-muted d-flex flex-column justify-content-center align-items-center h-100">
        <Calendar :size="48" class="mb-2" />
        <p class="mb-1 fw-bold">Pas de sessions enregistrées</p>
        <p class="small">Click "Ajouter Session" pour en crée une</p>
      </div>

      <div v-else class="list-group list-group-flush">
        <div
          v-for="s in paginatedSessions"
          :key="s.id"
          class="list-group-item list-group-item-action py-2"
          >
          <div class="row align-items-center g-2">
            <div class="col">
              <div class="d-flex flex-column">
                <span class="fw-bold text-primary">{{ formatDate(s.session_date) }}</span>
                <small class="text-muted text-truncate" :title="s.topic || 'General Study'">{{ s.topic || 'General Study' }}</small>
              </div>
            </div>

            <div class="col-auto">
              <div class="btn-group" role="group" aria-label="Session actions">
                <button
                  @click="handleViewAttendanceClick(s)"
                  title="View/Edit Attendance"
                  class="btn btn-sm btn-outline-primary d-flex align-items-center px-2 py-1"
                >
                  <UserCheck :size="16" class="me-1 d-none d-sm-inline-block" />
                  <span class="d-sm-none"><UserCheck :size="18" /></span>
                  <span class="d-none d-sm-inline">Présence</span>
                </button>
                <button
                  @click="handleDeleteSessionClick(s.id)"
                  title="Delete Session"
                  class="btn btn-sm btn-outline-danger d-flex align-items-center px-2 py-1"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="totalPages > 1" class="card-footer d-flex justify-content-between align-items-center">
      <button
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage === 1"
        class="btn btn-sm btn-outline-secondary"
      >
        Précédent
      </button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="btn btn-sm btn-outline-secondary"
      >
        Suivant
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Ensure card takes full height if it's a flex item in parent */
.card.d-flex.flex-column {
    /* Height is managed by parent flex container */
}
.card-body {
    /* If the list inside is too long, this allows the body to scroll */
}

.card {
  padding: 1em;
}


.list-group-item {
    padding-left: var(--bs-gutter-x, 0.75rem);
    padding-right: var(--bs-gutter-x, 0.75rem);
    /* border-left: 0;
    border-right: 0; */ /* Handled by list-group-flush */
}
.card-title .badge {
    font-size: 0.7em;
    padding: 0.3em 0.5em;
    vertical-align: middle;
}
.btn-sm {
    font-size: 0.8rem;
}
.btn-group .btn {
    border-radius: 0.2rem;
}
.btn-group .btn:not(:last-child) {
    margin-right: 5px;
}
.btn-group .btn:focus {
    box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb),.25);
}
.btn-outline-danger:focus {
     box-shadow: 0 0 0 0.2rem rgba(var(--bs-danger-rgb),.25);
}
.btn svg {
    vertical-align: -2px;
}
.text-truncate { /* Ensure long topics don't break layout */
    max-width: 200px; /* Adjust as needed, or use more complex CSS for truncation */
}
@media (min-width: 576px) { /* sm breakpoint */
    .text-truncate {
        max-width: none; /* Allow more space on larger screens */
    }
}
.card-header h2.h5 {
    margin-bottom: 0 !important;
}
</style>