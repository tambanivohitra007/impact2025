<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { AlertCircle } from 'lucide-vue-next';

// --- Props ---
const props = defineProps({
  initialParticipant: Object,
  participants: {
    type: Array,
    default: () => []
  },
  saving: Boolean,
});

// --- Emits ---
const emit = defineEmits(['save', 'cancel']);

// --- State ---
const formData = reactive({
  id: null,
  name: '',
  contact_info: '',
  age: null,
  gender: '', // 'M' or 'F'
  main_address: '',
  locality: '',
  date_joined: '',
  referred_by_participant_id: '',
  joining_reason: '',
});
const formError = ref('');

// --- Helper Functions ---
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + offset);
    return adjustedDate.toLocaleDateString('en-CA');
  } catch (e) {
    console.error("Error formatting date for input:", dateString, e);
    return '';
  }
};

const todayDateString = () => new Date().toLocaleDateString('en-CA');

const showCustomLocality = ref(false);
const customLocality = ref('');
const referrerName = ref('');
const referrerNotFound = ref(false);

// Watch le champ ID pour rechercher le nom automatiquement
watch(() => formData.referred_by_participant_id, (newId) => {
  if (!newId) {
    referrerName.value = '';
    referrerNotFound.value = false;
    return;
  }

  const referrer = props.participants.find(p => p.id === Number(newId));
  if (referrer) {
    referrerName.value = referrer.name;
    referrerNotFound.value = false;
  } else {
    referrerName.value = '';
    referrerNotFound.value = true;
  }
});

const resetForm = (participant) => {
  formData.id = participant?.id || null;
  formData.name = participant?.name || '';
  formData.contact_info = participant?.contact_info || '';
  formData.age = participant?.age || null;
  formData.gender = participant?.gender || '';
  formData.main_address = participant?.main_address || '';
  formData.locality = participant?.locality || '';
  showCustomLocality.value = !['Mahabo', 'Andoharanofotsy', 'Manandona', 'Iavoloha','Ambohimanambola', 'Volotara'].includes(formData.locality);
  customLocality.value = showCustomLocality.value ? formData.locality : '';
  formData.date_joined = formatDateForInput(participant?.date_joined) || todayDateString();
  formData.referred_by_participant_id = participant?.referred_by_participant_id || '';
  formData.joining_reason = participant?.joining_reason || '';
  formError.value = '';
};

// --- Watchers ---
watch(() => props.initialParticipant, (newVal) => {
  resetForm(newVal);
}, { immediate: true, deep: true });

watch(() => formData.referred_by_participant_id, (newVal) => {
  if (newVal !== null && newVal !== '' && !isNaN(newVal)) {
    formData.joining_reason = 'Amis/Famille';
  }
});


// --- Computed Properties ---
const availableReferrers = computed(() => {
  return props.participants.filter(p => p.id !== formData.id);
});

