plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
	id("org.openapi.generator") version "7.25.0"
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

extra["springCloudVersion"] = "2025.1.3"

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("io.micrometer:micrometer-registry-prometheus")
	implementation("org.springframework.boot:spring-boot-starter-opentelemetry")
	implementation("org.springframework.cloud:spring-cloud-starter-gateway-server-webmvc")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.security:spring-security-oauth2-jose")
	implementation("org.springframework.security:spring-security-oauth2-resource-server")
	implementation("org.bouncycastle:bcprov-jdk18on:1.84")
	implementation("org.bouncycastle:bcpkix-jdk18on:1.84")
	implementation("com.bucket4j:bucket4j_jdk17-core:8.14.0")
	implementation("com.fasterxml.jackson.core:jackson-databind")
	implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")
	implementation("jakarta.annotation:jakarta.annotation-api")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.security:spring-security-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

dependencyManagement {
	imports {
		mavenBom("org.springframework.cloud:spring-cloud-dependencies:${property("springCloudVersion")}")
	}
}

val openApiSpec = providers.environmentVariable("OPENAPI_SPEC")
	.orElse(layout.projectDirectory.file("../../contracts/openapi/services/identity-service/openapi.yaml").asFile.absolutePath)
val openApiGenerateTask = tasks.openApiGenerate

openApiGenerateTask {
	generatorName = "java"
	inputSpec = openApiSpec.map { layout.projectDirectory.file(it) }
	outputDir = layout.buildDirectory.dir("generated/openapi")
	apiPackage = "com.meterhub.gateway.client.identity.api"
	modelPackage = "com.meterhub.gateway.client.identity.model"
	configOptions = mapOf(
		"library" to "restclient",
		"useSpringBoot3" to "true",
		"openApiNullable" to "false",
		"hideGenerationTimestamp" to "true",
		"useTags" to "true",
	)
}

sourceSets.main {
	java {
		srcDir(openApiGenerateTask.map { task -> task.outputDir.get().dir("src/main/java") })
	}
}

tasks.compileJava {
	dependsOn(openApiGenerateTask)
}

tasks.withType<Test> {
	useJUnitPlatform()
}
