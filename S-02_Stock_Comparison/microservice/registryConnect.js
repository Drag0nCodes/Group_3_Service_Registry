'use strict';
var http = require('http');
var fs = require('fs');
var port = process.env.PORT || 80;


let myip = process.env.IP
if (!myip) {
    throw new Error("No ip argument provided")
} else {
    try {
        if (port == 80) {
            myip = new URL(`http://${myip}`).href;
        } else {
            myip = new URL(`http://${myip}:${port}`).href;
        }
    } catch (error) {
        throw new Error("Provided ip argument invalid")
    }
}

// Array of registries
let regs = [];

fs.readFile('regs.json', 'utf8', (err, data) => { // Load the regs.json file into regs array
    if (err) {
        console.error('Error reading regs array:', err);
        return;
    }
    regs = JSON.parse(data);
});

// Function to send the heartbeat to the registry
function sendHeartbeat(serviceId) {
    const data = JSON.stringify({ // Info about the registry
        serviceId: serviceId,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        myUrl: myip
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

                if (responseData === "Id not found") { // Reregister if registry says not registered
                    register(serviceId, url);
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
function register(serviceId, url, res = null) {

    if (isValidURL(url)) {
        if (!regs.includes(url)) { // Valid URL and does not already exist is regs array, send request to add registry
            const data = JSON.stringify({ // MS info to send to registry 
                serviceId: serviceId,
                myUrl: myip
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
                        if (!regs.includes(regurl.href)) regs.push(regurl.href);
                        writeRegs();
                        if (res) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: "Success", url: regurl.href }));
                        }
                        console.error(`Successfully registered: ${regurl.href}`);
                    }
                    else if (responseData === "Already registered") { // Already registered, successfully reregistered. Mostly does the same with a different console message
                        console.log(`Reregistered. Response: ${responseData}`);
                        regs.push(url);
                        writeRegs();
                        if (res) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: "Success", url: regurl.href }));
                            console.error(`Successfully reregistered: ${regurl.href}`);
                        }
                    } else { // Could not register in registry from some reason
                        if (res) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: "Error: " + responseData, url: null }));
                        }
                        console.error(`Error registering: ${responseData}`);
                    }
                });
            });

            regreq.on('error', (error) => { // Url to registry does not work
                if (res) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: "Could not contact", url: null }));
                }
                console.error(`Error registering: ${error.message}`);
            });

            regreq.write(data);
            regreq.end();

        } else { // microseervice already registered in registry
            if (res) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Already registered", url: null }));
            }
        }
    } else { // registry url not valid url
        if (res) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "Invalid URL", url: null }));
        }
    }

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
function deregister(serviceId, url, res = null) {

    const index = regs.indexOf(url);
    if (index > -1) { // only splice array if url is found
        const data = JSON.stringify({ // Data in request to registry
            serviceId: serviceId,
            myUrl: myip
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
                    if (res) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: "Success", url: url }));
                    }
                    console.error(`Successfully deregistered: ${url}`);
                } else {
                    if (res) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: responseData, url: null }));
                    }
                    console.error(`Error deregistering: ${responseData}`);
                }
            });
        });

        regreq.on('error', (error) => { // No response from registry
            if (res) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Could not contact", url: null }));
            }
            console.error(`Error registering. Response: ${error.message}`);
        });

        regreq.write(data);
        regreq.end();
    } else { // Url not in internal database (regs array)
        if (res) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "Not in database", url: null }));
        }
    }

}

// Save the regs array to a json file
function writeRegs() {
    fs.writeFile('regs.json', JSON.stringify(regs, null, 2), (err) => {
        if (err) {
            console.error('Error writing file:', err);
        }
    });
}

function getMyIP() {
    return myip;
}

function getRegs() {
    return regs;
}

module.exports = { sendHeartbeat, register, deregister, getMyIP, getRegs };