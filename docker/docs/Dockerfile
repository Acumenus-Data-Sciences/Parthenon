FROM node:22-alpine

WORKDIR /docs

# Copy package files first for layer caching
COPY docs/site/package*.json ./

RUN npm ci

# Copy the rest of the site source
COPY docs/site/ .

# Build to /dist (mounted as volume from host ./docs/dist)
RUN npm run build

CMD ["echo", "Docs build complete"]
