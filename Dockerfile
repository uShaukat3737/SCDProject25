# Use lightweight Node.js
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Environment (production)
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "main.js"]
