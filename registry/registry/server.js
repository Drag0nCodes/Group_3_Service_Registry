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
        let replace = ["{{microservices}}", ""];
        for (let i = 0; i < msArr.length; i++) {
            replace[1] = replace[1] += 
            "<div class=\"row\"> \
                <div class=\"col-12 col-sm-6 col-lg-8\"> \
                    <a target=\"_blank\" href=\"" + msArr[i]["addr"] + "\">" + msArr[i]["name"] + "</a> \
                </div >\
                <div class=\"col-6 col-lg-4\">" + msArr[i]["status"] + "</div > \
            </div > ";
        }

        serveFile(res, path.join(staticDir, 'index.html'), replace);

    } else if (req.method === 'POST' && req.url === '/') { // Handle a post request to 
        handleFormPost(req, res);

    } else if (req.method === 'POST' && req.url === '/heartbeat') {
        processHeartbeat(req, res);

    } else if (req.method === 'POST' && req.url === '/register') {
        registerMS(req, res);

    } else if (req.method === 'POST' && req.url === '/deregister') {
        deregisterMS(req, res);

    } else if (req.method === 'GET') {
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

            for (let i = 0; i < msArr.length; i++) {
                if (msArr[i]["name"] === serviceId) {
                    msArr[i]["timeout"] = timeout;
                    msArr[i]["status"] = "Available";


                    console.log(timestamp + " - Heartbeat recieved from " + serviceId + ": " + status);

                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end("Received")
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                console.log(timestamp + " - Heartbeat recieved from " + serviceId + ". This microservice does not exist in database");

                res.writeHead(400, { 'Content-Type': 'text/plain' });
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
                if (msArr[i]["addr"] === myUrl) {
                    console.log("Reregister request recieved from " + serviceId + " at " + myUrl);
                    exists = true;
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Already registered');
                    break;
                }
            }

            if (!exists) {
                console.log("Register request recieved from " + serviceId + " at " + myUrl);
                res.writeHead(400, { 'Content-Type': 'text/plain' });
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
                if (msArr[i]["addr"] === myUrl) {
                    exists = true;
                    msArr.splice(i, 1); // Remove microservice from array
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Success');
                    break;
                }
            }

            if (!exists) {
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

setInterval(() => {
    runTimeout();
}, 1000); // 1 second