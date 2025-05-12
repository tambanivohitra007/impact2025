<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { Users, TrendingUp, Award, MapPin, BarChart2 } from 'lucide-vue-next'; // Added MapPin and BarChart2
import Chart from 'chart.js/auto';


const stats = ref({
    totalParticipants: 0,
    attendanceBySession: [],
    topReferrers: [],
    perfectAttendance: [],
    todayAttendanceByLocality: []
});

const loading = ref(true);
const error = ref(null);
let attendanceChartInstance = null; // To hold the chart instance

// Fetch dashboard statistics
const fetchStats = async () => {
    loading.value = true;
    error.value = null;
    try {
        const response = await fetch('http://localhost:3001/api/dashboard/stats');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch dashboard stats and could not parse error.' }));
            throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        stats.value = await response.json();
    } catch (err) {
        console.error("Error fetching stats:", err);
        error.value = err.message;
    } finally {
        loading.value = false;
    }
};

// Initialize attendance chart
const initAttendanceChart = () => {
    if (attendanceChartInstance) {
        attendanceChartInstance.destroy(); // Destroy previous instance if exists
    }
    const ctx = document.getElementById('attendanceChart');
    if (!ctx || !stats.value.attendanceBySession || stats.value.attendanceBySession.length === 0) {
        if (ctx && stats.value.attendanceBySession && stats.value.attendanceBySession.length === 0 && !loading.value) {
            const canvasCtx = ctx.getContext('2d');
            canvasCtx.clearRect(0, 0, ctx.width, ctx.height); // Clear canvas
            canvasCtx.font = "16px Arial";
            canvasCtx.fillStyle = "#6c757d"; // Muted text color
            canvasCtx.textAlign = "center";
            canvasCtx.fillText("No attendance data available to display.", ctx.width / 2, ctx.height / 2);
        }
        return;
    }

    const data = stats.value.attendanceBySession.sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

    attendanceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.session_date)), // Use Date objects for time scale
            datasets: [{
                label: 'Nombre de participants',
                data: data.map(d => d.attendance_count),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                title: {
                    display: false, // Title is in card header
                    // text: 'Participation par session'
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            // Format date in tooltip
                            return new Date(tooltipItems[0].parsed.x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM d, yyyy', // e.g., Aug 15, 2023
                        displayFormats: {
                            day: 'MMM d' // e.g., Aug 15
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date de Session'
                    },
                    grid: {
                        display: false // Hide x-axis grid lines for cleaner look
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1, // Ensure y-axis shows whole numbers for counts
                        precision: 0 // No decimal places
                    },
                    title: {
                        display: true,
                        text: 'Participants Présents'
                    }
                }
            }
        }
    });
};

onMounted(async () => {
    await fetchStats();
    await nextTick(); // Ensure DOM is updated before trying to initialize chart
    initAttendanceChart();
});
</script>

