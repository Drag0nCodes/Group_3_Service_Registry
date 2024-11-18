document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById('registerForm');
    const regUrlInput = document.getElementById('regurl');
    const deregisterForm = document.getElementById('deregisterForm');
    const message = document.getElementById('message');
    const deregSelect = document.getElementById('deregSelect');
    const toast = document.getElementById('toast');

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
            toast.className = "toast align-items-center text-bg-primary border-0 position-fixed bottom-0 end-0 m-3";
            message.textContent = "Successfully registered"; // Display the server's response
            const newOption = new Option(data["url"], data["url"]);
            deregSelect.add(newOption);
            regUrlInput.value = "";
            showToast();
        })
        .catch(error => {
            toast.className = "toast align-items-center text-bg-danger border-0 position-fixed bottom-0 end-0 m-3";
            message.textContent = error.message; // Display the server's error message
            showToast();
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
            toast.className = "toast align-items-center text-bg-primary border-0 position-fixed bottom-0 end-0 m-3";
            message.textContent = "Successfully deregistered"; // Display the server's response
            if (data["message"] === "Success") {
                for (let i = 0; i < deregSelect.options.length; i++) {
                    if (deregSelect.options[i].value === data["url"]) {
                        deregSelect.remove(i); // Remove the option
                        break; // Exit the loop once the option is found and removed
                    }
                }
            }
            showToast();
        })
        .catch(error => {
            toast.className = "toast align-items-center text-bg-danger border-0 position-fixed bottom-0 end-0 m-3";
            message.textContent = error.message; // Display the server's error message
            showToast();
        });
        // Keep message for 3 seconds
        deregTimeout = 3;
    });
});

function showToast(){
    const toastElList = [].slice.call(document.querySelectorAll('.toast'));
            const toastList = toastElList.map(function (toastEl) {
                return new bootstrap.Toast(toastEl);
            });
            toastList.forEach(toast => toast.show());
}
