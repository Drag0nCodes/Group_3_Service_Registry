document.addEventListener("DOMContentLoaded", () => {
    const getStockForm = document.getElementById('getStockForm');
    const table = document.getElementById('table');
    const message = document.getElementById('message');
    const company = document.getElementById('company');
    const sector = document.getElementById('sector');
    const price = document.getElementById('price');
    const cap = document.getElementById('cap');
    const percent = document.getElementById('percent');

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
            if (typeof data === 'string'){
                message.textContent = data;
                table.style.display = "none";
            } else {
                message.textContent = "";
                table.style.display = "flex";
                company.textContent = data["name"]; // Display the server's response
                sector.textContent = data["sect"];
                price.textContent = data["price"];
                cap.textContent = data["cap"];
                percent.textContent = data["pcnt"];
            }
        })
        .catch(error => {
            console.error('Error:', error);
            table.style.display = "none";
            message.textContent = "Error: Invalid Request";
        })
    });
});
