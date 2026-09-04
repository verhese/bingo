FROM node:20-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

ARG NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000 3001
CMD ["npm", "start"]