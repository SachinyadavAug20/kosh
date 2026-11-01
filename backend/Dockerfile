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

# Install Blender headless, NumPy, pip, and required graphics libraries for background procedural execution
RUN apt-get update && apt-get install -y \
    blender \
    python3-numpy \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# If Blender uses its own isolated bundled Python runtime, install numpy directly into Blender's Python:
RUN find /usr/ -name "python3*" -path "*/blender/*" -exec {} -m pip install numpy \; 2>/dev/null || true

# Install numpy for the default python interpreter used by bpy:
RUN pip install --break-system-packages numpy 2>/dev/null || pip3 install numpy 2>/dev/null || true

COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENV SERVER_PORT=8080
ENTRYPOINT ["java", "-XX:+UseSerialGC", "-Xmx220m", "-Xms64m", "-jar", "app.jar"]
