# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY index.html ./
COPY vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json postcss.config.js tailwind.config.ts ./
COPY public ./public
COPY src ./src

# Optional absolute API origin for non-proxied hosts; leave empty when nginx proxies /api.
ARG VITE_API_BASE=
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# ---- runtime (nginx) ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
