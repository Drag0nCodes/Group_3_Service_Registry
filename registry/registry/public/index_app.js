function autoUpdate(){
    var microserviceList = document.getElementById("microserviceList");

    setInterval(() => {
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
            for (var i = 0; i < data.length; i++){            
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
            }
        })
        .catch(error => {
            regMessage.textContent = error.message; // Display the server's error message
        });
    }, 2000); // 1 second
}

