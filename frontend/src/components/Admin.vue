<template>
  <div class="card w-100 shadow-sm h-100 d-flex flex-column">
    <div class="card-header bg-light p-3 flex-shrink-0">
      <h2 class="h5 mb-0 text-primary d-flex align-items-center">
        <SettingsIcon class="me-2" :size="22" /> Admin Panel
      </h2>
    </div>

    <div class="card-body flex-grow-1 p-3 p-md-4" style="overflow-y: auto;">

      <div v-if="adminViewMode === 'list'">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3 class="h6 mb-0 text-secondary d-flex align-items-center">
            <UsersIcon class="me-2" :size="20" /> User Management
          </h3>
          <button class="btn btn-success btn-sm d-flex align-items-center" @click="showAddUserForm">
            <UserPlusIcon class="me-1" :size="16" /> New User
          </button>
        </div>

        <div v-if="loading.users" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading users...</span>
          </div>
          <p class="mt-2 text-muted">Loading users...</p>
        </div>
        <div v-else-if="error.users" class="alert alert-danger" role="alert">
          <AlertCircleIcon class="me-1" :size="16" /> {{ error.users }}
        </div>
        <div v-else-if="users.length === 0" class="text-center py-5 text-muted">
          <UsersIcon :size="48" class="mb-3 opacity-50" />
          <p>No users found.</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover table-bordered table-sm align-middle">
            <thead class="table-light">
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <!-- <th scope="col">Created At</th> -->
                <th scope="col" class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.id }}</td>
                <td>{{ user.username }}</td>
                <td>
                  <span :class="['badge', user.role === 'admin' ? 'bg-primary' : 'bg-secondary']">
                    {{ user.role }}
                  </span>
                </td>
                <!-- <td>{{ formatDateForDisplay(user.created_at) }}</td> -->
                <td class="text-end">
                  <div class="btn-group btn-group-sm" role="group">
                    <button
                      class="btn btn-outline-primary d-flex align-items-center"
                      @click="showEditUserForm(user)"
                      title="Edit User"
                      :disabled="saving.deleteUser || saving.editUser"
                    >
                      <Edit3Icon class="me-1" :size="14" /> Edit
                    </button>
                    <button
                      class="btn btn-outline-danger d-flex align-items-center"
                      @click="confirmDeleteUser(user)"
                      title="Delete User"
                      :disabled="saving.deleteUser || saving.editUser || user.id === loggedInUserId"
                    >
                      <TrashIcon class="me-1" :size="14" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="adminViewMode === 'addUser'" class="add-user-form-container">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-secondary d-flex align-items-center">
                <UserPlusIcon class="me-2" :size="20" /> Add New User
            </h3>
            <button class="btn btn-outline-secondary btn-sm" @click="showUserList">
                <ArrowLeftIcon :size="16" class="me-1" /> Back to List
            </button>
        </div>
        <form @submit.prevent="handleAddNewUser" class="border p-3 p-md-4 rounded bg-light shadow-sm">
          <div v-if="error.addUser" class="alert alert-danger py-2 small">
              {{ error.addUser }}
          </div>
          <div class="mb-3">
            <label for="newUsername" class="form-label">Username</label>
            <input type="text" class="form-control" id="newUsername" v-model="newUser.username" required :disabled="saving.addUser">
          </div>
          <div class="mb-3">
            <label for="newPassword" class="form-label">Password</label>
            <input type="password" class="form-control" id="newPassword" v-model="newUser.password" required :disabled="saving.addUser">
            <div class="form-text">Password must be at least 6 characters long.</div>
          </div>
           <div class="mb-3">
            <label for="confirmNewPassword" class="form-label">Confirm Password</label>
            <input type="password" class="form-control" id="confirmNewPassword" v-model="newUser.confirmPassword" required :disabled="saving.addUser">
          </div>
          <div class="mb-3">
            <label for="newUserRole" class="form-label">Role</label>
            <select class="form-select" id="newUserRole" v-model="newUser.role" :disabled="saving.addUser">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-outline-secondary btn-sm me-2" @click="showUserList" :disabled="saving.addUser">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm d-flex align-items-center" :disabled="saving.addUser">
              <span v-if="saving.addUser" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              <SaveIcon v-else class="me-1" :size="16" />
              {{ saving.addUser ? 'Adding...' : 'Add User' }}
            </button>
          </div>
        </form>
      </div>

      <div v-if="adminViewMode === 'editUser' && editingUser" class="edit-user-form-container">
         <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 mb-0 text-secondary d-flex align-items-center">
                <Edit3Icon class="me-2" :size="20" /> Edit User: {{ editingUser.username }}
            </h3>
            <button class="btn btn-outline-secondary btn-sm" @click="showUserList">
                 <ArrowLeftIcon :size="16" class="me-1" /> Back to List
            </button>
        </div>
        <form @submit.prevent="handleUpdateUser" class="border p-3 p-md-4 rounded bg-light shadow-sm">
          <div v-if="error.editUser" class="alert alert-danger py-2 small">
              {{ error.editUser }}
          </div>
          <div class="mb-3">
            <label for="editUsername" class="form-label">Username</label>
            <input type="text" class="form-control" id="editUsername" v-model="editingUser.username" required :disabled="saving.editUser">
          </div>
          <div class="mb-3">
            <label for="editUserRole" class="form-label">Role</label>
            <select class="form-select" id="editUserRole" v-model="editingUser.role" :disabled="saving.editUser || editingUser.id === loggedInUserId">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
             <div v-if="editingUser.id === loggedInUserId && editingUser.role !== 'admin'" class="form-text text-danger small mt-1">
              Warning: Changing your own role from admin might lock you out of admin functions if you are the only admin.
            </div>
             <div v-else-if="editingUser.id === loggedInUserId" class="form-text text-muted small mt-1">
              You are editing your own account. Be careful with role changes.
            </div>
          </div>
          <p class="form-text">Password changes should be done by the user via a "Forgot Password" feature or by an admin through a dedicated "Reset Password" function for security.</p>
          <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-outline-secondary btn-sm me-2" @click="showUserList" :disabled="saving.editUser">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm d-flex align-items-center" :disabled="saving.editUser || !editingUser">
              <span v-if="saving.editUser" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              <SaveIcon v-else class="me-1" :size="16" />
              {{ saving.editUser ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import {
    Settings as SettingsIcon,
    Users as UsersIcon,
    Trash2 as TrashIcon,
    UserPlus as UserPlusIcon,
    AlertCircle as AlertCircleIcon,
    Save as SaveIcon,
    Edit3 as Edit3Icon,
    ArrowLeft as ArrowLeftIcon // Added for back button
} from 'lucide-vue-next';

const props = defineProps({
  apiCall: {
    type: Function,
    required: true
  },
});

const adminViewMode = ref('list'); // 'list', 'addUser', 'editUser'

const users = ref([]);
const loading = reactive({
  users: false,
});
const saving = reactive({
    addUser: false,
    deleteUser: false,
    editUser: false,
});
const error = reactive({
  users: null,
  addUser: null,
  deleteUser: null,
  editUser: null,
});

const newUser = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  role: 'user',
});

