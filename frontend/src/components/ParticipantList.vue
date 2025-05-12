<script setup>
import { ref, computed } from 'vue';
import { Users, Edit, Trash2, Search } from 'lucide-vue-next'; // Import necessary icons

// --- Props ---
// participants: The array of participant objects passed from the parent (App.vue)
// loading: Boolean indicating if the participant data is currently being fetched
const props = defineProps({
  participants: {
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
// edit-participant: Emits the participant object when the edit button is clicked
// delete-participant: Emits the participant ID when the delete button is clicked
const emit = defineEmits(['edit-participant', 'delete-participant']);

// --- State ---
// Ref to store the user's search input
const searchTerm = ref('');

// --- Computed Properties ---
// Filters the participants array based on the searchTerm
const filteredParticipants = computed(() => {
  if (!searchTerm.value) {
    return props.participants; // Return all if search is empty
  }
  const lowerSearch = searchTerm.value.toLowerCase();
  return props.participants.filter(p =>
    p.name.toLowerCase().includes(lowerSearch) ||
    (p.contact_info && p.contact_info.toLowerCase().includes(lowerSearch)) ||
    (p.referrer_name && p.referrer_name.toLowerCase().includes(lowerSearch)) ||
    (p.main_address && p.main_address.toLowerCase().includes(lowerSearch)) ||
    (p.locality && p.locality.toLowerCase().includes(lowerSearch))
  );
});

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
// Emits the 'edit-participant' event with the participant object
const handleEditClick = (participant) => {
  emit('edit-participant', participant);
};

// Emits the 'delete-participant' event with the participant ID
const handleDeleteClick = (participantId) => {
  // Optional: Add a confirmation dialog here if preferred within the component
  // if (confirm('Are you sure you want to delete this participant?')) {
       emit('delete-participant', participantId);
  // }
};

</script>

<template>
  <div class="card shadow-sm">
    <div class="card-header bg-light p-3">
      <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center">
        <div>
          <h5 class="card-title mb-1 d-flex align-items-center">
            <Users class="me-2" :size="20" /> Participants ({{ filteredParticipants.length }})
          </h5>
           <!-- <p class="card-subtitle text-muted small d-none d-sm-block">View, edit, or remove participants.</p> -->
        </div>
        <div class="input-group mt-2 mt-sm-0" style="max-width: 300px;">
          <span class="input-group-text"><Search :size="16"/></span>
          <input
            type="search"
            class="form-control form-control-sm"
            placeholder="Rechercher des participants..."
            v-model="searchTerm"
            aria-label="Rechercher des participants"
          >
        </div>
      </div>
    </div>

    <div class="card-body p-0">
      <div v-if="loading" class="text-center p-4 text-muted">
        <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
        <span class="ms-2">Chargement des participants...</span>
      </div>

      <div v-else class="table-responsive">
        <table class="table table-hover mb-0">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Contact</th>
              <th scope="col">Âge</th>
              <th scope="col">Adresse</th>
              <th scope="col">Quartier</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loading && filteredParticipants.length === 0">
              <td colspan="8" class="text-center text-muted py-4">
                {{ searchTerm ? 'Aucun participant trouvé.' : 'Aucun participant ajouté.' }}
              </td>
            </tr>
            <tr v-for="p in filteredParticipants" :key="p.id">
              <td>{{ p.name }}</td>
              <td>{{ p.contact_info || 'N/A' }}</td>
              <td>{{ p.age || 'N/A' }}</td>
              <td>{{ p.main_address || 'N/A' }}</td>
              <td>{{ p.locality || 'N/A' }}</td>
              <td>
                <button
                  @click="handleEditClick(p)"
                  title="Modifier le participant"
                  class="btn btn-sm btn-outline-secondary me-1 px-1 py-0"
                >
                  <Edit :size="16" />
                </button>
                <!-- <button
                  @click="handleDeleteClick(p.id)"
                  title="Supprimer le participant"
                  class="btn btn-sm btn-outline-danger px-1 py-0"
                >
                  <Trash2 :size="16" />
                </button> -->
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>
</template>

<style scoped>
/* Scoped styles for ParticipantList component */
.table th {
    /* Example: Make table headers slightly bolder */
    font-weight: 500;
    white-space: nowrap; /* Prevent header text wrapping */
}
.table td {
    /* Example: Vertically align table cell content */
    vertical-align: middle;
}
.input-group-text {
    background-color: #e9ecef; /* Match default Bootstrap input group style */
    border-right: 0;
}
.form-control {
    border-left: 0; /* Remove double border next to icon */
}
.form-control:focus {
     border-color: #dee2e6; /* Prevent border color change on focus */
     box-shadow: none; /* Remove focus shadow */
     border-left: 0;
}
</style>
