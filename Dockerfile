# Use Node.js v18 on Alpine (lightweight)
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy all project files into the container
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Start your app (note: your entry file is in the root, not src/)
CMD ["node", "server.js"]
