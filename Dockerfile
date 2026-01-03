# Install dependencies and build
FROM oven/bun:1-debian AS build-env

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production image
FROM oven/bun:1-debian

# Install eccodes (ECMWF's GRIB library)
RUN apt-get update && apt-get install -y \
    libeccodes-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application
COPY --from=build-env /app/package.json ./
COPY --from=build-env /app/node_modules ./node_modules
COPY --from=build-env /app/build ./build

# Create data directory
RUN mkdir -p /app/data/gribs

# Expose port
EXPOSE 3000

CMD ["bun", "run", "start"]
