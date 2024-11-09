'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var port = process.env.PORT || 3000;
const timeout = 35;
const staticDir = path.join(__dirname, 'public'); // Set static directory

// Registered microservices
const msArr = [];

// Create the server
http.createServer(function (req, res) {
    // Route the request based on the URL
    if (req.method === 'GET' && req.url === '/') { // Serve the index.html page
        serveFile(res, path.join(staticDir, 'index.html'));

    } else if (req.method === 'GET' && req.url === '/getMicroservices') { // Serve the microservices in json format so js can auto update
        returnMicroservices(req, res);

    } else if (req.method === 'POST' && req.url === '/') { // Handle a post request to 
        handleFormPost(req, res);

    } else if (req.method === 'POST' && req.url === '/heartbeat') { // Handle heartbeat from ms
        processHeartbeat(req, res);

    } else if (req.method === 'POST' && req.url === '/register') { // Handle registery request from ms
        registerMS(req, res);

    } else if (req.method === 'POST' && req.url === '/deregister') { // Handle deregister request from ms
        deregisterMS(req, res);

    } else if (req.method === 'GET') { // Handle other get request
        // Serve static files
        serveStaticFile(req, res);

    } else {
        // If the route is not found, return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found\n');
    }
}).listen(port, () => {
    console.log(`Registry server running at http://localhost:${port}/`);
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

// Function to handle the POST request and parse form data
function handleFormPost(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        // Parse the form data
        const formData = new URLSearchParams(body);
        msArr[msArr.length] = formData.get('msurl');

        let replace = ["{{microservices}}", ""];
        for (let i = 0; i < msArr.length; i++) {
            replace[1] = replace[1] += "\n" + msArr[i];
        }

        serveFile(res, path.join(__dirname, 'public/index.html'), replace);
    });
}

// Function to process an incoming heartbeaat
function processHeartbeat(req, res) {
    let body = '';

    if (req.headers['content-type'] === 'application/json') {

        req.on('data', chunk => {
            body += chunk;
        });

        req.on('end', () => {
            // Parse the form data
            const { serviceId, status, timestamp } = JSON.parse(body);

            let exists = false;

            for (let i = 0; i < msArr.length; i++) { // Check all microservices saved to find which one sent the heartbeat
                if (msArr[i]["name"] === serviceId) { // if match, update its timeout and status
                    msArr[i]["timeout"] = timeout;
                    msArr[i]["status"] = "Available";

                    console.log(timestamp + " - Heartbeat recieved from " + serviceId + ": " + status);

                    res.writeHead(200, { 'Content-Type': 'text/plain' }); // Respond acknowledging heartbeat
                    res.end("Received")
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                console.log(timestamp + " - Heartbeat recieved from " + serviceId + ". This microservice does not exist in database");

                res.writeHead(400, { 'Content-Type': 'text/plain' }); // Respond that microservice is not registered
                res.end("Reregister")
            }
        });
    } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
    }
}

// Function to handle registering a microservice to the registry
function registerMS(req, res) {
    let body = '';

    if (req.headers['content-type'] === 'application/json') {

        req.on('data', chunk => {
            body += chunk;
        });

        req.on('end', () => {
            // Parse the form data
            const { serviceId, myUrl } = JSON.parse(body);

            let exists = false;
            for (let i = 0; i < msArr.length; i++) {
                if (msArr[i]["addr"] === myUrl) { // Url already registered, don't add again to array but still acknowledge
                    console.log("Reregister request recieved from " + serviceId + " at " + myUrl);
                    exists = true;
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Already registered');
                    break;
                }
            }

            if (!exists) { // New register request, ack and add to arr
                console.log("Register request recieved from " + serviceId + " at " + myUrl);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end("Success")

                msArr.push({ name: serviceId, status: 'Available', addr: myUrl, timeout: timeout })
            }
        });
    } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
    }
}

// Function to handle deregistering a microservice to the registry
function deregisterMS(req, res) {
    let body = '';

    if (req.headers['content-type'] === 'application/json') {

        req.on('data', chunk => {
            body += chunk;
        });

        req.on('end', () => {
            // Parse the form data
            const { serviceId, myUrl } = JSON.parse(body);
            console.log("Deregister request recieved from " + serviceId + " at " + myUrl);

            let exists = false;
            for (let i = 0; i < msArr.length; i++) {
                if (msArr[i]["addr"] === myUrl) { // Found ms in array, remove and ack
                    exists = true;
                    msArr.splice(i, 1); // Remove microservice from array
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Success');
                    break;
                }
            }

            if (!exists) { // Ms not in array, still ack so ms can remove from own list
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Success');
            }
        });
    } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
    }
}

function runTimeout() {
    for (let i = 0; i < msArr.length; i++) {
        if (msArr[i]["timeout"] <= 0) continue; // If already timed out, skip
        if (--msArr[i]["timeout"] <= 0) { // Decrease microservice's timeout val and if <= 0, set to unavailable
            msArr[i]["status"] = "Unavailable";
            console.log(`${msArr[i]["name"]} is no longer available due to heartbeat timeout`)
        }
    }
}

// Function to return just the microservices at json to autoupdate page
function returnMicroservices(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(msArr));
}

setInterval(() => { // Check heartbeat timeouts every second
    runTimeout();
}, 1000); // 1 second