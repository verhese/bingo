FROM node:20-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN mkdir -p public
RUN npm run build
RUN ./node_modules/.bin/esbuild src/server/ws-server.ts --bundle --platform=node --format=cjs --target=node20 --outfile=/app/ws-server.cjs --external:pg-native --external:bufferutil --external:utf-8-validate
RUN node -e "const fs = require('node:fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.scripts.start = 'node server.js'; pkg.scripts['start:ws'] = 'node ws-server.cjs'; fs.writeFileSync('/app/runtime-package.json', JSON.stringify(pkg));"

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/ws-server.cjs ./ws-server.cjs
COPY --from=builder /app/runtime-package.json ./package.json

EXPOSE 3000 3001
CMD ["npm", "start"]