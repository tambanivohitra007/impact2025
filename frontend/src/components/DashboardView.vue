<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { Users, TrendingUp, Award, MapPin, BarChart2, UserPlus, CalendarCheck } from 'lucide-vue-next';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns'; // Import the date adapter

// --- State ---
const stats = ref({
  totalParticipants: 0,
  attendanceBySession: [], // For line chart
  topReferrers: [],
  perfectAttendance: [],
  todayAttendanceByLocality: [],
  newParticipantsByDay: [], // Added this based on your server.js
});

const totalPresentToday = computed(() => {
  return stats.value.todayAttendanceByLocality?.reduce((sum, row) => sum + row.present_count, 0) || 0;
});

const baptismInterested = ref([]);
const showBaptismListModal = ref(false);


const fetchBaptismInterested = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/participants/interested-in-baptism`);
    if (!response.ok) throw new Error("Erreur chargement participants baptême");
    baptismInterested.value = await response.json();
  } catch (err) {
    console.error("Erreur fetch baptism participants:", err);
  }
};

onMounted(async () => {
  await fetchStats();
  await fetchBaptismInterested(); // 👈 ajouté ici
  await nextTick();
  initCharts();
});

watch(showBaptismListModal, (val) => {
  if (val) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
});


const loading = ref(true);
const error = ref(null);
const selectedDate = ref(new Date().toISOString().split('T')[0]); // For "Today's Attendance by Locality"

// Chart instances
let attendanceChartInstance = null;
let newParticipantsChartInstance = null;

// --- API Call ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// const API_BASE_URL = 'http://localhost:3001/api';

const fetchStats = async (date = null) => {
  loading.value = true;
  error.value = null;
  let queryParams = '';
  if (date) {
    queryParams = `?date=${date}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats${queryParams}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch dashboard stats and could not parse error response.' }));
      throw new Error(errorData.error || errorData.message || `HTTP error ${response.status}`);
    }
    const fetchedStats = await response.json();
    // Ensure all keys exist, even if empty, to prevent template errors
    stats.value = {
        totalParticipants: fetchedStats.totalParticipants || 0,
        attendanceBySession: fetchedStats.attendanceBySession || [],
        topReferrers: fetchedStats.topReferrers || [],
        perfectAttendance: fetchedStats.perfectAttendance || [],
        todayAttendanceByLocality: fetchedStats.todayAttendanceByLocality || [],
        newParticipantsByDay: fetchedStats.newParticipantsByDay || [],
    };
  } catch (err) {
    console.error("Error fetching stats:", err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// --- Chart Initialization ---
const initCharts = () => {
  initAttendanceChart();
  initNewParticipantsChart();
};

const initAttendanceChart = () => {
  if (attendanceChartInstance) {
    attendanceChartInstance.destroy();
  }
  const ctx = document.getElementById('attendanceChart');
  if (!ctx || !stats.value.attendanceBySession) {
    console.warn("Attendance chart canvas not found or no data.");
    return;
  }

  if (stats.value.attendanceBySession.length === 0 && !loading.value) {
      const canvasCtx = ctx.getContext('2d');
      canvasCtx.clearRect(0, 0, ctx.width, ctx.height);
      canvasCtx.font = "14px Arial";
      canvasCtx.fillStyle = "#6c757d";
      canvasCtx.textAlign = "center";
      canvasCtx.fillText("No attendance data for chart.", ctx.width / 2, ctx.height / 2);
      return;
  }

  // Sort data by date for the line chart
  const chartData = [...stats.value.attendanceBySession].sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

  attendanceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.map(d => new Date(d.session_date)),
      datasets: [{
        label: 'Participants Present',
        data: chartData.map(d => d.attendance_count),
        borderColor: 'rgb(54, 162, 235)', // Bootstrap Primary
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.2,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (tooltipItems) => new Date(tooltipItems[0].parsed.x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', tooltipFormat: 'MMM d, yyyy', displayFormats: { day: 'MMM d' } },
          title: { display: false, text: 'Session Date' },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
          title: { display: false, text: 'Count' }
        }
      }
    }
  });
};

