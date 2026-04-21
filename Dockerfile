FROM node:20-alpine AS builder

# Enable PNPM
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM nginx:1.30-alpine AS server

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html \
      && chown -R nginx:nginx /var/cache/nginx \
      && chown -R nginx:nginx /var/log/nginx \
      && touch /var/run/nginx.pid \
      && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
