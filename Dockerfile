FROM node:20-alpine
WORKDIR /app

# Copy package configurations
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/mcp/package.json packages/mcp/
COPY packages/cli/package.json packages/cli/

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json tsconfig.base.json ./
COPY packages/core/ packages/core/
COPY packages/mcp/ packages/mcp/
COPY packages/cli/ packages/cli/

# Build packages
RUN npm run build

# Set entrypoint
ENTRYPOINT ["node", "packages/cli/dist/cli.js", "mcp"]
