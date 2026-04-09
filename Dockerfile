FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

# ── Production image ───────────────────────────
FROM node:20-alpine

RUN addgroup -g 1001 -S vortex && \
    adduser -S vortex -u 1001

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/uploads /app/data && \
    chown -R vortex:vortex /app

USER vortex

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ENV DB_PATH=/app/data/vortex.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
