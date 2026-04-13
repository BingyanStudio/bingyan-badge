FROM node:20-slim

WORKDIR /app

# sharp 需要的系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
