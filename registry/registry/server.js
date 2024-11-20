'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
const mysql = require('mysql2');
var port = process.env.PORT || 80;
const timeout = 35;
const staticDir = path.join(__dirname, 'public'); // Set static directory

// MySQL database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'my_app_user',
    password: 'password',
    database: 'service_registry'
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        return;
    }
    console.log('Connected to MySQL as id ' + db.threadId);
});

// Load microservices from the database on server start
function loadMicroservices() {
    db.query('SELECT * FROM registries', (err, results) => {
        if (err) {
            console.error('Error loading microservices:', err);
        } else {
            console.log('Loaded microservices from database:', results);
        }
    });
}

// Serve static files (CSS, JS, images, etc.)
function serveStaticFile(req, res) {
    const filePath = path.join(staticDir, req.url);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File not found: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found\n');
        } else {
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
            res.writeHead(200, { 'Content-Type': contentType });
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
        }
    });
}

// Start server and load initial data
http.createServer(function (req, res) {
    // console.log(`Received request: ${req.method} ${req.url}`);
    
    if (req.method === 'GET' && req.url === '/') {
        serveFile(res, path.join(staticDir, 'index.html'));
    } else if (req.method === 'GET' && req.url === '/getMicroservices') {
        returnMicroservices(req, res);
    } else if (req.method === 'POST' && req.url === '/') {
        handleFormPost(req, res);
    } else if (req.method === 'POST' && req.url === '/heartbeat') {
        processHeartbeat(req, res);
    } else if (req.method === 'POST' && req.url === '/register') {
        registerMS(req, res);
    } else if (req.method === 'POST' && req.url === '/deregister') {
        deregisterMS(req, res);
    } else if (req.method === 'GET') {
        serveStaticFile(req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found\n');
    }
}).listen(port, () => {
    console.log(`Registry server running at http://localhost:${port}/`);
    loadMicroservices(); // Load data from MySQL on server start
});

// Serve HTML files with replaceable data
function serveFile(res, filePath, replace = []) {
    // console.log(`Serving file: ${filePath}`);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found\n');
        } else {
            for (let i = 0; i < data.length; i += 2) {
                data = data.replace(replace[i], replace[i + 1]);
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        }
    });
}

// Register a new microservice
function registerMS(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const { serviceId, myUrl } = JSON.parse(body);
        
        console.log(`Registering new service: serviceId = ${serviceId}, url = ${myUrl}`);
        
        db.query('INSERT INTO registries (service_id, url, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status="healthy", timestamp=CURRENT_TIMESTAMP', 
            [serviceId, myUrl, 'healthy'], (err) => {
                if (err) {
                    console.error('Error inserting microservice:', err);
                    res.writeHead(409, { 'Content-Type': 'text/plain' });
                } else {
                    console.log(`Service registered: serviceId = ${serviceId}`);
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                }
                res.end('Success');
            });
    });
}

// Deregister a microservice
function deregisterMS(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const { serviceId, myUrl } = JSON.parse(body);
        console.log(`Deregistering service: serviceId = ${serviceId}`);
        
        db.query('DELETE FROM registries WHERE service_id = ?', [serviceId], (err) => {
            if (err) {
                console.error('Error deleting microservice:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
            } else {
                console.log(`Service deregistered: serviceId = ${serviceId}`);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
            }
            res.end('Success');
        });
    });
}

// Process heartbeat and update database timestamp
function processHeartbeat(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const { serviceId, status, timestamp, myUrl } = JSON.parse(body);
        
        console.log(`Received heartbeat from serviceId: ${serviceId}`);
        
        db.query('UPDATE registries SET timestamp = CURRENT_TIMESTAMP, status = ? WHERE service_id = ?', 
            ['healthy', serviceId], (err) => {
                if (err) console.error('Error updating microservice:', err);
                else console.log(`Heartbeat processed for serviceId: ${serviceId}`);
                
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end("Received");
            });
    });
}

// Return microservices in JSON format
function returnMicroservices(req, res) {
    //console.log('Fetching all microservices from database');
    db.query('SELECT * FROM registries', (err, results) => {
        if (err) console.error('Error fetching microservices:', err);
        //else console.log('Microservices retrieved:', results);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
    });
}

// Timeout function to mark services as unavailable if they miss heartbeat
function runTimeout() {
    //console.log('Running timeout check for microservices');
    db.query('UPDATE registries SET status = "unhealthy" WHERE timestamp <= NOW() - INTERVAL ? SECOND', 
        [timeout], (err) => {
        if (err) console.error('Error updating status:', err);
        //else console.log('Timeout check completed');
    });
}

setInterval(runTimeout, 1000); // Check timeouts every second
