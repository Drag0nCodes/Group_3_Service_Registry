
# Registry


This is a registry service that is able to list, manage, and search internet-capable microservices that register in it. 

## To run:
- Make sure you have npm, node, and MySQL installed
- Install dependencies: npm install
- Create a MySQL database called service_registry with the code below, user 'root' should have the password 'password', otherwise update server.js to have the correct authentication for the database

> CREATE DATABASE service_registry;  
> USE service_registry;
> 
> CREATE TABLE registries (
>     id INT AUTO_INCREMENT PRIMARY KEY,
>     service_id VARCHAR(255) NOT NULL,
>     url VARCHAR(255) NOT NULL UNIQUE,
>     status VARCHAR(50) DEFAULT 'healthy',
>     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP );

- Run the server.js file with node and elevated privileges (sudo) as it will run on port 80 (HTTP)
- You should see the registry start running and that it has connected to the database
