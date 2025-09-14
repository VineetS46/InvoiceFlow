const { CosmosClient } = require("@azure/cosmos");

const databaseId = "InvoiceDB";
const containerId = "Invoices";

// --- THIS IS THE FIX ---
// Corrected the typo in the environment variable name from COOSMOS to COSMOS.
const connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING;
// --- END OF FIX ---

if (!connectionString) {
    throw new Error("FATAL ERROR: AZURE_COSMOS_CONNECTION_STRING is not defined in your local.settings.json file.");
}

// Create a single, memoized client instance for efficiency
let client = null;
let database = null;
let container = null;

function initializeClient() {
    if (!client) {
        try {
            client = new CosmosClient(connectionString);
            database = client.database(databaseId);
            container = database.container(containerId);
            // This log is critical for confirming the correct names are being used on startup
            console.log(`Cosmos DB client initialized for DB: '${databaseId}', Container: '${containerId}'`);
        } catch (error) {
            console.error("FATAL ERROR: Could not initialize Cosmos DB client.", error);
            // In case of error, ensure we export nulls so failures are obvious
            return { client: null, database: null, container: null };
        }
    }
    return { client, database, container };
}

module.exports = initializeClient();