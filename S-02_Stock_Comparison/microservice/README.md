# Microservice S-02: Stock Comparison

This is a microservice that is able to register in the registry. It is able to compare two stocks provided to it by the user and show which statistics are better for the two.

## To run:
- Make sure you have npm and node installed
- Install dependencies: npm install
- Change the IP environment variable in the .env file to the public IP that the microservice will be accessible from, this is to allow for registering the microservice
- Run the server.js file with node and elevated privileges (sudo node server.js) as it will run on port 80 (HTTP)
- You should see microservice start running and the address it is accessible from

