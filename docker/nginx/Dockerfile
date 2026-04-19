FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY frontend/ ./
ENV VITE_STUDY_AGENT_ENABLED=false
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=frontend-builder /frontend/dist /var/www/frontend

RUN mkdir -p \
      /var/www/docs-dist \
      /var/www/html/storage/app/public \
      /var/www/ohif \
      /opt/finngen-artifacts \
    && printf '%s\n' '<!doctype html><html><body><h1>Parthenon documentation</h1><p>Documentation is packaged separately for this release image.</p></body></html>' \
      > /var/www/docs-dist/index.html \
    && chown -R nginx:nginx /var/www /opt/finngen-artifacts
