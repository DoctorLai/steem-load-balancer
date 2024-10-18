const fetch = (...args) => import("node-fetch").then(module => module.default(...args));
const json2csv = require('json2csv').parse;

// Get API server from command-line arguments
const apiServer = process.argv[2];

if (!apiServer) {
    console.error("Please provide the API server as a command-line argument.");
    process.exit(1);
}

// Construct the full URL
const apiUrl = `https://${apiServer}`;

// Function to fetch data and output CSV to console
async function fetchDataAndOutputCSV() {
    try {
        // Fetch JSON data from the URL
        const response = await fetch(apiUrl);
        const data = await response.json();

        // Extracting access counters and error counters
        const accessCounters = data.__stats__.access_counters;
        const errorCounters = data.__stats__.error_counters;

        // Preparing data for CSV
        const csvData = Object.keys(accessCounters).map(url => {
            const access = accessCounters[url];
            const error = errorCounters[url] || {
                errRate: 0,
                total: access.count,
                errorCount: 0,
                succRate: 100
            };

            return {
                URL: url,
                Count: access.count,
                Percent: access.percent,
                "Error Count": error.errorCount,
                "Error Rate": error.errRate,
                Total: error.total,
                "Succ Rate": error.succRate
            };
        });

        // Convert JSON data to CSV
        const csv = json2csv(csvData);

        // Output CSV to console
        console.log(csv);

    } catch (error) {
        console.error("Error fetching data or generating CSV:", error);
    }
}

// Run the function
fetchDataAndOutputCSV();
