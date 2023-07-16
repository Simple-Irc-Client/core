FROM node:18-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

USER node

RUN npm ci --only=production

COPY --chown=node:node . .

CMD [ "npm", "run", "dev", "--", "--host" ]

EXPOSE 5173
