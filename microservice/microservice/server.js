'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var port = process.env.PORT || 1337;

// Microservice ID for heartbeat
const serviceId = 'microservice';

// Function to serve regular HTML files
function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // Return a 404 if the file is not found
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found\n');
        } else {
            // Return the HTML content
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        }
    });
}

function serveIndexWithAPIData(res, apiData) {
    let filePath = path.join(__dirname, 'public/index.html');

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error: Could not find or open file for reading\n');
        } else {
            // Insert the API data into the HTML by replacing 
            let modifiedHtml = data.replace('{{apiData}}', apiData);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(modifiedHtml); // Serve the modified HTML with API data
        }
    });
}

// Function to fetch data from an external API
function getApiData(callback) {
    fs.readFile(path.join(__dirname, 'AV api key.txt'), (err, data) => { // Get the api key
        if (err) {
            // Return a 404 if the file is not found
            console.log("Could not get API key from txt file");
        } else {
            https.get('https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=' + data, (apiRes) => {
                let data = '';

                // Collect data from the API
                apiRes.on('data', (chunk) => {
                    data += chunk;
                });

                // When all the data is received
                apiRes.on('end', () => {
                    try {
                        // Parse the JSON data
                        let jsonData = JSON.parse(data);

                        // Extract specific fields, e.g., "Meta Data" and "Time Series (5min)"
                        let metaData = jsonData["Meta Data"];
                        let timeSeries = jsonData["Time Series (5min)"];

                        // You can extract specific information, for example, the latest time series data
                        let latestTime = Object.keys(timeSeries)[0]; // Get the latest time key
                        let latestData = timeSeries[latestTime]; // Get the data for the latest time

                        // Create a string to show relevant information in the HTML
                        let apiDataString = `
                    Symbol: ${metaData["2. Symbol"]} <br>
                    Last Refreshed: ${metaData["3. Last Refreshed"]} <br>
                    Latest Open: ${latestData["1. open"]} <br>
                    Latest Close: ${latestData["4. close"]} <br>
                    Latest Volume: ${latestData["5. volume"]}
                `;

                        callback(apiDataString); // Pass the stringified data to the callback

                    } catch (error) {
                        console.error('Error parsing JSON: ' + error.message);
                        callback('Error parsing data'); // Handle parsing errors
                    }
                });

            }).on('error', (err) => {
                console.error('Error fetching API data: ' + err.message);
                callback('Error fetching data'); // Handle fetch errors
            });
        }
    });
}

// Create the server
http.createServer(function (req, res) {
    // Route the request based on the URL
    if (req.url === '/') {
        // Fetch API data before serving index.html
        getApiData((apiData) => {
            // Serve index.html with the API data
            serveIndexWithAPIData(res, apiData);
        });
    } else if (req.url === '/extra') {
        // Serve about.html if the URL is "/about"
        serveFile(res, path.join(__dirname, 'public/extra.html'));
    } else {
        // If the route is not found, return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found\n');
    }
}).listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

// Function to send the heartbeat to the registry
function sendHeartbeat() {
    const data = JSON.stringify({
        serviceId: serviceId,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });

    const options = { // The address and info for the registry
        hostname: 'localhost:3000',
        port: 80, // For HTTPS, use 443. For HTTP, use 80.
        path: '/heartbeat',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
            responseData += chunk;
        });

        res.on('end', () => {
            console.log(`Heartbeat sent. Response: ${responseData}`);
        });
    });

    req.on('error', (error) => {
        console.error(`Error sending heartbeat: ${error.message}`);
    });

    req.write(data);
    req.end();
}

// Set an interval to send the heartbeat every 15 seconds
setInterval(() => {
    console.log('Sending heartbeat...');
    sendHeartbeat();
}, 15000); // 15 seconds


