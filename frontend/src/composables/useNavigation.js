// filepath: src/composables/useNavigation.js
import { nextTick } from 'vue';

export function useNavigation(view, loggedIn, showRegistration, confirmIfUnsavedChanges, isMobileNavOpen) {
    const handleNavigation = async (newView) => {
        if (!loggedIn.value && newView !== 'login' && view.value !== 'login') {
            view.value = 'login';
            showRegistration.value = false;
            return;
        }

        const okToNavigate = await confirmIfUnsavedChanges(newView);
        if (!okToNavigate) return;

        view.value = newView;
        isMobileNavOpen.value = false;

        nextTick(() => {
            const mainContent = document.getElementById('mainContentArea');
            if (mainContent) mainContent.scrollTop = 0;
        });
    };

    return { handleNavigation };
}