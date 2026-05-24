FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install && npm install typescript

COPY tsconfig.json ./
COPY src/ ./src/

RUN ./node_modules/.bin/tsc


FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/build ./build

EXPOSE 8080

CMD ["node", "build/index.js"]
