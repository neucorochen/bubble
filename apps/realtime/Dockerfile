FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/realtime/package.json apps/realtime/package.json

RUN npm install --workspace @commune/shared --workspace @commune/realtime --include-workspace-root

COPY packages/shared packages/shared
COPY apps/realtime apps/realtime

RUN npm run build -w @commune/realtime

FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4100

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/realtime/package.json apps/realtime/package.json
COPY --from=build /app/apps/realtime/dist apps/realtime/dist

USER node

EXPOSE 4100

CMD ["node", "apps/realtime/dist/index.js"]
