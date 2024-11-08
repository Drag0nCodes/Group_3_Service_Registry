let regTimeout = 0;
let deregTimeout = 0;

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById('registerForm');regurl
    const regUrlInput = document.getElementById('regurl');
    const deregisterForm = document.getElementById('deregisterForm');
    const regMessage = document.getElementById('regMessage');
    const deregSelect = document.getElementById('deregSelect');

    registerForm.addEventListener('submit', (event) => {
        event.preventDefault();
    
        // Convert FormData to a JSON object
        const formData = new FormData(registerForm);
        const data = Object.fromEntries(formData.entries()); // Convert FormData to JSON
    
        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // Set the correct header
            },
            body: JSON.stringify(data) // Send data as JSON string
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || "An error occured");
                });
            }
            return response.json(); // Parse the JSON response
        })
        .then(data => {
            regMessage.textContent = data["message"]; // Display the server's response
            const newOption = new Option(data["url"], data["url"]);
            deregSelect.add(newOption);
            regUrlInput.value = "";
        })
        .catch(error => {
            regMessage.textContent = error.message; // Display the server's error message
        });
        // Keep message for 3 seconds
        regTimeout = 3;
    });

    deregisterForm.addEventListener('submit', (event) => {
        event.preventDefault();
    
        // Convert FormData to a JSON object
        const formData = new FormData(deregisterForm);
        const data = Object.fromEntries(formData.entries()); // Convert FormData to JSON
    
        fetch('/deregister', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // Set the correct header
            },
            body: JSON.stringify(data) // Send data as JSON string
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || "An error occured");
                });
            }
            return response.json(); // Parse the JSON response
        })
        .then(data => {
            deregMessage.textContent = data["message"]; // Display the server's response
            if (data["message"] === "Success") {
                for (let i = 0; i < deregSelect.options.length; i++) {
                    if (deregSelect.options[i].value === data["url"]) {
                        deregSelect.remove(i); // Remove the option
                        break; // Exit the loop once the option is found and removed
                    }
                }
            }
        })
        .catch(error => {
            deregMessage.textContent = "bad " + error.message; // Display the server's error message
        });
        // Keep message for 3 seconds
        deregTimeout = 3;
    });
});

setInterval(() => {
    if (regTimeout <= 0) regMessage.textContent = ''; // Clear the message
    else regTimeout--;
    if (deregTimeout === 0) deregMessage.textContent = ''; // Clear the message
    else deregTimeout--;
}, 1000); // 1 second
