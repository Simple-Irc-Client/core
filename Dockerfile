# node 24.22.1 (alpine)
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

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
