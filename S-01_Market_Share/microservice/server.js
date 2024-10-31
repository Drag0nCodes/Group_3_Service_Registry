'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var port = process.env.PORT || 1337;

// Microservice ID for heartbeat
const serviceId = 'S-01';
// Array of registries
const regs = ["localhost:3000"];

// Create the server
http.createServer(function (req, res) {
    // Route the request based on the req params
    if (req.method === 'GET' && req.url === '/') { // Serve index with no stock data
        serveFile(res, path.join(__dirname, 'public/index.html'), ["{{apiData}}", ""]);

    } else if (req.method === 'POST' && req.url === '/') { // Handle a POST request to show stock data
        handleStockFormPost(req, res);

    } else if (req.method === 'POST' && req.url === '/register') { // Register a new MS
        register(req, res);

    } else if (req.url === '/extra') { // Serve extra.html if the URL is "/extra"
        serveFile(res, path.join(__dirname, 'public/extra.html'));

    } else { // If the route is not found, return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found\n');
    }
}).listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

// Function to serve HTML files with replacing data based on array elements
function serveFile(res, filePath, replace = []) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            // Return a 404 if the file is not found
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found\n');
        } else {
            for (let i = 0; i < data.length; i += 2) {
                data = data.replace(replace[i], replace[i + 1]);
            }

            // Return the HTML content
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        }
    });
}

// Function to fetch data from an external API
function getApiData(callback, symbol) {
    fs.readFile(path.join(__dirname, 'AV api key.txt'), (err, data) => { // Get the api key
        if (err) {
            // Return a 404 if the file is not found
            console.log("Could not get API key from txt file");
        } else {
            https.get('https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=' + symbol + '&interval=5min&apikey=' + data, (apiRes) => {
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
                        callback('Error parsing data, check symbol'); // Handle parsing errors
                    }
                });

            }).on('error', (err) => {
                console.error('Error fetching API data: ' + err.message);
                callback('Error fetching data'); // Handle fetch errors
            });
        }
    });
}

// Function to handle the POST request and parse form data for getting stock info
function handleStockFormPost(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        // Parse the form data
        const formData = new URLSearchParams(body);
        const symbol = formData.get('symbol').toUpperCase(); // Retrieve the stock symbol input

        getApiData((apiData) => {
            // Serve index.html with the API data
            serveFile(res, path.join(__dirname, 'public/index.html'), ["{{apiData}}", apiData]);
        }, symbol);
    });
}

// Function to send the heartbeat to the registry
function sendHeartbeat() {
    const data = JSON.stringify({
        serviceId: serviceId,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });

    for (let i = 0; i < regs.length; i++) {
        console.log('Sending heartbeat ' + i + '...');
        const options = { // The address and info for the registry
            hostname: regs[i].split(":")[0].trim(),
            port: Number(regs[i].split(":")[1].trim()),  // Might cause an issue when different address are used without port, for HTTPS, use 443. For HTTP, use 80.
            path: '/heartbeat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length

            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                console.log(`Heartbeat sent. Response: ${responseData}`);
            });
        });

        req.on('error', (error) => {
            console.error(`Error sending heartbeat ` + i + `: ${error.message}`);
        });

        req.write(data);
        req.end();
    }
}

// Function to register the microservice to a registry
function register(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        // Parse the form data
        const formData = new URLSearchParams(body);
        const url = formData.get('regurl'); // Retrieve the registry url input

        regs.push(url);
    });
    serveFile(res, path.join(__dirname, 'public/index.html'), ["{{apiData}}", ""]);
}

// Function to deregister the microservice from a registry
function deregister(req, res) {

}

sendHeartbeat();
// Set an interval to send the heartbeat every 15 seconds
setInterval(() => {
    sendHeartbeat();
}, 15000); // 15 seconds