const editingUser = ref(null); // Will hold { id, username, role }

const loggedInUserId = computed(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const payloadBase64 = token.split('.')[1];
            if (!payloadBase64) return null;
            const decodedPayload = JSON.parse(atob(payloadBase64));
            return decodedPayload.id;
        } catch (e) {
            console.error("Error decoding token for UI hint:", e);
            return null;
        }
    }
    return null;
});

const fetchUsers = async () => {
  loading.users = true;
  error.users = null;
  try {
    users.value = await props.apiCall('/admin/users', 'GET');
  } catch (err) {
    console.error("Failed to fetch users:", err);
    error.users = err.response?.data?.error || err.message || 'Failed to load users.';
  } finally {
    loading.users = false;
  }
};

const showUserList = () => {
    adminViewMode.value = 'list';
    editingUser.value = null; // Clear editing state
    // Reset newUser form if needed, though it's reset when opening
    newUser.username = '';
    newUser.password = '';
    newUser.confirmPassword = '';
    newUser.role = 'user';
    error.addUser = null;
    error.editUser = null;
};

// --- Add User Logic ---
const showAddUserForm = () => {
  newUser.username = '';
  newUser.password = '';
  newUser.confirmPassword = '';
  newUser.role = 'user';
  error.addUser = null;
  adminViewMode.value = 'addUser';
};

