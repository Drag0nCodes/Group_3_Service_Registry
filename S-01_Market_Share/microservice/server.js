'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var port = process.env.PORT || 80;
const staticDir = path.join(__dirname, 'public'); // Set static directory
const os = require('os');
let cachedIP = null

// Microservice ID for heartbeat
const serviceId = 'S-01: Market Share Calculator';
// Array of registries
let regs = [];

fs.readFile('regs.json', 'utf8', (err, data) => { // Load the regs.json file into regs array
    if (err) {
        console.error('Error reading regs array:', err);
        return;
    }
    regs = JSON.parse(data);
});

// Create the server
http.createServer(function (req, res) {
    // Route the request based on the req params
    if (req.method === 'GET' && req.url === '/') { // Serve index with no stock data
        serveFile(res, path.join(staticDir, 'index.html'), ["{{apiData}}", ""]);

    } else if (req.method === 'POST' && req.url === '/getStock') { // Handle a POST request to show stock data
        getStock(req, res);

    } else if (req.method === 'POST' && req.url === '/register') { // Register MS to registry
        getAWSIP((ip) => {
            register(req, res, ip);
        });

    } else if (req.method === 'POST' && req.url === '/deregister') { // Deregister MS from registry
        getAWSIP((ip) => {
            deregister(req, res);
        });

    } else if (req.url === '/settings') { // Serve settings.html if the URL is "/settings"
        let replace = ["{{selections}}", ""];
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
    console.log(`Server running on port ${port}`);
    getAWSIP((ip) => {
        console.log(`Cached ip: ${ip}`);
    });
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

                        if (jsonData["Error Message"]) {
                            callback("Error");
                        } else {
                            // Extract specific fields
                            let metaData = jsonData["Meta Data"];
                            let timeSeries = jsonData["Time Series (5min)"];

                            let latestTime = Object.keys(timeSeries)[0]; // Get the latest time key
                            let latestData = timeSeries[latestTime]; // Get the data for the latest time

                            callback(Object.assign({}, metaData, latestData)); // Pass the stringified data to the callback
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

// Function to send the heartbeat to the registry
function sendHeartbeat(ip) {
    const data = JSON.stringify({ // Info about the registry
        serviceId: serviceId,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        myUrl: ip
    });

    for (let i = 0; i < regs.length; i++) {
        const url = new URL(regs[i]); // Parse url

        const options = {
            hostname: url.hostname,  // Extracts the hostname
            port: url.port || (url.protocol === 'https:' ? 443 : 80),  // Default port based on protocol
            path: '/heartbeat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => { // Handle response from registry
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                console.log(`${regs[i]}: Heartbeat sent. Response: ${responseData}`);

                if (responseData === "Reregister") { // SOMEHOW REREGISTER? Nah...

                }
            });
        });

        req.on('error', (error) => {
            console.error(`${regs[i]}: Error sending heartbeat. Response: ${error.message}`);
        });

        req.write(data);
        req.end(); // Send request?
    }
}

// Function to register the microservice to a registry
function register(req, res, ip) {
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
                if (!regs.includes(url)) { // Valid URL and does not already exist is regs array, send request to add registry
                    const data = JSON.stringify({ // MS info to send to registry 
                        serviceId: serviceId,
                        myUrl: ip
                    });
                    const regurl = new URL(url); // Parse url

                    const options = { // Options for request
                        hostname: regurl.hostname,  // Extracts the hostname
                        port: regurl.port || (regurl.protocol === 'https:' ? 443 : 80),  // Default port based on protocol
                        path: '/register',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': data.length
                        }
                    };

                    const regreq = http.request(options, (regres) => {  // Handle response from registry
                        let responseData = '';

                        regres.on('data', (chunk) => {
                            responseData += chunk;
                        });

                        regres.on('end', () => {
                            if (responseData === "Success") { // Registered successfully
                                console.log(`Registered. Response: ${responseData}`);
                                regs.push(url);
                                writeRegs();
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: "Success", url: url }));
                                console.error(`Successfully registered: ${url}`);
                            }
                            else if (responseData === "Already registered") { // Already registered, successfully reregistered. Mostly does the same with a different console message
                                console.log(`Reregistered. Response: ${responseData}`);
                                regs.push(url);
                                writeRegs();
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: "Success", url: url }));
                                console.error(`Successfully reregistered: ${url}`);
                            } else { // Could not register in registry from some reason
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: "Error: " + responseData, url: null }));
                                console.error(`Error registering: ${responseData}`);
                            }
                        });
                    });

                    regreq.on('error', (error) => { // Url to registry does not work
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: "Could not contact", url: null }));
                        console.error(`Error registering. Response: ${error.message}`);
                    });

                    regreq.write(data);
                    regreq.end();

                } else { // microseervice already registered in registry
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: "Already registered", url: null }));
                }
            } else { // registry url not valid url
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Invalid URL", url: null }));
            }
        } catch (err) { // Could not parse json from js
            console.error('Error parsing JSON:', err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "Inavlid Request", url: null }));
        }
    });
}

