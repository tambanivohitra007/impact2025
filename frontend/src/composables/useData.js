// filepath: src/composables/useData.js
import { ref } from 'vue';

export function useData(API_BASE_URL, participants, sessions, loading, error, loggedIn, view, showRegistration) {
    async function apiCall(url, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const token = localStorage.getItem('authToken');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        } else {
            console.warn(`No auth token found for API call to ${url}`);
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        if (method !== 'GET') saving.value = true;
        error.value = null;

        try {
            const response = await fetch(`${API_BASE_URL}${url}`, options);
            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data?.error || `API Error: ${response.status} ${response.statusText}`;
                const errorDetails = data?.details || '';
                console.error(`API call failed to ${url}:`, errorMessage, errorDetails);
                throw new Error(data?.error || `${response.status} ${response.statusText}`);
            }
            return data;
        } catch (err) {
            console.error(`Error in apiCall to ${url}:`, err);
            error.value = err.message || 'An unexpected error occurred.';
            throw err;
        } finally {
            if (method !== 'GET') saving.value = false;
        }
    }
    const fetchParticipants = async () => {
        loading.participants = true; error.value = null;
        try { participants.value = await apiCall('/participants'); }
        catch (err) { /* Handled by apiCall */ }
        finally { loading.participants = false; }
    };

    const fetchSessions = async () => {
        loading.sessions = true; error.value = null;
        try { sessions.value = await apiCall('/sessions'); }
        catch (err) { /* Handled by apiCall */ }
        finally { loading.sessions = false; }
    };

    const fetchInitialData = async () => {
        loading.app = true; error.value = null;
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                loggedIn.value = true;
                view.value = 'dashboard';
                await Promise.all([fetchParticipants(), fetchSessions()]);
            } else {
                loggedIn.value = false;
                view.value = 'login';
                showRegistration.value = false;
            }
        } catch (err) {
            console.error("Error fetching initial data or invalid token:", err);
            loggedIn.value = false;
            localStorage.removeItem('authToken');
            view.value = 'login';
            showRegistration.value = false;
        }
        finally { loading.app = false; }
    };

    return { fetchParticipants, fetchSessions, fetchInitialData };
}