const handleAddNewUser = async () => {
  if (!newUser.username.trim() || !newUser.password || !newUser.confirmPassword) {
    error.addUser = "All fields are required.";
    return;
  }
  if (newUser.password !== newUser.confirmPassword) {
    error.addUser = "Passwords do not match.";
    return;
  }
  if (newUser.password.length < 6) {
    error.addUser = "Password must be at least 6 characters long.";
    return;
  }
  if (!['user', 'admin'].includes(newUser.role)) {
    error.addUser = "Invalid role selected.";
    return;
  }
  error.addUser = null;
  saving.addUser = true;
  try {
    await props.apiCall('/admin/users', 'POST', {
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
    });
    await fetchUsers();
    showUserList(); // Go back to list after adding
  } catch (err) {
    console.error("Failed to add user:", err);
    error.addUser = err.response?.data?.error || err.message || 'Failed to add user.';
  } finally {
    saving.addUser = false;
  }
};

// --- Edit User Logic ---
const showEditUserForm = (user) => {
  editingUser.value = { id: user.id, username: user.username, role: user.role };
  error.editUser = null;
  adminViewMode.value = 'editUser';
};

const handleUpdateUser = async () => {
  if (!editingUser.value || !editingUser.value.username.trim()) {
    error.editUser = "Username cannot be empty.";
    return;
  }
  if (!['user', 'admin'].includes(editingUser.value.role)) {
    error.editUser = "Invalid role selected.";
    return;
  }
  if (editingUser.value.id === loggedInUserId.value && editingUser.value.role === 'user') {
      const currentUserData = users.value.find(u => u.id === loggedInUserId.value);
      const otherAdminsExist = users.value.some(u => u.role === 'admin' && u.id !== loggedInUserId.value);
      if (currentUserData?.role === 'admin' && !otherAdminsExist) {
          error.editUser = "Cannot change the role of the only admin to 'user'.";
          return;
      }
  }
  error.editUser = null;
  saving.editUser = true;
  try {
    await props.apiCall(`/admin/users/${editingUser.value.id}`, 'PUT', {
      username: editingUser.value.username,
      role: editingUser.value.role,
    });
    await fetchUsers();
    showUserList(); // Go back to list after updating
  } catch (err) {
    console.error("Failed to update user:", err);
    error.editUser = err.response?.data?.error || err.message || 'Failed to update user.';
  } finally {
    saving.editUser = false;
  }
};

// --- Delete User Logic ---
const confirmDeleteUser = async (user) => {
  if (user.id === loggedInUserId.value) {
    alert("You cannot delete your own account using this interface.");
    return;
  }
  if (window.confirm(`Are you sure you want to delete the user "${user.username}" (Role: ${user.role})? This action cannot be undone.`)) {
    saving.deleteUser = true;
    error.deleteUser = null;
    try {
      await props.apiCall(`/admin/users/${user.id}`, 'DELETE');
      await fetchUsers();
      // If current view was editing this deleted user, switch back to list
      if (adminViewMode.value === 'editUser' && editingUser.value?.id === user.id) {
        showUserList();
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
      error.deleteUser = err.response?.data?.error || err.message || `Failed to delete user ${user.username}.`;
      alert(error.deleteUser);
    } finally {
      saving.deleteUser = false;
    }
  }
};

// --- Utility ---
const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString;
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateString;
  }
};

onMounted(() => {
  fetchUsers();
});

</script>

<style scoped>
.card.h-100 {
  /* Ensures the card itself tries to take full height of its parent (.view-wrapper) */
}
.card-body {
  /* flex-grow-1 and d-flex setup handles content filling and centering */
}
.card-header h2.h5 {
    margin-bottom: 0 !important;
}
.table-sm th, .table-sm td {
    padding: 0.4rem;
    font-size: 0.875rem;
    vertical-align: middle;
}
.btn-sm .lucide {
    vertical-align: text-bottom;
}
.btn-group-sm > .btn .lucide {
    margin-right: 0.25rem;
}
.form-text {
    font-size: 0.8em;
}
.badge {
    vertical-align: middle;
}
.badge.bg-primary {
    background-color: var(--bs-primary) !important;
}
.badge.bg-secondary {
    background-color: var(--bs-secondary) !important;
}
.add-user-form-container, .edit-user-form-container {
    max-width: 600px; /* Or your preferred max width for forms */
    margin: 0 auto; /* Center the form */
}
</style>
