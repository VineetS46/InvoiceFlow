// src/helpers/api.js (Definitive, Production-Ready Version)

// This helper centralizes all API communication. It automatically adds the
// auth token and active workspace ID, and handles different request types.

const getHeaders = async (auth, isFormData = false) => {
    if (!auth.currentUser || !auth.currentWorkspace) {
        throw new Error("User is not authenticated or has no active workspace.");
    }

    const token = await auth.currentUser.getIdToken();
    const headers = {
        'Authorization': `Bearer ${token}`,
        'x-workspace-id': auth.currentWorkspace.id,
    };

    // For file uploads, the browser must set the Content-Type header itself.
    // For JSON, we must set it explicitly.
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
};

// A centralized function to handle responses and errors
const handleResponse = async (response) => {
    if (!response.ok) {
        // Try to parse a JSON error message from the backend, otherwise use the status text
        try {
            const errorData = await response.json();
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        } catch (e) {
            throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
        }
    }
    return response.json();
};


const api = {
    get: async (endpoint, auth) => {
        const headers = await getHeaders(auth);
        const response = await fetch(`http://localhost:7071/api/${endpoint}`, {
            method: 'GET',
            headers: headers
        });
        return handleResponse(response);
    },

    post: async (endpoint, body, auth) => {
        const headers = await getHeaders(auth, false); // false because this is a JSON post
        const response = await fetch(`http://localhost:7071/api/${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        return handleResponse(response);
    },
    
    // --- NEW: A dedicated function for file uploads ---
    postForm: async (endpoint, formData, auth) => {
        // We pass true to getHeaders to signal that this is a FormData request
        const headers = await getHeaders(auth, true); 
        const response = await fetch(`http://localhost:7071/api/${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: formData // FormData is sent directly, not stringified
        });
        return handleResponse(response);
    }
    // ---
};

export default api;