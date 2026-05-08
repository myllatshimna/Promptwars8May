# Use the official Node.js 20 lightweight image
FROM node:20-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port Cloud Run uses
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
