document.addEventListener("DOMContentLoaded", () => {
    const getStockForm = document.getElementById('getStockForm');
    const table = document.getElementById('table');
    const message = document.getElementById('message');
    const stock = document.getElementById('stock');
    const refresh = document.getElementById('refresh');
    const open = document.getElementById('open');
    const close = document.getElementById('close');
    const volume = document.getElementById('volume');

    getStockForm.addEventListener('submit', (event) => {
        event.preventDefault();
    
        // Convert FormData to a JSON object
        const formData = new FormData(getStockForm);
        const data = Object.fromEntries(formData.entries()); // Convert FormData to JSON
    
        fetch('/getStock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // Set the correct header
            },
            body: JSON.stringify(data) // Send data as JSON string
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json(); // Parse the JSON response
        })
        .then(data => {
            message.textContent = "";
            table.style.display = "flex";
            stock.textContent = data["2. Symbol"]; // Display the server's response
            refresh.textContent = data["3. Last Refreshed"];
            open.textContent = data["1. open"];
            close.textContent = data["4. close"];
            volume.textContent = data["5. volume"];
        })
        .catch(error => {
            console.error('Error:', error);
            message.textContent = "Invalid Request";
        })
    });
});
