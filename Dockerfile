FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV AI_PYTHON_EXECUTABLE=python3

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --omit=dev --workspace backend

COPY backend ./backend

CMD ["npm", "start", "--workspace", "backend"]
