# Imagem de produção do SexPapo (Next.js + Prisma + sharp)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_SITE_NAME=SexPapo
ARG NEXT_PUBLIC_CURRENCY_NAME=Pimentas
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME NEXT_PUBLIC_CURRENCY_NAME=$NEXT_PUBLIC_CURRENCY_NAME
RUN npx prisma generate && npx next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000
COPY --from=build /app ./
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
# aplica o schema + seed idempotente e sobe
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npx next start -p 3000"]
