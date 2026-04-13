# Stage 1: Build
# Giữ cùng layout với repo (frontend/ và shared/ cùng cấp) để tsconfig path @shared/* -> ../shared/* resolve đúng.
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY shared/ ./shared/

COPY frontend/package*.json ./frontend/
WORKDIR /workspace/frontend
RUN npm ci --legacy-peer-deps

COPY frontend/ .
RUN npm run build

# Stage 2: Run
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /workspace/frontend/public ./public
COPY --from=builder /workspace/frontend/.next ./.next
COPY --from=builder /workspace/frontend/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["npm", "start"]
