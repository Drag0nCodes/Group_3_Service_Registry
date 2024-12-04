document.addEventListener("DOMContentLoaded", () => {
    const getStockForm = document.getElementById('getStockForm');
    const table = document.getElementById('table');
    const message = document.getElementById('message');
    const aName = document.getElementById('aName');
    const bName = document.getElementById('bName');
    const aSect = document.getElementById('aSect');
    const bSect = document.getElementById('bSect');
    const aCap = document.getElementById('aCap');
    const bCap = document.getElementById('bCap');
    const aPrice = document.getElementById('aPrice');
    const bPrice = document.getElementById('bPrice');
    const aMargin = document.getElementById('aMargin');
    const bMargin = document.getElementById('bMargin');

    getStockForm.addEventListener('submit', (event) => {
        event.preventDefault();
    
        // Convert FormData to a JSON object
        const formData = new FormData(getStockForm);
        const data = Object.fromEntries(formData.entries()); // Convert FormData to JSON
    
        fetch('/compare', {
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
                aName.textContent = data["nameA"]; // Display the server's response
                bName.textContent = data["nameB"]; 

                aSect.textContent = data["sectA"]; 
                bSect.textContent = data["sectB"]; 
                
                if (data["capA"] > data["capB"]) {
                    aCap.style.backgroundColor = 'lightgreen';
                    bCap.style.backgroundColor = 'lightcoral';
                } else {
                    bCap.style.backgroundColor = 'lightgreen';
                    aCap.style.backgroundColor = 'lightcoral';
                }
                aCap.textContent = `$${data["capA"].toLocaleString()}`; 
                bCap.textContent = `$${data["capB"].toLocaleString()}`; 
                
                if (data["priceA"] > data["priceB"]) {
                    aPrice.style.backgroundColor = 'lightgreen';
                    bPrice.style.backgroundColor = 'lightcoral';
                } else {
                    bPrice.style.backgroundColor = 'lightgreen';
                    aPrice.style.backgroundColor = 'lightcoral';
                }
                aPrice.textContent = `$${data["priceA"].toFixed(3)}`; 
                bPrice.textContent = `$${data["priceB"].toFixed(3)}`; 
                
                if (data["marginA"] > data["marginB"]) {
                    aMargin.style.backgroundColor = 'lightgreen';
                    bMargin.style.backgroundColor = 'lightcoral';
                } else {
                    bMargin.style.backgroundColor = 'lightgreen';
                    aMargin.style.backgroundColor = 'lightcoral';
                }
                aMargin.textContent = `${data["marginA"].toFixed(2)}%`; 
                bMargin.textContent = `${data["marginB"].toFixed(2)}%`; 
            }
        })
        .catch(error => {
            console.error('Error:', error);
            table.style.display = "none";
            message.textContent = "Error: Invalid Request";
        })
    });
});
