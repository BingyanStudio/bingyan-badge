FROM oven/bun:1-slim

WORKDIR /app

COPY package.json ./
RUN bun install --production

COPY . .

EXPOSE 3000
CMD ["bun", "run", "src/server.ts"]
