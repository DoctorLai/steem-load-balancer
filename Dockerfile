FROM node:alpine

# Set working directory
WORKDIR /app

# Install system dependencies in a single step
RUN apk add --no-cache jq

# Copy only package files first (for caching)
COPY package*.json ./

# Install all dependencies in one step
RUN npm install --production

# Copy rest of the app
COPY . .

# Expose port
EXPOSE 9091

# Set environment
ENV NODE_ENV=production

# Run the app
CMD ["node", "src/index.js"]
