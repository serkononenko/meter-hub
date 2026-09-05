# syntax=docker/dockerfile:1

FROM gradle:9.7.1-jdk25-alpine AS build
WORKDIR /app

# Copy build scripts first so dependency downloads stay cached between builds.
COPY gradlew build.gradle.kts settings.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies --quiet || true

COPY src src
RUN ./gradlew --no-daemon bootJar -x test && cp build/libs/*.jar /app.jar

FROM eclipse-temurin:25-jre
WORKDIR /app

RUN useradd --system --create-home appuser
COPY --from=build --chown=appuser:appuser /app.jar app.jar

USER appuser
ENV JAVA_TOOL_OPTIONS="-Duser.timezone=UTC"
EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
