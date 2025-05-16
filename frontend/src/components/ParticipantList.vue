<script setup>
import { ref, computed } from 'vue';
import { Users, Edit, Trash2, Search, MapPin, Phone, UserCircle, CalendarDays, UsersRound, PlusCircle } from 'lucide-vue-next';

// --- Props ---
const props = defineProps({
  participants: {
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
    default: 10 // Default items per page
  },
  newlyCreatedId: {
    type: [Number, String],
    default: null
  }
});

// --- Emits ---
const emit = defineEmits([
    'edit-participant',
    'delete-participant',
    'add-new-participant' // New event for the add button
]);

// --- State ---
const searchTerm = ref('');
const currentPage = ref(1); // Pagination state

// --- Computed Properties ---
const filteredParticipants = computed(() => {
  if (!searchTerm.value) {
    return props.participants;
  }
  const lowerSearch = searchTerm.value.toLowerCase();
  return props.participants.filter(p =>
    p.name.toLowerCase().includes(lowerSearch) ||
    (p.contact_info && p.contact_info.toLowerCase().includes(lowerSearch)) ||
    (p.referrer_name && p.referrer_name.toLowerCase().includes(lowerSearch)) ||
    (p.locality && p.locality.toLowerCase().includes(lowerSearch)) ||
    (p.main_address && p.main_address.toLowerCase().includes(lowerSearch))
  );
});

const paginatedParticipants = computed(() => {
  const start = (currentPage.value - 1) * props.itemsPerPage;
  const end = start + props.itemsPerPage;
  return filteredParticipants.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredParticipants.value.length / props.itemsPerPage);
});

// --- Helper Functions ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const offset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + offset);
        return adjustedDate.toLocaleDateString('en-CA');
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Invalid Date';
    }
};

const formatGender = (genderCode) => {
    if (genderCode === 'M') return 'Masculin';
    if (genderCode === 'F') return 'Feminin';
    return 'N/A';
};

// --- Methods ---
const handleEditClick = (participant) => {
  emit('edit-participant', participant);
};

const handleDeleteClick = (participantId) => {
  emit('delete-participant', participantId);
};

