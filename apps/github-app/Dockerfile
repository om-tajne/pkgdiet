FROM node:20-alpine AS builder

WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/github-app

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/apps/github-app/dist ./apps/github-app/dist
COPY --from=builder /app/apps/github-app/package.json ./apps/github-app/package.json
COPY --from=builder /app/apps/github-app/prisma ./apps/github-app/prisma
COPY --from=builder /app/package.json ./

WORKDIR /app/apps/github-app
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
