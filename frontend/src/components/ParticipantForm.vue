<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { AlertCircle } from 'lucide-vue-next'; // Icon for error messages

// --- Props ---
// initialParticipant: Object passed when editing (null/undefined for adding)
// participants: Full list needed for the 'Referred By' dropdown
// saving: Boolean passed from parent to disable form during API calls
const props = defineProps({
  initialParticipant: Object,
  participants: {
    type: Array,
    default: () => [] // Default to empty array if not provided
  },
  saving: Boolean,
});

// --- Emits ---
// save: Emits the participant data payload when the form is submitted successfully
// cancel: Emits when the user cancels the form (e.g., closes the modal)
const emit = defineEmits(['save', 'cancel']);

// --- State ---
// Reactive object to hold the form data
const formData = reactive({
  id: null,
  name: '',
  contact_info: '',
  age: '',
  gender: '',
  main_address: '',
  locality: '',
  date_joined: '',
  referred_by_participant_id: '',
});
// Ref to store any validation or API errors for display
const formError = ref('');

// --- Helper Functions ---
// Helper to format date to YYYY-MM-DD for the date input
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    // Adjust for timezone offset when creating the date string
    const offset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + offset);
    return adjustedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  } catch (e) {
    console.error("Error formatting date for input:", dateString, e);
    return '';
  }
};

// Helper to get today's date in YYYY-MM-DD format
const todayDateString = () => new Date().toLocaleDateString('en-CA');

// Function to reset the form fields based on the initialParticipant prop
const resetForm = (participant) => {
  formData.id = participant?.id || null;
  formData.name = participant?.name || '';
  formData.contact_info = participant?.contact_info || '';
  formData.age = participant?.age || '';
  formData.gender = participant?.gender || '';
  formData.main_address = participant?.main_address || '';
  formData.locality = participant?.locality || '';
  formData.date_joined = formatDateForInput(participant?.date_joined) || todayDateString();
  formData.referred_by_participant_id = participant?.referred_by_participant_id || '';
  formError.value = ''; // Clear any previous errors
};

// --- Watchers ---
// Watch the initialParticipant prop. When it changes (e.g., modal opens for edit/add),
// reset the form data accordingly. 'immediate: true' ensures it runs on initial mount.
watch(() => props.initialParticipant, (newVal) => {
  resetForm(newVal);
}, { immediate: true, deep: true }); // deep might be needed if initialParticipant is complex

// --- Computed Properties ---
// Filter the participants list to exclude the person being edited from the 'Referred By' dropdown
const availableReferrers = computed(() => {
  return props.participants.filter(p => p.id !== formData.id);
});

// --- Methods ---
// Method called when the form is submitted
const submit = async () => {
  formError.value = ''; // Clear previous errors

  // Basic validation
  if (!formData.name.trim()) {
    formError.value = 'Participant name cannot be empty.';
    return;
  }
  if (!formData.date_joined) {
    formError.value = 'Date joined cannot be empty.';
    return;
  }

  // Prepare the data payload to be sent
  const dataToSave = {
    name: formData.name.trim(),
    contact_info: formData.contact_info.trim(),
    age: formData.age ? parseInt(formData.age) : null,
    gender: formData.gender || null,
    main_address: formData.main_address.trim(),
    locality: formData.locality.trim(),
    date_joined: formData.date_joined,
    referred_by_participant_id: formData.referred_by_participant_id
                                  ? parseInt(formData.referred_by_participant_id, 10)
                                  : null,
  };

  // Emit the 'save' event with the data
  const apiError = await emit('save', dataToSave);
  if (apiError) {
    formError.value = apiError;
  } else {
    // Reset form after successful save
    resetForm(null);
  }
};

// Expose the submit method so the parent component (modal footer) can trigger it
defineExpose({
  submit
});

</script>

<template>
  <form @submit.prevent="submit">
    <div v-if="formError" class="alert alert-danger d-flex align-items-center p-2 small" role="alert">
      <AlertCircle class="me-2 flex-shrink-0" :size="18" />
      <div>{{ formError }}</div>
    </div>

    <div class="mb-3">
      <label for="part-form-name" class="form-label">Nom <span class="text-danger">*</span></label>
      <input
        id="part-form-name"
        v-model="formData.name"
        type="text"
        required
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="part-form-contact" class="form-label">Contact (Téléphone/Email)</label>
      <input
        id="part-form-contact"
        v-model="formData.contact_info"
        type="text"
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="age" class="form-label">Âge</label>
      <input
        id="age"
        v-model="formData.age"
        type="number"
        min="0"
        max="120"
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="gender" class="form-label">Genre</label>
      <select
        id="gender"
        v-model="formData.gender"
        class="form-select form-select-sm"
        :disabled="saving"
      >
        <option value="">Sélectionner...</option>
        <option value="M">Masculin</option>
        <option value="F">Féminin</option>
      </select>
    </div>

    <div class="mb-3">
      <label for="main_address" class="form-label">Adresse</label>
      <input
        id="main_address"
        v-model="formData.main_address"
        type="text"
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="part-form-locality" class="form-label">Quartier</label>
      <input
        id="part-form-locality"
        v-model="formData.locality"
        type="text"
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="part-form-joined" class="form-label">Date d'inscription <span class="text-danger">*</span></label>
      <input
        id="part-form-joined"
        type="date"
        v-model="formData.date_joined"
        required
        class="form-control form-control-sm"
        :disabled="saving"
      >
    </div>

    <div class="mb-3">
      <label for="part-form-referrer" class="form-label">Recommandé par</label>
      <select
        id="part-form-referrer"
        v-model="formData.referred_by_participant_id"
        class="form-select form-select-sm"
        :disabled="saving"
      >
        <option value="">-- Aucun --</option>
        <option v-for="p in availableReferrers" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
    </div>

    </form>
</template>

<style scoped>
/* Add component-specific styles if necessary */
.form-label {
    font-weight: 500; /* Slightly bolder labels */
}
</style>
