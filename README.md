# Distributed_Listening
Distributed Listening with Mobile Phones Project for CART 470

## How to Run
1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Navigate to the server.
   ```bash
   cd server
   ```
4. Run these commands to use the minimum Node version required specified in .nvmrc
   ```bash
   nvm install
   nvm use
   ```
5. Install the required dependencies by running:
   ```bash
   npm install
   ```
6. Start the server by running:
   ```bash
   node index.js
   ```
7. Open the `client/index.html` file in a web browser to connect to the WebSocket server and receive audio channel information.
