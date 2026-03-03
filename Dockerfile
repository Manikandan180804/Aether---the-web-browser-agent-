# Build stage for frontend
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM mcr.microsoft.com/playwright:v1.50.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm install --production
# Move TypeScript and tsx to production dependencies if not already there
# (Already done in package.json in previous step)

COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig*.json ./

EXPOSE 3001

ENV PORT=3001
ENV HEADLESS=true
ENV NODE_ENV=production

CMD ["npx", "tsx", "src/server/index.ts"]
