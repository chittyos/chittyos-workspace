FROM node:18-alpine

# Install required system packages
RUN apk add --no-cache \
    curl \
    bash \
    procps \
    lsof

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p session-data logs && \
    chmod 755 session-data logs && \
    chmod +x start-chittyos.sh stop-chittyos.sh

# Create non-root user
RUN addgroup -g 1001 -S chittyos && \
    adduser -S chittyos -u 1001 -G chittyos

# Change ownership of app directory
RUN chown -R chittyos:chittyos /app

# Switch to non-root user
USER chittyos

# Expose ports
EXPOSE 3001 3003 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/status || exit 1

# Default command
CMD ["node", "data-service.js"]