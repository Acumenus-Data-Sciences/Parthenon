# =============================================================================
# Stage 1: Builder — clone OHDSI/WhiteRabbit and build with Maven
# =============================================================================
FROM maven:3.9-eclipse-temurin-17 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone the latest stable release of WhiteRabbit (shallow clone for speed)
RUN git clone --depth 1 https://github.com/OHDSI/WhiteRabbit.git .

# Override Maven settings to exclude the ICM repository (maven.ceon.pl)
# which intermittently returns 403 Forbidden and blocks CI builds.
RUN mkdir -p /root/.m2 && cat > /root/.m2/settings.xml << 'SETTINGS'
<settings>
  <mirrors>
    <mirror>
      <id>icm-mirror</id>
      <mirrorOf>icm</mirrorOf>
      <url>https://repo.maven.apache.org/maven2</url>
    </mirror>
  </mirrors>
</settings>
SETTINGS

# Install parent POM + rabbit-core to local repo, then build whiterabbit.
# The parent POM (leporidae) and rabbit-core aren't in any remote Maven
# repo — they must be installed locally before whiterabbit can resolve them.
RUN mvn -N install --no-transfer-progress \
    && mvn -pl rabbit-core install \
        -DskipTests \
        --no-transfer-progress \
    && mvn -pl whiterabbit package \
        -DskipTests \
        -DskipUnitTests=true \
        -DskipITs=true \
        --no-transfer-progress \
    && mvn -pl whiterabbit appassembler:assemble \
        --no-transfer-progress

# =============================================================================
# Stage 2: Runtime — minimal JRE + Python wrapper
# =============================================================================
FROM eclipse-temurin:17-jre-jammy

# Install Python 3 (stdlib only — wrapper uses no third-party packages) and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root service user
RUN useradd --system --no-create-home --shell /usr/sbin/nologin whiterabbit

WORKDIR /app

# Copy the assembled distribution from the builder stage
COPY --from=builder /build/dist /app/dist

# Copy the HTTP wrapper script
COPY docker/whiterabbit/wrapper.py /app/wrapper.py

RUN chmod +x /app/dist/bin/whiteRabbit \
    && chmod +x /app/wrapper.py \
    && chown -R whiterabbit:whiterabbit /app

USER whiterabbit

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8090/health || exit 1

CMD ["python3", "/app/wrapper.py"]
