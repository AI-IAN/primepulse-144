FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S primepulse -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY --chown=primepulse:nodejs . .

# Create necessary directories
RUN mkdir -p logs data && chown -R primepulse:nodejs logs data

# Switch to non-root user
USER primepulse

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Start application
CMD ["npm", "start"]