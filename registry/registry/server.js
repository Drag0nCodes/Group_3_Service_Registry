'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var port = process.env.PORT || 3000;

// Registered microservices
const msArr = ["S-01"];

// Create the server
http.createServer(function (req, res) {
    // Route the request based on the URL
    if (req.method === 'GET' && req.url === '/') { // Serve the index.html page
        let replace = ["{{microservices}}", ""];
        for (let i = 0; i < msArr.length; i++) {
            replace[1] = replace[1] += msArr[i] + "\n";
        }

        serveFile(res, path.join(__dirname, 'public/index.html'), replace);

    } else if (req.method === 'GET' && req.url === '/extra') { // Serve extra.html if the URL is "/extra"
        serveFile(res, path.join(__dirname, 'public/extra.html'));

    } else if (req.method === 'POST' && req.url === '/') { // Handle a post request to 
        handleFormPost(req, res);

    } else if (req.method === 'POST' && req.url === '/heartbeat') {
        processHeartbeat(req, res);

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

            console.log(timestamp + " - Heartbeat recieved from " + serviceId + ": " + status);

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end("Heartbeat received")
        });
    } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
    }
}

// Function to handle registering a microservice to the registry
function registerMS() {

}

// Function to handle deregistering a microservice to the registry
function deregisterMS() {

}