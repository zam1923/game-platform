FROM node:20-alpine

WORKDIR /app

# Install pnpm (works in Docker because /usr/local/bin is in PATH)
RUN npm install -g pnpm

# Copy workspace config and lock files first for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build all workspaces
RUN pnpm build

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
