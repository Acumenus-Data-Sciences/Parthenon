# Stage 1: Builder
FROM rust:1.88 AS builder

# Install git and OpenSSL dev headers needed to build the workspace
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone the OHDSI Hecate repository
RUN git clone --depth 1 https://github.com/OHDSI/Hecate.git .

# Build the api crate in release mode (standalone crate under api/).
WORKDIR /build/api
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies: OpenSSL 3 and CA certs for TLS
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for the service
RUN useradd --system --no-create-home --shell /usr/sbin/nologin hecate

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /build/api/target/release/hecate-api /app/hecate-api

RUN chown hecate:hecate /app/hecate-api && chmod +x /app/hecate-api

USER hecate

EXPOSE 8080

CMD ["/app/hecate-api"]
