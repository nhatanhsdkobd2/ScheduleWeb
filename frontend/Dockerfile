FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
COPY shared/ ./shared/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared ./shared
RUN npm ci --omit=dev --legacy-peer-deps
EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000
CMD ["npm", "start"]
