FROM node:22-alpine

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY frontend/ .

RUN chown -R node:node /app
USER node

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
