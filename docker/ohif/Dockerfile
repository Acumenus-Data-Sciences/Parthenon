FROM node:18-alpine AS builder

RUN apk add --no-cache git

WORKDIR /ohif
RUN git clone --depth 1 --branch v3.9.2 https://github.com/OHIF/Viewers.git .

RUN yarn install --frozen-lockfile

ENV PUBLIC_URL=/ohif/
RUN yarn run build

# Final stage: static files + Parthenon customizations
FROM alpine:3.20
COPY --from=builder /ohif/platform/app/dist /dist

# Inject Parthenon bridge script, custom CSS, and theme overrides
COPY ohif-bridge.js /dist/ohif-bridge.js
COPY parthenon-ohif.css /dist/parthenon-ohif.css

# Inject into index.html: CSS in <head>, bridge script before </body>
RUN sed -i 's|</head>|<link rel="stylesheet" href="/ohif/parthenon-ohif.css"></head>|' /dist/index.html && \
    sed -i 's|</body>|<script src="/ohif/ohif-bridge.js"></script></body>|' /dist/index.html
