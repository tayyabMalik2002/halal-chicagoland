# node:20-slim (Debian, glibc) rather than alpine — bcrypt compiles a
# native addon at install time and must run on the same glibc/musl family
# it was built against.
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