const initNewParticipantsChart = () => {
  if (newParticipantsChartInstance) {
    newParticipantsChartInstance.destroy();
  }
  const ctx = document.getElementById('newParticipantsChart');
   if (!ctx || !stats.value.newParticipantsByDay) {
    console.warn("New participants chart canvas not found or no data.");
    return;
  }

  if (stats.value.newParticipantsByDay.length === 0 && !loading.value) {
      const canvasCtx = ctx.getContext('2d');
      canvasCtx.clearRect(0, 0, ctx.width, ctx.height);
      canvasCtx.font = "14px Arial";
      canvasCtx.fillStyle = "#6c757d";
      canvasCtx.textAlign = "center";
      canvasCtx.fillText("No new participant data for chart.", ctx.width / 2, ctx.height / 2);
      return;
  }

  // Sort data by date
  const chartData = [...stats.value.newParticipantsByDay].sort((a, b) => new Date(a.join_date) - new Date(b.join_date));

  newParticipantsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.map(d => new Date(d.join_date)),
      datasets: [{
        label: 'New Participants',
        data: chartData.map(d => d.new_participants),
        backgroundColor: 'rgba(25, 135, 84, 0.7)', // Bootstrap Success
        borderColor: 'rgb(25, 135, 84)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
         tooltip: {
          callbacks: {
            title: (tooltipItems) => new Date(tooltipItems[0].parsed.x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', tooltipFormat: 'MMM d, yyyy', displayFormats: { day: 'MMM d' } },
          title: { display: false, text: 'Join Date' },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
          title: { display: false, text: 'Count' }
        }
      }
    }
  });
};

// --- Lifecycle Hooks ---
onMounted(async () => {
  await fetchStats(selectedDate.value); // Fetch for today initially
  await nextTick();
  initCharts();
});

// Re-fetch stats and update charts if the selectedDate changes
watch(selectedDate, async (newDate) => {
    await fetchStats(newDate);
    await nextTick();
    // Only need to re-init charts if their data source depends on the date (e.g., todayAttendanceByLocality)
    // For now, the main charts are not date-dependent, but this is good practice if they were.
    // We might need to update the locality data specifically if the chart was for it.
    // For the current setup, re-initializing all charts is fine as fetchStats updates all data.
    initCharts();
});

// Helper to format date for display
const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

</script>

