FROM node:18-alpine AS builder

RUN apk add --no-cache git

WORKDIR /ohif
RUN git clone --depth 1 --branch v3.9.2 https://github.com/OHIF/Viewers.git .

RUN yarn install --frozen-lockfile

ENV PUBLIC_URL=/ohif/
RUN yarn run build

# Final stage: just the static files
FROM alpine:3.20
COPY --from=builder /ohif/platform/app/dist /dist
