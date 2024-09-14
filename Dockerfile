FROM node:alpine

# Install jq
RUN apk add --no-cache jq

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8080

# Entry
CMD ["node", "index.js"]
