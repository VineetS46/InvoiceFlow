// src/helpers/adminApi.js (NEW FILE for the Admin Panel ONLY)

import { getAuth } from 'firebase/auth';

// This helper is for platform-level admin calls.
// It ONLY adds the auth token and does NOT require a workspace.

const getAdminHeaders = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        throw new Error("Admin user is not authenticated.");
    }

    const token = await user.getIdToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

const handleResponse = async (response) => {
    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        } catch (e) {
            throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
        }
    }
    return response.json();
};

const adminApi = {
    get: async (endpoint) => {
        const headers = await getAdminHeaders();
        const response = await fetch(`http://localhost:7071/api/${endpoint}`, {
            method: 'GET',
            headers: headers,
        });
        return handleResponse(response);
    },

    post: async (endpoint, body) => {
        const headers = await getAdminHeaders();
        const response = await fetch(`http://localhost:7071/api/${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });
        return handleResponse(response);
    },
};

export default adminApi;