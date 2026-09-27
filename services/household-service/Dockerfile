# syntax=docker/dockerfile:1

FROM gradle:9.7.1-jdk25-alpine AS build
WORKDIR /app

# Copy build scripts first so dependency downloads stay cached between builds.
COPY gradlew build.gradle.kts settings.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies --quiet || true

COPY src src

COPY --from=contracts . /contracts

RUN OPENAPI_SPEC=/contracts/openapi/services/household-service/openapi.yaml ./gradlew --no-daemon bootJar -x test && cp build/libs/*.jar /app.jar

FROM eclipse-temurin:25-jre
WORKDIR /app

# curl for the Compose healthcheck probing /actuator/health/liveness
# (the base JRE image ships neither curl nor wget)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --create-home appuser
COPY --from=build --chown=appuser:appuser /app.jar app.jar

USER appuser
ENV JAVA_TOOL_OPTIONS="-Duser.timezone=UTC"
EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]
