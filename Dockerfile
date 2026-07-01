# Pin to the current Node.js LTS on Alpine for small, reproducible images.
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Install system dependencies in a single step
RUN apk add --no-cache jq

# Copy only package files first (for layer caching)
COPY package*.json ./

# Install production dependencies from the lockfile (reproducible builds)
RUN npm ci --omit=dev

# Copy rest of the app
COPY . .

# Expose port
EXPOSE 9091

# Set environment
ENV NODE_ENV=production

# Container health probe hitting the built-in /health endpoint (HTTP or HTTPS).
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD ["node", "tools/healthcheck.js"]

# Run the app
CMD ["node", "src/index.js"]
