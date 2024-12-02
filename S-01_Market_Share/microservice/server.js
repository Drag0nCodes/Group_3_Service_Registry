'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var port = process.env.PORT || 80;
const staticDir = path.join(__dirname, 'public'); // Set static directory
const os = require('os');
require('dotenv').config();
const { sendHeartbeat, register, deregister, getMyIP, getRegs } = require('./registryConnect');

// Microservice ID for heartbeat
const serviceId = 'S-01: Market Share Calculator';

// Create the server
http.createServer(function (req, res) {
    // Route the request based on the req params
    if (req.method === 'GET' && req.url === '/') { // Serve index with no stock data
        serveFile(res, path.join(staticDir, 'index.html'), ["{{apiData}}", ""]);

    } else if (req.method === 'POST' && req.url === '/getStock') { // Handle a POST request to show stock data
        getStock(req, res);

    } else if (req.method === 'POST' && req.url === '/register') { // Register MS to registry
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            // Parse the form data
            try {
                const { regurl } = JSON.parse(body); // Get the register url
                register(serviceId, regurl, res);
            } catch (err) { // Could not parse json from js
                console.error('Error parsing JSON:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Inavlid Request", url: null }));
            }
        });

    } else if (req.method === 'POST' && req.url === '/deregister') { // Deregister MS from registry
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            // Parse the form data
            try {
                const { deregSelect } = JSON.parse(body);// Get the registry url to deregister from
                deregister(serviceId, deregSelect, res);
            } catch (err) { // Invalid json
                console.error('Error parsing JSON:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Invalid request/JSON", url: null }));
            }
        });

    } else if (req.url === '/settings') { // Serve settings.html if the URL is "/settings"
        let replace = ["{{selections}}", ""];
        let regs = getRegs();
        for (let i = 0; i < regs.length; i++) { // Add the reg urls to the select form
            replace[1] = replace[1] += `<option value=\"${regs[i]}\">${regs[i]}</option>`;
        }
        serveFile(res, path.join(staticDir, 'settings.html'), replace);

    } else if (req.method === 'GET') { // Serve other GET requests
        // Serve static files
        serveStaticFile(req, res);

    } else { // If the route is not found, return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found\n');
    }
}).listen(port, () => {
    console.log(`Server running at ${getMyIP()}`);
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
                if (apiData != "Error") {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(apiData));
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end("Error");
                }
            }, symbol);
        } catch (err) {
            console.error('Error parsing JSON:', err);
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid JSON');
        }
    });
}

// Function to fetch data from an external API
function getApiData(callback, symbol) {
    fs.readFile(path.join(__dirname, 'key.txt'), (err, data) => { // Get the api key
        if (err) {
            // Return a 404 if the file is not found
            console.log("Could not get API key from txt file");
        } else {
            https.get('https://www.alphavantage.co/query?function=OVERVIEW&symbol=' + symbol + '&apikey=' + data, (apiRes) => {
                let data = '';

                // Collect data from the API
                apiRes.on('data', chunk => data += chunk);

                // When all the data is received
                apiRes.on('end', () => {
                    try {
                        // Parse the JSON data
                        let jsonData = JSON.parse(data);

                        if (jsonData["Information"]) {
                            callback("API limit reached")
                        } else if (jsonData["Country"] != "USA") {
                            callback("Enter valid stock traded in the US");
                        } else {
                            let result = {
                                name: jsonData["Name"],
                                sect: jsonData["Sector"].split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
                                cap: `$${parseInt(jsonData["MarketCapitalization"]).toLocaleString()}`,
                                price: `$${(jsonData["MarketCapitalization"] / jsonData["SharesOutstanding"]).toLocaleString()}`,
                                pcnt: `${(jsonData["MarketCapitalization"] / 55200000000000 * 100).toFixed(3)}%`
                            };

                            callback(result); // Pass the stringified data to the callback
                        }
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

// Set an interval to send the heartbeat every 15 seconds
setInterval(() => {
    sendHeartbeat(serviceId);
}, 15000); // 15 seconds


