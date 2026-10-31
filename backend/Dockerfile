# Stage 1: Build
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run with Blender installed
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install Blender headless and required graphics libraries for background procedural execution
RUN apt-get update && apt-get install -y --no-install-recommends \
    blender \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENV SERVER_PORT=8080
ENTRYPOINT ["java", "-XX:+UseSerialGC", "-Xmx220m", "-Xms64m", "-jar", "app.jar"]
