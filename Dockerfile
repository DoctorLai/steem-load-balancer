FROM node:alpine

# Install jq
RUN apk add --no-cache jq

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install
RUN npm install abort-controller
RUN npm install node-fetch
RUN npm install async-mutex
RUN npm install p-limit
RUN npm install js-yaml
RUN npm install compression
RUN npm install helmet

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8080

# production
ENV NODE_ENV=production

# Entry
CMD ["node", "index.js"]