<template>
  <div class="dashboard-container container-fluid py-3">
    <div v-if="loading" class="text-center p-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Chargement des données du tableau de bord...</p>
    </div>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      Erreur lors du chargement des données: {{ error }}
    </div>
    <div v-else class="row g-4">
      <!-- Total Participants Card -->
      <div class="col-lg-3 col-md-6">
        <div class="card shadow-sm h-100">
          <div class="card-body d-flex flex-column justify-content-center align-items-center text-center">
            <Users class="text-primary mb-2" :size="36" />
            <h6 class="card-subtitle mb-2 text-muted">Total Participants</h6>
            <p class="display-5 fw-bold mb-0">{{ stats.totalParticipants }}</p>
          </div>
        </div>
      </div>

      <!-- Placeholder for another stat card if needed -->
       <div class="col-lg-3 col-md-6">
        <div class="card shadow-sm h-100">
          <div class="card-body d-flex flex-column justify-content-center align-items-center text-center">
            <BarChart2 class="text-success mb-2" :size="36" />
            <h6 class="card-subtitle mb-2 text-muted">Sessions Enregistrées</h6>
            <p class="display-5 fw-bold mb-0">{{ stats.attendanceBySession?.length || 0 }}</p>
          </div>
        </div>
      </div>

      <!-- Top Referrers Card -->
      <div class="col-lg-6 col-md-12">
        <div class="card shadow-sm h-100">
          <div class="card-header bg-light">
            <h5 class="card-title d-flex align-items-center mb-0 py-1">
              <TrendingUp class="me-2 text-info" :size="22" />
              Top Recommandations
            </h5>
          </div>
          <div class="card-body">
            <div v-if="stats.topReferrers && stats.topReferrers.length > 0" class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th class="text-end">Recommandations</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ref in stats.topReferrers.slice(0, 5)" :key="ref.id">
                    <td>{{ ref.name }}</td>
                    <td class="text-end">{{ ref.referral_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted text-center mb-0 py-3">Aucune donnée de recommandation.</p>
          </div>
        </div>
      </div>


      <!-- Attendance Chart -->
      <div class="col-lg-8 col-md-12">
        <div class="card shadow-sm">
          <div class="card-header bg-light">
            <h5 class="card-title d-flex align-items-center mb-0 py-1">
              <BarChart2 class="me-2 text-primary" :size="22" />
              Participation par Session
            </h5>
          </div>
          <div class="card-body">
            <div style="height: 300px;"> <!-- Set a fixed height for the chart container -->
                <canvas id="attendanceChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Perfect Attendance -->
      <div class="col-lg-4 col-md-12">
        <div class="card shadow-sm h-100">
           <div class="card-header bg-light">
            <h5 class="card-title d-flex align-items-center mb-0 py-1">
              <Award class="me-2 text-warning" :size="22" />
              Participants Assidus
            </h5>
          </div>
          <div class="card-body">
            <div v-if="stats.perfectAttendance && stats.perfectAttendance.length > 0" class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th class="text-center">Présences</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in stats.perfectAttendance.slice(0, 5)" :key="p.id">
                    <td>{{ p.name }}</td>
                    <td class="text-center">{{ p.attended_sessions }}/{{ p.total_sessions }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted text-center mb-0 py-3">Aucun participant assidu pour le moment.</p>
          </div>
        </div>
      </div>


      <!-- Today's Attendance by Locality -->
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-header bg-light">
            <h5 class="card-title d-flex align-items-center mb-0 py-1">
              <MapPin class="me-2 text-danger" :size="22" />
              Présence par Quartier (Aujourd'hui)
            </h5>
          </div>
          <div class="card-body">
            <div v-if="stats.todayAttendanceByLocality && stats.todayAttendanceByLocality.length > 0" class="table-responsive">
              <table class="table table-sm table-hover table-striped mb-0">
                <thead>
                  <tr>
                    <th>Quartier</th>
                    <th class="text-end">Nombre de Présents</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in stats.todayAttendanceByLocality" :key="row.locality">
                    <td>{{ row.locality || 'Non spécifié' }}</td>
                    <td class="text-end">{{ row.present_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted text-center mb-0 py-3">Aucune présence enregistrée par quartier pour aujourd'hui.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
    max-width: 1400px; /* Or your preferred max width */
    margin-left: auto;
    margin-right: auto;
}
.card {
    border: none; /* Remove default card border for a cleaner look with shadow */
}
.card-header {
    border-bottom: 1px solid #f0f0f0; /* Lighter border for card headers */
}
.card-title {
    font-weight: 500; /* Bootstrap's default is often 500 */
    font-size: 1.1rem; /* Slightly larger card titles */
    color: #343a40; /* Darker text for titles */
}
.card-subtitle {
    font-size: 0.9rem;
}
.display-5 { /* Adjusted from display-4 for better fit in small cards */
    font-size: 2.25rem; /* Slightly smaller than Bootstrap's display-4 */
    /* color: #0d6efd; /* Primary color for main stats */
}
.table th {
    font-weight: 500;
    white-space: nowrap;
    font-size: 0.85rem;
    color: #495057;
}
.table td {
    vertical-align: middle;
    font-size: 0.875rem;
}
.table-sm th, .table-sm td {
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
}
.table-hover tbody tr:hover {
    background-color: #f8f9fa; /* Subtle hover for tables */
}

/* Chart container needs explicit height if maintainAspectRatio is false */
#attendanceChart {
    max-height: 300px; /* Ensure chart doesn't grow too tall */
}
</style>