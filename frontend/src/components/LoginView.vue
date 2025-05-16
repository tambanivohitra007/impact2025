<script setup>
import { ref, watch } from 'vue';
import { ShieldCheck, UserPlus, LogIn } from 'lucide-vue-next'; // Optional: for icons
import logo from '../assets/impact.png'; // Import the logo

// Props passed from App.vue
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  // This prop will receive error messages from App.vue (e.g., from API calls)
  externalErrorMessage: {
    type: String,
    default: '',
  }
});

const username = ref('');
const password = ref('');
// For client-side validation errors (e.g., empty fields)
const clientErrorMessage = ref('');

// Watch for external error messages and clear client-side ones
watch(() => props.externalErrorMessage, (newValue) => {
  if (newValue) {
    clientErrorMessage.value = ''; // Clear client error if server error appears
  }
});


// Define the events this component can emit
// 'login' will carry the credentials object
// 'show-register-form' will signal App.vue to switch to RegistrationView
const emit = defineEmits(['login', 'show-register-form']);

const handleLoginSubmit = () => {
  // Basic client-side validation
  if (!username.value.trim() || !password.value) {
    clientErrorMessage.value = 'Please enter both username and password.';
    return;
  }
  clientErrorMessage.value = ''; // Clear any previous client-side error

  // Emit the 'login' event with an object containing username and password
  emit('login', { username: username.value, password: password.value });
};

const requestRegistrationView = () => {
  clientErrorMessage.value = ''; // Clear errors when switching view
  // Emit the event to tell App.vue to show the registration form
  emit('show-register-form');
};
</script>

<template>
  <div class="card shadow-sm">
    <div class="card-body p-4 p-md-5">
      <div class="text-center mb-4">
        <!-- <img :src="logo" alt="Logo" style="width: 100px; height: auto;"> -->
      </div>
      <h2 class="card-title text-center mb-4 fw-bold">
        Se Connecter
      </h2>

      <div v-if="props.externalErrorMessage" class="alert alert-danger py-2 small mb-3" role="alert">
        {{ props.externalErrorMessage }}
      </div>
      <div v-if="clientErrorMessage" class="alert alert-warning py-2 small mb-3" role="alert">
        {{ clientErrorMessage }}
      </div>

      <form @submit.prevent="handleLoginSubmit">
        <div class="mb-3">
          <label for="loginUsername" class="form-label">Utilisateur</label>
          <input
            type="text"
            class="form-control form-control-md"
            id="loginUsername"
            v-model="username"
            placeholder="Enter your username"
            required
            :disabled="props.loading"
          />
        </div>

        <div class="mb-3">
          <label for="loginPassword" class="form-label">Mot de passe</label>
          <input
            type="password"
            class="form-control form-control-md"
            id="loginPassword"
            v-model="password"
            placeholder="Enter your password"
            required
            :disabled="props.loading"
          />
        </div>

        <div class="d-grid mb-3">
            <button
              type="submit"
              class="btn btn-primary-gradient btn-lg d-flex align-items-center justify-content-center rounded-pill"
              :disabled="props.loading"
            >
              <span v-if="props.loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              <LogIn v-else :size="20" class="me-2" />
              {{ props.loading ? 'Connexion...' : 'Se Connecter' }}
            </button>
          </div>
      </form>

      <div class="text-center">
        <p class="mb-0">
          Avez-vous un compte?
          <button
            type="button"
            class="btn btn-link p-0 align-baseline"
            @click="requestRegistrationView"
            :disabled="props.loading"
          >
             S'inscrire Ici
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure the overall container takes full viewport height if this is the root view for login */
.container-fluid.vh-100 {
  min-height: 100vh;
}

.form-control-lg {
  padding: 0.75rem 1rem; /* Slightly larger padding for a modern feel */
  font-size: 1rem;
}

.btn-md {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
}

.btn-link {
  text-decoration: none;
  font-weight: 500; /* Make link slightly bolder */
}
.btn-link:hover {
  text-decoration: underline;
}

.btn .lucide {
  vertical-align: middle; /* Better icon alignment */
  margin-top: -2px; /* Fine-tune icon position */
}

.alert .lucide {
    vertical-align: middle;
    margin-top: -1px;
}

/* Optional: Add subtle transitions */
.form-control, .btn {
  transition: all 0.2s ease-in-out;
}

.form-control:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25);
}

/* Specific styles for the branding column if needed */
.branding-column {
  /* Background is set inline for dynamic var usage, but can be moved here if static */
  background-size: cover;
  background-position: center;
}

/* Custom gradient button */
.btn-primary-gradient {
  background-image: linear-gradient(to right, var(--bs-primary) 0%, var(--bs-primary-dark, #0a58ca) 50%, var(--bs-primary) 100%);
  background-size: 200% auto; /* For hover effect */
  color: white;
  border: none; /* Remove border if using gradient background */
  transition: background-position 0.4s ease-in-out; /* Smooth transition for hover */
}

.btn-primary-gradient:hover {
  background-position: right center; /* Change gradient direction on hover */
  color: white;
  box-shadow: 0 4px 15px 0 rgba(var(--bs-primary-rgb), 0.35);
}

/* Ensure rounded-pill is effective */
.rounded-pill {
  border-radius: 50rem !important; /* Bootstrap's default for rounded-pill */
}
</style>
