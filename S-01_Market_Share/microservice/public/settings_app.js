document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById('registerForm');
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
        })
        .catch(error => {
            regMessage.textContent = error.message; // Display the server's error message
        });
        // Reset the regMessage after 5 seconds
        setTimeout(() => {
            regMessage.textContent = ''; // Clear the message
        }, 3000);
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
            if (data["message"] === "Deregistery Successful") {
                for (let i = 0; i < deregSelect.options.length; i++) {
                    if (deregSelect.options[i].value === data["url"]) {
                        deregSelect.remove(i); // Remove the option
                        break; // Exit the loop once the option is found and removed
                    }
                }
            }
        })
        .catch(error => {
            deregMessage.textContent = error.message; // Display the server's error message
        });
        // Reset the deregMessage after 5 seconds
        setTimeout(() => {
            deregMessage.textContent = ''; // Clear the message
        }, 3000);
    });
});