const handleAddNewParticipantClick = () => {
  emit('add-new-participant'); // Emit event to be caught by App.vue
};

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const handleBaptismToggle = async (participant) => {
  const newValue = !participant.baptism_interest;
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/participants/${participant.id}/baptism-interest`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        // Include the Authorization header with the token
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({ baptism_interest: newValue })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la mise à jour');
    }

    participant.baptism_interest = newValue; // Mise à jour locale
  } catch (err) {
    alert("Erreur : " + err.message);
  }
};


</script>

<template>
  <div class="card w-100 shadow-sm mb-4 h-100 d-flex flex-column">
    <div class="card-header bg-light p-3 flex-shrink-0">
      <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center">
        <h2 class="h5 mb-2 mb-sm-0 text-primary d-flex align-items-center">
          <Users class="me-2" :size="22" />Liste des participants
          <span class="badge bg-danger ms-2">{{ filteredParticipants.length }}</span>
        </h2>
        <div class="d-flex flex-column flex-sm-row align-items-sm-center gap-2 mt-3 mt-sm-0">
            <div class="input-group input-group-sm" style="max-width: 220px;">
              <span class="input-group-text bg-white border-end-0"><Search :size="16"/></span>
              <input
                type="search"
                class="form-control border-start-0"
                placeholder="Rechercher..."
                v-model="searchTerm"
                aria-label="Search participants"
              >
            </div>
            <button @click="handleAddNewParticipantClick" class="btn btn-primary btn-sm d-flex align-items-center ms-sm-2">
                <PlusCircle class="me-1" :size="16" /> Ajouter un Participant
            </button>
        </div>
      </div>
    </div>

    <div class="card-body p-0 flex-grow-1" style="overflow-y: auto;">
      <div v-if="loading" class="text-center p-5 text-muted d-flex flex-column justify-content-center align-items-center h-100">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-2 mb-0">Chargement des participants...</p>
      </div>

      <div v-else-if="!filteredParticipants.length" class="text-center p-5 text-muted d-flex flex-column justify-content-center align-items-center h-100">
        <UsersRound :size="48" class="mb-2" />
        <p class="mb-1 fw-bold">
            {{ searchTerm ? 'No participants found.' : 'No participants yet.' }}
        </p>
        <p class="small">
            {{ searchTerm ? 'Try a different search term.' : 'Click "Add Participant" to get started.' }}
        </p>
      </div>

      <div v-else>
        <div class="table-responsive d-none d-md-block">
          <table class="table table-hover table-bordered mb-0">
            <thead class="table-light sticky-top" style="z-index: 1;">
              <tr>
                <th scope="col" class="px-3">Nom</th>
                <th scope="col" class="px-3">Contact</th>
                <th scope="col" class="px-3">Quartier</th>
                <th scope="col" class="px-3">Date</th>
                <th scope="col" class="text-center px-3">Baptême</th>
                <th scope="col" class="text-end px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in paginatedParticipants" :key="p.id"
                  :class="{'highlight-new': p.id === Number(props.newlyCreatedId)}">
                <td class="align-middle px-3">
                  <div class="fw-medium">{{ p.name }}</div>
                  <div class="small text-muted">
                    {{ p.age ? `${p.age} yrs` : '' }}{{ p.age && p.gender ? ', ' : '' }}{{ p.gender ? formatGender(p.gender) : '' }}
                  </div>
                </td>
                <td class="align-middle small px-3">{{ p.contact_info || 'N/A' }}</td>
                <td class="align-middle small px-3">{{ p.locality || 'N/A' }}</td>
                <td class="align-middle small px-3">{{ formatDate(p.date_joined) }}</td>
                <td class="text-end align-middle px-3">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="p.baptism_interest"
                    @change="handleBaptismToggle(p)"
                    title="Intéressé par le baptême"
                  />
                </td>
                <td class="text-end align-middle px-3">
                    <button @click="handleEditClick(p)" title="Edit Participant" class="btn btn-sm btn-outline-secondary me-1 px-2 py-1 lh-1">
                      <Edit :size="16" />
                    </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="list-group list-group-flush d-md-none">
          <div v-for="p in paginatedParticipants" :key="p.id"
               class="list-group-item px-3 py-2"
               :class="{'highlight-new': p.id === Number(props.newlyCreatedId)}">
            <div class="d-flex w-100 justify-content-between align-items-start">
              <div>
                <h6 class="mb-1 fw-bold">{{ p.name }}</h6>
                <div v-if="p.id" class="participant-id-mobile mb-1">
                  <span>ID: </span><span class="display-6 fw-bold text-primary">{{ p.id }}</span>
                </div>
                <small class="text-muted d-block">
                  <UserCircle :size="14" class="me-1 align-text-bottom" />
                  {{ p.age ? `${p.age} yrs` : 'Age N/A' }}, {{ p.gender ? formatGender(p.gender) : 'Gender N/A' }}
                </small>
                 <small v-if="p.contact_info" class="text-muted d-block">
                  <Phone :size="14" class="me-1 align-text-bottom" /> {{ p.contact_info }}
                </small>
              </div>
              <div class="btn-group ms-2 flex-shrink-0">
                  <button @click="handleEditClick(p)" title="Edit Participant" class="btn btn-sm btn-outline-secondary px-2 py-1 lh-1">
                    <Edit :size="16" />
                  </button>
                  <!-- <button @click="handleDeleteClick(p.id)" title="Delete Participant" class="btn btn-sm btn-outline-danger px-2 py-1 lh-1">
                    <Trash2 :size="16" />
                  </button> -->
              </div>
            </div>
            <div class="mt-1">
              <small v-if="p.main_address" class="d-block text-muted">
                <MapPin :size="14" class="me-1 align-text-bottom" /> {{ p.main_address }}{{ p.locality ? `, ${p.locality}` : '' }}
              </small>
               <small v-else-if="p.locality" class="d-block text-muted">
                <MapPin :size="14" class="me-1 align-text-bottom" /> {{ p.locality }}
              </small>
              <small class="d-block text-muted">
                <CalendarDays :size="14" class="me-1 align-text-bottom" /> Date d'inscription: {{ formatDate(p.date_joined) }}
              </small>
              <small v-if="p.referrer_name" class="d-block text-muted">
                <UsersRound :size="14" class="me-1 align-text-bottom" /> Référent: {{ p.referrer_name }}
              </small>
              <div class="form-check mt-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  :id="`baptism-mobile-${p.id}`"
                  :checked="p.baptism_interest"
                  @change="handleBaptismToggle(p)"
                />
                <label class="form-check-label small" :for="`baptism-mobile-${p.id}`">
                  Intéressé par le baptême
                </label>
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
.table-responsive {
    /* Max height can be set here if needed, or rely on card-body overflow */
}
.table thead th {
    vertical-align: middle;
    padding-top: 0.65rem;
    padding-bottom: 0.65rem;
    padding-left: var(--bs-gutter-x, 0.75rem);
    padding-right: var(--bs-gutter-x, 0.75rem);
    font-weight: 500;
    white-space: nowrap;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.table tbody td {
    vertical-align: middle;
    padding-top: 0.65rem;
    padding-bottom: 0.65rem;
    padding-left: var(--bs-gutter-x, 0.75rem);
    padding-right: var(--bs-gutter-x, 0.75rem);
}
.table td .small {
    font-size: 0.8rem;
}

.list-group-item {
    padding-left: var(--bs-gutter-x, 0.75rem);
    padding-right: var(--bs-gutter-x, 0.75rem);
    border-bottom: 1px solid rgba(0,0,0,.08);
}
.list-group-item:last-child {
    border-bottom: 0;
}
.list-group-item h6 {
    color: var(--bs-primary);
}
.list-group-item small svg {
    vertical-align: -2px;
}

.btn-sm.lh-1 {
    line-height: 1;
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
.badge.bg-secondary {
    font-size: 0.7em;
    padding: 0.3em 0.5em;
    vertical-align: middle;
}
.card-header h2.h5 { /* Ensure title doesn't have too much margin if it's the only thing */
    margin-bottom: 0 !important;
}
.form-check-input {
  cursor: pointer;
  transform: scale(1.1);
}

.participant-id-mobile {
  font-size: 2rem;
  font-weight: bold;
  color: var(--bs-primary, #0d6efd);
  line-height: 1.1;
}

.highlight-new {
  animation: highlight-fade 2.5s ease-out;
  background-color: #fff3cd !important; /* Bootstrap warning bg */
}
@keyframes highlight-fade {
  0% { background-color: #ffe066; }
  60% { background-color: #fff3cd; }
  100% { background-color: inherit; }
}

</style>