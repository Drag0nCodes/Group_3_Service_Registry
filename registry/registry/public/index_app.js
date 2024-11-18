let currSearch = "";

// Auto update the microservice list every couple seconds
function autoUpdate() {
    update();
    setInterval(update, 2000);
}

// Handle a submit for the search bar
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("searchForm");

    form.addEventListener("submit", (event) => {
        event.preventDefault(); // Prevents the form from submitting
        currSearch = document.getElementById("search").value.toLowerCase();
        update();
    });
});

// Update the microservice list based on the content in the search bar
function update() {
    var microserviceList = document.getElementById("microserviceList");

    fetch('/getMicroservices', {
        method: 'GET'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.message || "An error occurred");
            });
        }
        return response.json(); // Parse the JSON response
    })
    .then(data => {
        microserviceList.innerHTML = ''; // Clear the existing list
        if (data.length > 0) { // There are registered microservices
            let matchedOne = false;

            data.forEach(service => { // Loop through each service
                // Match the current search term with service_id (as "name")
                if (service["service_id"].toLowerCase().includes(currSearch)) {
                    var newMS = document.createElement("div");
                    newMS.className = "row mb-2";

                    // Service ID as Name
                    var name = document.createElement("div");
                    name.className = "col-6";
                    var link = document.createElement("a");
                    link.target = "_blank";
                    link.href = service["url"]; // Hidden, but available if we want clickable links
                    link.innerHTML = service["service_id"]; // Display service_id as the name
                    name.appendChild(link);

                    // Status
                    var status = document.createElement("div");
                    status.className = "col-6";
                    status.innerHTML = service["status"];

                    newMS.appendChild(name);
                    newMS.appendChild(status);
                    microserviceList.appendChild(newMS);
                    matchedOne = true;
                }
            });

            if (!matchedOne) {
                var para = document.createElement("p");
                para.innerHTML = "Search returned zero results";
                microserviceList.appendChild(para);
            }
        } else { // No microservices are registered
            var para = document.createElement("p");
            para.innerHTML = "No microservices registered";
            microserviceList.appendChild(para);
        }
    })
    .catch(error => {
        microserviceList.innerHTML = ''; // Clear the existing list
        var regMessage = document.createElement("p");
        regMessage.textContent = error.message;
        microserviceList.appendChild(regMessage);
    });
}
