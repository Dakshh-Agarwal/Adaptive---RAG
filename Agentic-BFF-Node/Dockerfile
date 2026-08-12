# Dockerfile for Agentic-BFF-Node (Node.js Auth Gateway)
# Port: 8080

FROM node:22-slim

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy rest of application
COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]