// --- Methods ---
const submit = async () => {
  formError.value = '';
  if (!formData.name.trim()) {
    formError.value = 'Participant name cannot be empty.';
    return;
  }
  if (formData.age && (isNaN(parseInt(formData.age)) || parseInt(formData.age) <= 0)) {
    formError.value = 'Please enter a valid age.';
    return;
  }
   if (formData.gender && !['M', 'F'].includes(formData.gender)) {
    formError.value = 'Please select a valid gender.';
    return;
  }
  if (!formData.date_joined) {
      formError.value = 'Date joined cannot be empty.';
      return;
  }

  const dataToSave = {
    name: formData.name.trim(),
    contact_info: formData.contact_info?.trim() || null,
    age: formData.age ? parseInt(formData.age) : null,
    gender: formData.gender || null,
    main_address: formData.main_address?.trim() || null,
    locality: showCustomLocality.value ? customLocality.value.trim() : formData.locality.trim(),
    date_joined: formData.date_joined,
    referred_by_participant_id: formData.referred_by_participant_id
                                  ? parseInt(formData.referred_by_participant_id, 10)
                                  : null,
    joining_reason: formData.joining_reason || null
  };

  const apiError = await emit('save', dataToSave);
  if (apiError) {
    formError.value = apiError;
  } else {
    // Show popup with new participant ID if available
    if (dataToSave.id) {
      alert('Nouveau participant ajouté avec l\'ID : ' + dataToSave.id);
    }
    // Reset form after successful save
    resetForm(null);
  }
};

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

    <div class="row g-3">
      <div class="col-12">
        <label for="part-form-name" class="form-label">Nom<span class="text-danger">*</span></label>
        <input
          id="part-form-name"
          v-model="formData.name"
          type="text"
          required
          class="form-control form-control-sm"
          :disabled="saving"
        >
      </div>

      <div class="col-md-6">
        <label for="part-form-contact" class="form-label">Contact</label>
        <input
          id="part-form-contact"
          v-model="formData.contact_info"
          type="text"
          class="form-control form-control-sm"
          placeholder="Phone/Email"
          :disabled="saving"
        >
      </div>

      <div class="col-md-3 col-6">
        <label for="part-form-age" class="form-label">Age</label>
        <input
          id="part-form-age"
          v-model.number="formData.age"
          type="number"
          min="1"
          class="form-control form-control-sm"
          :disabled="saving"
        >
      </div>

      <div class="col-md-3 col-6">
        <label for="part-form-gender" class="form-label">Genre</label>
        <select
          id="part-form-gender"
          v-model="formData.gender"
          class="form-select form-select-sm"
          :disabled="saving"
        >
          <option value="">Selectionner</option>
          <option value="M">Masculin</option>
          <option value="F">Feminin</option>
        </select>
      </div>

      <div class="col-12">
        <label for="part-form-address" class="form-label">Adresse</label>
        <input
          id="part-form-address"
          v-model="formData.main_address"
          type="text"
          class="form-control form-control-sm"
          :disabled="saving"
        >
      </div>

      <div class="col-md-6">
        <label for="part-form-locality" class="form-label">Quartier</label>
        <select
          id="part-form-locality"
          v-model="formData.locality"
          @change="showCustomLocality = formData.locality === 'Autre'"
          class="form-select form-select-sm"
          :disabled="saving"
        >
          <option value="">-- Sélectionner un quartier --</option>
          <option value="Mahabo">Mahabo</option>
          <option value="Andoharanofotsy">Andoharanofotsy</option>
          <option value="Manandona">Manandona</option>
          <option value="Iavoloha">Iavoloha</option>
          <option value="Volotara">Volotara</option>
          <option value="Ambohimanambola">Ambohimanambola</option>
          <option value="Autre">Autre</option>
        </select>
      </div>

      <div class="mb-3" v-if="showCustomLocality">
        <label for="custom-locality" class="form-label">Nom du quartier</label>
        <input
          id="custom-locality"
          v-model="customLocality"
          type="text"
          class="form-control form-control-sm"
          :disabled="saving"
          placeholder="Entrer le nom du quartier"
        >
      </div>

      <div class="col-md-6">
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

      <div class="col-12">
        <label for="part-form-referrer" class="form-label">ID du parrain</label>
        <input
          id="part-form-referrer"
          v-model="formData.referred_by_participant_id"
          type="number"
          class="form-control form-control-sm"
          :disabled="saving"
          placeholder="Entrer l'ID du parrain"
        />
        <small class="text-muted" v-if="referrerName">
          Recommandé par : <strong>{{ referrerName }}</strong>
        </small>
        <small class="text-danger" v-if="referrerNotFound">
          Aucun participant trouvé avec cet ID
        </small>
      </div>

      <div class="col-md-6">
        <label for="joining_reason" class="form-label">Motif d'inscription</label>
        <select
          id="joining_reason"
          v-model="formData.joining_reason"
          class="form-select form-select-sm"
          :disabled="saving"
        >
          <option value="">-- Sélectionner un motif --</option>
          <option value="Tracte">Tracte</option>
          <option value="Affiche">Affiche</option>
          <option value="Amis/Famille">Amis / Famille</option>
          <option value="Radio">Radio</option>
          <option value="Social media">Réseaux sociaux</option>
          <option value="Autres">Autres</option>
        </select>
      </div>
    </div>
  </form>
</template>

<style scoped>
.form-label {
    font-weight: 500;
    font-size: 0.875rem; /* Slightly smaller labels for dense form */
}
.form-control-sm, .form-select-sm {
    font-size: 0.875rem;
}
/* Ensure select has a min-height if empty */
select:invalid { color: #6c757d; }
option[value=""] { color: #6c757d; }
option { color: initial; }
</style>