<template>
    <div class="card w-100 shadow-sm mb-4 h-100 d-flex flex-column">
      <div class="card-header bg-light p-3 flex-shrink-0">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="mb-0 d-flex align-items-center">
              <BarChart2 :size="28" class="me-2 text-primary" />Dashboard
          </h4>
          <div>
              <label for="statsDate" class="form-label form-label-sm visually-hidden">Date pour les Stats des quartiers</label>
              <input type="date" class="form-control form-control-sm" id="statsDate" v-model="selectedDate">
          </div>
      </div>
      </div>
      <hr>
      <div v-if="loading" class="text-center p-5">
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-2 text-muted">Chargement des données du dashboard ...</p>
    </div>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      Erreur lors du chargement des données du dashboard: {{ error }}
    </div>
    
    <div v-else class="row g-3 g-lg-4">
      <div class="col-md-6 col-lg-3">
        <div class="card shadow-sm h-100 border-start border-primary border-4">
          <div class="card-body text-center">
            <Users class="text-primary mb-2" :size="32" />
            <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Nombre des Participants</h6>
            <p class="display-6 fw-bold mb-0">{{ stats.totalParticipants }}</p>
          </div>
        </div>
      </div>
    <div class="col-md-6 col-lg-3">
      <div
        class="card shadow-sm h-100 border-start border-success border-4"
        style="cursor: pointer;"
        @click="showBaptismListModal = true"
      >
        <div class="card-body text-center">
          <CalendarCheck class="text-success mb-2" :size="32" />
          <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Futurs Baptêmes</h6>
          <p class="display-6 fw-bold mb-0">{{ baptismInterested.length }}</p>
        </div>
      </div>
    </div>

    <template v-if="showBaptismListModal">
      <div class="modal fade show" tabindex="-1" style="display: block;" v-if="showBaptismListModal">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Participants à baptiser</h5>
              <button type="button" class="btn-close" @click="showBaptismListModal = false"></button>
            </div>
            <div class="modal-body">
              <table class="table table-striped table-sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Âge</th>
                    <th>Contact</th>
                    <th>Quartier</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="baptismInterested.length === 0">
                    <td colspan="5" class="text-center text-muted">Aucun participant n’est encore inscrit pour le baptême</td>
                  </tr>
                  <tr v-for="p in baptismInterested" :key="p.id">
                    <td>{{ p.id }}</td>
                    <td>{{ p.name }}</td>
                    <td>{{ p.age || '-' }}</td>
                    <td>{{ p.contact_info || '-' }}</td>
                    <td>{{ p.locality || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" @click="showBaptismListModal = false">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    </template>

      <div class="col-md-6 col-lg-3">
        <div class="card shadow-sm h-100 border-start border-info border-4">
          <div class="card-body text-center">
            <TrendingUp class="text-info mb-2" :size="32" />
            <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Présents aujourd'hui</h6>
            <p class="display-6 fw-bold mb-0">{{ totalPresentToday }}</p>
             </div>
        </div>
      </div>
       <div class="col-md-6 col-lg-3">
        <div class="card shadow-sm h-100 border-start border-warning border-4">
          <div class="card-body text-center">
            <Award class="text-warning mb-2" :size="32" />
            <h6 class="card-subtitle mb-1 text-muted small text-uppercase">Paticipants assidus</h6>
            <p class="display-6 fw-bold mb-0">{{ stats.perfectAttendance?.length || 0 }}</p>
          </div>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="card shadow-sm h-100">
          <div class="card-header bg-light py-2">
            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
              <BarChart2 class="me-2 text-primary" :size="18" />
              Participants présents par Session
            </h6>
          </div>
          <div class="card-body">
            <div style="height: 280px;">
              <canvas id="attendanceChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-5">
        <div class="card shadow-sm h-100">
          <div class="card-header bg-light py-2">
            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
              <TrendingUp class="me-2 text-info" :size="18" /> Top Référents
            </h6>
          </div>
          <div class="card-body p-0" style="max-height: 280px; overflow-y: auto;">
            <ul v-if="stats.topReferrers && stats.topReferrers.length > 0" class="list-group list-group-flush">
              <li v-for="ref in stats.topReferrers.slice(0, 7)" :key="ref.id" class="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                <span class="small">{{ ref.name }}</span>
                <span class="badge bg-info rounded-pill">{{ ref.referral_count }}</span>
              </li>
            </ul>
            <p v-else class="text-muted text-center small p-3 mb-0">Pas de données de référent disponibles.</p>
          </div>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="card shadow-sm h-100">
            <div class="card-header bg-light py-2">
                <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
                    <UserPlus class="me-2 text-success" :size="18" /> Nouveaux inscrits
                </h6>
            </div>
            <div class="card-body">
                <div style="height: 280px;">
                    <canvas id="newParticipantsChart"></canvas>
                </div>
            </div>
        </div>
      </div>

      <div class="col-lg-5">
        <div class="card shadow-sm h-100">
          <div class="card-header bg-light py-2">
            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
              <Award class="me-2 text-warning" :size="18" /> Participants toujours présents
            </h6>
          </div>
          <div class="card-body p-0" style="max-height: 280px; overflow-y: auto;">
            <ul v-if="stats.perfectAttendance && stats.perfectAttendance.length > 0" class="list-group list-group-flush">
               <li v-for="p in stats.perfectAttendance.slice(0, 7)" :key="p.id" class="list-group-item py-2 px-3 small">
                {{ p.name }}
                </li>
            </ul>
            <p v-else class="text-muted text-center small p-3 mb-0">Personne n’a encore assisté à toutes les séances.</p>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-header bg-light py-2">
            <h6 class="card-title d-flex align-items-center mb-0 small text-uppercase">
              <MapPin class="me-2 text-danger" :size="18" />
              Présence par quartier ({{ formatDateForDisplay(selectedDate) }})
            </h6>
          </div>
          <div class="card-body p-0">
            <div v-if="stats.todayAttendanceByLocality && stats.todayAttendanceByLocality.length > 0" class="table-responsive">
              <table class="table table-sm table-hover table-striped mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Quartier</th>
                    <th class="text-end">Nombre de présents</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in stats.todayAttendanceByLocality" :key="row.locality">
                    <td>{{ row.locality || 'Not Specified' }}</td>
                    <td class="text-end fw-medium">{{ row.present_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted text-center small p-3 mb-0">Pas de présence pour {{ formatDateForDisplay(selectedDate) }}.</p>
          </div>
        </div>
      </div>
    </div>
    </div>

</template>

<style scoped>
.dashboard-container {
  /* max-width: 1600px; */
}
.card {
  border: none;
  /* border-radius: 0.375rem; */ /* Bootstrap default */
}
.card-header.bg-light {
    background-color: #f8f9fa !important; /* Ensure light bg for headers */
    border-bottom: 1px solid #e9ecef;
}
.card-title.small {
    font-weight: 500;
    font-size: 0.9rem;
    color: #495057;
}
.card-subtitle.small {
    font-size: 0.8rem;
}
.display-6 {
    font-size: 2rem; /* Slightly smaller for stat cards */
}
.table th {
  font-weight: 500;
  white-space: nowrap;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: #6c757d;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
.table td {
  vertical-align: middle;
  font-size: 0.875rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
.table-sm th, .table-sm td {
  padding: 0.4rem;
}
.list-group-item {
    font-size: 0.875rem;
    border-left:0;
    border-right:0;
}
.list-group-item:first-child {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
}
.list-group-item:last-child {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom:0; /* Remove last border if inside card-body p-0 */
}
.border-start.border-4 {
    border-left-width: 4px !important;
}
/* Ensure chart containers have a defined height for maintainAspectRatio: false */
canvas {
  width: 100% !important;
  height: 100% !important;
}
.form-label-sm {
    font-size: .75rem;
    margin-bottom: .25rem;
}
.modal-open {
  overflow: hidden;
}

</style>