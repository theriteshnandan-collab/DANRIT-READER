FROM ghcr.io/puppeteer/puppeteer:21.5.2

# Run as root to install extra deps if needed (though ghcr image is usually good)
USER root

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source
COPY src ./src

# Build TypeScript
RUN npm run build

# Expose Port
EXPOSE 3000

# Start
CMD ["npm", "start"]
