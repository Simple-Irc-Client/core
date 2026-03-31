FROM node:24-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile --prod

COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5173

CMD ["pnpm", "run", "dev"]