function isValidURL(str) { // Check if a string is a url
    try {
        const url = new URL(str);
        return url.protocol === "http:" || url.protocol === "https:"; // Ensure http or https
    } catch (error) {
        return false;
    }
}

// Function to deregister the microservice from a registry
function deregister(req, res, ip) {
    let body = '';

    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        // Parse the form data
        try {
            const formData = JSON.parse(body);
            var url = formData["deregSelect"]; // Get the registry url to deregister from
            const index = regs.indexOf(url);
            if (index > -1) { // only splice array if url is found
                const data = JSON.stringify({ // Data in request to registry
                    serviceId: serviceId,
                    myUrl: ip
                });
                const regurl = new URL(url); // parse url

                const options = { // Options for req
                    hostname: regurl.hostname,  // Extracts hostname
                    port: regurl.port || (regurl.protocol === 'https:' ? 443 : 80),  // Default port based on protocol
                    path: '/deregister',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': data.length
                    }
                };

                const regreq = http.request(options, (regres) => { // Handle registry respose
                    let responseData = '';

                    regres.on('data', (chunk) => {
                        responseData += chunk;
                    });

                    regres.on('end', () => {
                        regs.splice(index, 1); // Always remove registry from array, could maybe be in success, I think not though
                        writeRegs();
                        if (responseData === "Success") {
                            console.log(`Deregistered. Response: ${responseData}`);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: "Success", url: url }));
                            console.error(`Successfully deregistered: ${url}`);
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: responseData, url: null }));
                            console.error(`Error deregistering: ${responseData}`);
                        }
                    });
                });

                regreq.on('error', (error) => { // No response from registry
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: "Could not contact", url: null }));
                    console.error(`Error registering. Response: ${error.message}`);
                });

                regreq.write(data);
                regreq.end();
            } else { // Url not in internal database (regs array)
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Not in database", url: null }));
            }
        } catch (err) { // Invalid json
            console.error('Error parsing JSON:', err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "Invalid request/JSON", url: null }));
        }
    });
}

// Get the local network IP address of this server
function getServerUrl(port) {
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = 'localhost'; // default to localhost if no external IP is found

    // Loop through network interfaces and find a non-internal IPv4 address
    for (const interfaceName of Object.keys(networkInterfaces)) {
        for (const network of networkInterfaces[interfaceName]) {
            if (network.family === 'IPv4' && !network.internal) {
                ipAddress = network.address;
                break;
            }
        }
    }

    return `http://${ipAddress}:${port}`;
}

// Method to get the public ip of the ec2 instance when running on aws
function getAWSIP(callback) {
    if (cachedIP) {
        callback(cachedIP);
        return;
    }

    const options = {
        hostname: '169.254.169.254',
        path: '/latest/meta-data/public-ipv4',
        method: 'GET',
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            cachedIP = data;
            callback(data);
        });
    });
    req.on('error', (err) => {
        cachedIP = getServerUrl(port);
        callback(cachedIP);
        return
    });
    req.setTimeout(1000, () => {
        cachedIP = getServerUrl(port);
        callback(cachedIP);
        return
    });
    req.end();
}

// Save the regs array to a json file
function writeRegs() {
    fs.writeFile('regs.json', JSON.stringify(regs, null, 2), (err) => {
        if (err) {
            console.error('Error writing file:', err);
        }
    });
}

// Set an interval to send the heartbeat every 15 seconds
setInterval(() => {
    getAWSIP((ip) => {
        sendHeartbeat(ip);
    });
}, 15000); // 15 seconds


