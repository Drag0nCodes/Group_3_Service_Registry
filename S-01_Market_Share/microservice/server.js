'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var port = process.env.PORT || 1337;
const staticDir = path.join(__dirname, 'public'); // Set static directory

// Microservice ID for heartbeat
const serviceId = 'S-01';
// Array of registries
const regs = [];

// Create the server
http.createServer(function (req, res) {
    // Route the request based on the req params
    if (req.method === 'GET' && req.url === '/') { // Serve index with no stock data
        serveFile(res, path.join(staticDir, 'index.html'), ["{{apiData}}", ""]);

    } else if (req.method === 'POST' && req.url === '/getStock') { // Handle a POST request to show stock data
        getStock(req, res);

    } else if (req.method === 'POST' && req.url === '/register') { // Register a new MS
        register(req, res);

    } else if (req.method === 'POST' && req.url === '/deregister') { // Register a new MS
        deregister(req, res);

    } else if (req.url === '/settings') { // Serve settings.html if the URL is "/settings"
        let replace = ["{{selections}}", ""];
        for (let i = 0; i < regs.length; i++) {
            replace[1] = replace[1] += `<option value=\"${regs[i]}\">${regs[i]}</option>`;
        }
        serveFile(res, path.join(staticDir, 'settings.html'), replace);

    } else if (req.method === 'GET') {
        // Serve static files
        serveStaticFile(req, res);

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

// Function to serve static files (CSS, JS, images, etc.)
function serveStaticFile(req, res) {
    // Resolve the requested file path relative to the public directory
    const filePath = path.join(staticDir, req.url);

    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found\n');
            console.log(`Could not get file ${filePath}`);
        } else {
            // Detect the content type based on file extension
            const extname = path.extname(filePath);
            const mimeTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif'
            };

            const contentType = mimeTypes[extname] || 'application/octet-stream';

            // Serve the file as a stream
            res.writeHead(200, { 'Content-Type': contentType });
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
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
                    Symbol: ${metaData["2. Symbol"]} \n
                    Last Refreshed: ${metaData["3. Last Refreshed"]} \n
                    Latest Open: ${latestData["1. open"]} \n
                    Latest Close: ${latestData["4. close"]} \n
                    Latest Volume: ${latestData["5. volume"]}
                `;

                        callback(Object.assign({}, metaData, latestData)); // Pass the stringified data to the callback

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
function getStock(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        // Parse the form data
        try {
            const formData = JSON.parse(body);
            const symbol = formData["symbol"].toUpperCase(); // Retrieve the stock symbol input
            getApiData((apiData) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(apiData));
            }, symbol);
        } catch (err) {
            console.error('Error parsing JSON:', err);
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid JSON');
        }
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
        const url = new URL(regs[i]); // This will parse the URL and handle various formats (e.g., with or without ports)

        const options = {
            hostname: url.hostname,  // Extracts the hostname (e.g., 'localhost', 'registry.com')
            port: url.port || (url.protocol === 'https:' ? 443 : 80),  // Default port based on protocol
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
                console.log(`${regs[i]}: Heartbeat sent. Response: ${responseData}`);
            });
        });

        req.on('error', (error) => {
            console.error(`${regs[i]}: Error sending heartbeat. Response: ${error.message}`);
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
        try {
            const formData = JSON.parse(body);
            var url = formData["regurl"];
            if (isValidURL(url)) {
                if (!regs.includes(url)) {
                    regs.push(url);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: "Registry Successful", url: url }));
                    sendHeartbeat();
                    console.error(`Successfully registered: ${url}`);
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: "Already registered", url: null }));
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Invalid URL", url: null }));
            }
        } catch (err) {
            console.error('Error parsing JSON:', err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "Inavlid Reqiest", url: null }));
        }
    });
}

function isValidURL(str) {
    try {
        const url = new URL(str);
        return url.protocol === "http:" || url.protocol === "https:"; // Ensure http or https
    } catch (error) {
        return false;
    }
}

// Function to deregister the microservice from a registry
function deregister(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        // Parse the form data
        try {
            const formData = JSON.parse(body);
            var url = formData["deregSelect"];
            const index = regs.indexOf(url);
            if (index > -1) { // only splice array when item is found
                regs.splice(index, 1); // 2nd parameter means remove one item only
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Deregistery Successful", url: url}));

                // Should also make a request to the reigstery to deregister it

                console.error(`Successfully deregistered: ${url}`);
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Could not find registry", url: null}));
            }
        } catch (err) {
            console.error('Error parsing JSON:', err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "Invalid request/JSON", url: null}));
        }
    });
}

sendHeartbeat();
// Set an interval to send the heartbeat every 15 seconds
setInterval(() => {
    sendHeartbeat();
}, 15000); // 15 seconds


