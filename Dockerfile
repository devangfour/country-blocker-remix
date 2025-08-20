FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3001

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force
# Remove CLI packages since we don't need them in production by default.
# Remove this line if you want to run CLI commands in your container.
RUN npm remove @shopify/cli

COPY . .

RUN npx prisma generate
RUN npx prisma db push

RUN npm run build

CMD ["npm", "run", "docker-start"]
