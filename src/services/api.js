// src/services/api.js (This is the complete and correct code for this file)
import axios from 'axios';
import { auth } from '../firebaseConfig'; // Make sure this path is correct for your project

const API_BASE_URL = 'http://localhost:7071/api';

const getAuthHeader = async () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User is not authenticated.");
    }
    const token = await user.getIdToken();
    return {
        'Authorization': `Bearer ${token}`
    };
};

/**
 * Fetches all invoices from the backend for an admin.
 * @returns {Promise<Array>} A promise that resolves to an array of invoice objects.
 */
export const getAllInvoices = async () => {
    const headers = await getAuthHeader();
    const response = await axios.get(`${API_BASE_URL}/getAllInvoices`, { headers });
    return response.data;
};