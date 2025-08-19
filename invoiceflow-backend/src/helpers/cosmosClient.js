// src/helpers/cosmosClient.js (DEFINITIVE FINAL VERSION)
const { CosmosClient } = require("@azure/cosmos");

// --- These names MUST EXACTLY match your Azure Portal configuration ---
// This now correctly points to your DATABASE, not your ACCOUNT.
const databaseId = "InvoiceDB"; // <-- THIS WAS THE ERROR
const containerId = "Invoices";
// ---------------------------------------------------------------------

const connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING;

if (!connectionString) {
    throw new Error("AZURE_COSMOS_CONNECTION_STRING is not defined in your settings.");
}

// Create a single, memoized client instance for efficiency
let client = null;
let database = null;
let container = null;

function initializeClient() {
    if (!client) {
        client = new CosmosClient(connectionString);
        database = client.database(databaseId);
        container = database.container(containerId);
        // This log is critical for confirming the correct names are being used on startup
        console.log(`Cosmos DB client initialized for DB: '${databaseId}', Container: '${containerId}'`);
    }
    return { client, database, container };
}

module.exports = initializeClient();