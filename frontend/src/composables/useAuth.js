// filepath: src/composables/useAuth.js
import { ref } from 'vue';
import { useRouter } from 'vue-router';

export function useAuth(API_BASE_URL, saving, error, loggedIn, fetchInitialData, showRegistration) {
    const router = useRouter();

    const handleLogin = async (credentials) => {
        saving.value = true;
        error.value = null;
        try {
            const responseData = await apiCall('/auth/login', 'POST', credentials);

            if (responseData && responseData.token) {
                localStorage.setItem('authToken', responseData.token);
                loggedIn.value = true;
                await fetchInitialData();
            } else {
                throw new Error("Login failed: No token received from server.");
            }
        } catch (err) {
            loggedIn.value = false;
        } finally {
            saving.value = false;
        }
    };

    const displayRegistrationForm = () => {
        showRegistration.value = true;
    };

    const processRegistration = async (userData) => {
        saving.value = true;
        error.value = null;
        try {
            const responseData = await apiCall('/auth/register', 'POST', userData);

            if (responseData && responseData.token) {
                localStorage.setItem('authToken', responseData.token);
                loggedIn.value = true;
                showRegistration.value = false;
                await fetchInitialData();
            } else {
                throw new Error("Registration failed: No token received from server.");
            }
        } catch (err) {
        } finally {
            saving.value = false;
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('authToken');
        loggedIn.value = false;
        router.push('/login'); // Use Vue Router for navigation
    };

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

    return { handleLogin, displayRegistrationForm, processRegistration, handleLogout };
}