// Auto update the microservice list every couple seconds
function autoUpdate(){
    update();
    setInterval(update, 2000);
}

// Handle a submit for the search bar
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("searchForm");

    form.addEventListener("submit", (event) => {
        event.preventDefault(); // Prevents the form from submitting
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
                throw new Error(errorData.message || "An error occured");
            });
        }
        return response.json(); // Parse the JSON response
    })
    .then(data => {
        microserviceList.innerHTML = '';
        if (data.length > 0) { // There is a microservice registered
            let search = document.getElementById("search").value.toLowerCase();
            let matchedOne = false
            for (var i = 0; i < data.length; i++){ // Add div with the microservice data to the html page  
                if (data[i]["name"].toLowerCase().includes(search)) {
                    var newMS = document.createElement("div");
                    newMS.className = "row"

                    var name = document.createElement("div");
                    name.className = "col-12 col-sm-6 col-lg-8"
                    var link = document.createElement("a");
                    link.target = "_blank";
                    link.href = data[i]["addr"];
                    link.innerHTML = data[i]["name"];
                    name.appendChild(link);

                    var status = document.createElement("div");
                    status.className = "col-6 col-lg-4"
                    status.innerHTML = data[i]["status"];

                    newMS.appendChild(name);
                    newMS.appendChild(status);
                    microserviceList.appendChild(newMS);

                    matchedOne = true;
                }
            }

            if (!matchedOne) {
                var para = document.createElement("p");
                para.innerHTML = "Search returned zero results";
                microserviceList.appendChild(para);
            }
        } else { // No microservices
            var para = document.createElement("p");
            para.innerHTML = "No microservices registered";
            microserviceList.appendChild(para);
        }
    })
    .catch(error => {
        regMessage.textContent = error.message; // Display the server's error message
    });
}

