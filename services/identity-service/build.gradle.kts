plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
    id("com.google.cloud.tools.jib") version "3.5.4"
}

group = "com.meterhub"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-jooq")
    implementation("org.flywaydb:flyway-core")

    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")

    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

jib {
    from {
        image = "eclipse-temurin:25-jre"
    }

    to {
        image = "meterhub/identity-service"
    }

    container {
        ports = listOf("8081")
        user = "1000:1000"

        jvmFlags = listOf(
            "-XX:MaxRAMPercentage=75.0"
        )
    }
}

tasks.bootRun {
    systemProperty("user.timezone", "UTC")
}

tasks.withType<Test> {
	useJUnitPlatform()
}
