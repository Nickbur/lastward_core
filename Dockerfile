# ── build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install all dependencies (incl. dev) for the TypeScript build.
COPY package.json package-lock.json* ./
RUN npm install

# Compile to ./dist (NodeNext ESM, .js specifiers).
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only (the compiled drizzle-orm migrator applies the
# generated SQL at boot — drizzle-kit / tsx / typescript are not needed here).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Compiled app + the generated migrations the boot step applies.
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle

EXPOSE 8080

# Apply migrations, then start the server.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
