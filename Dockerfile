# syntax=docker/dockerfile:1

# Build with the full workspace dependency graph, including TypeScript.
FROM node:20-alpine AS build
WORKDIR /opt/pkgdiet

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/mcp/package.json packages/mcp/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/ai-tool/package.json packages/ai-tool/package.json
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/mcp packages/mcp
COPY packages/cli packages/cli
RUN npm run build
RUN node packages/cli/build/cli.js --version

# Install only the runtime dependency graph in a clean stage.
FROM node:20-alpine AS production-dependencies
WORKDIR /opt/pkgdiet

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/mcp/package.json packages/mcp/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/ai-tool/package.json packages/ai-tool/package.json
RUN npm ci --omit=dev --ignore-scripts

# MCP communicates over stdin/stdout. Keep the runtime free of build tools and
# use stderr for any Node or application diagnostics.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PKGDIET_MCP_MODE=1

WORKDIR /opt/pkgdiet
COPY --from=production-dependencies /opt/pkgdiet/node_modules ./node_modules
COPY --from=build /opt/pkgdiet/packages/core/package.json packages/core/package.json
COPY --from=build /opt/pkgdiet/packages/core/dist packages/core/dist
COPY --from=build /opt/pkgdiet/packages/core/data packages/core/data
COPY --from=build /opt/pkgdiet/packages/mcp/package.json packages/mcp/package.json
COPY --from=build /opt/pkgdiet/packages/mcp/dist packages/mcp/dist
COPY --from=build /opt/pkgdiet/packages/cli/package.json packages/cli/package.json
COPY --from=build /opt/pkgdiet/packages/cli/build packages/cli/build

# Policy and cache files belong to the mounted project workspace, never the
# immutable application layer. The image runs as the built-in unprivileged user.
RUN mkdir /workspace && chown node:node /workspace
WORKDIR /workspace
USER node

ENTRYPOINT ["node", "/opt/pkgdiet/packages/cli/build/cli.js", "mcp"]
