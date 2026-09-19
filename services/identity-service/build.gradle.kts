plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
	id("org.jooq.jooq-codegen-gradle") version "3.21.7"
	id("org.openapi.generator") version "7.14.0"
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
	jooqCodegen("org.jooq:jooq-meta-extensions:3.21.7")

	implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.security:spring-security-oauth2-jose")
    implementation("org.springframework.security:spring-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-jooq")
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.bouncycastle:bcprov-jdk18on:1.84")
    implementation("org.bouncycastle:bcpkix-jdk18on:1.84")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("io.swagger.core.v3:swagger-annotations-jakarta:2.2.55")

    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")

    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.bootRun {
    systemProperty("user.timezone", "UTC")
}

// Make generated jOOQ sources part of the main source set, so compileJava
// sees them and depends on jooqCodegen running first
val jooqCodegenTask = tasks.named<org.jooq.codegen.gradle.CodegenTask>("jooqCodegen")
sourceSets.main {
    java {
        srcDir(jooqCodegenTask.map { task -> task.outputDirectory.first().get() })
    }
}

val openApiSpec = providers.environmentVariable("OPENAPI_SPEC")
    .orElse(layout.projectDirectory.file("../../contracts/openapi/services/identity-service/openapi.yaml").asFile.absolutePath)
val openApiGenerateTask = tasks.openApiGenerate

openApiGenerateTask {
    generatorName = "spring"
    inputSpec = openApiSpec.get()
    outputDir = layout.buildDirectory.dir("generated/openapi").get().asFile.absolutePath
    apiPackage = "com.meterhub.identity.adapters.inbound.web.api"
    modelPackage = "com.meterhub.identity.adapters.inbound.web.dto"
    modelNameSuffix = "Dto"
    configOptions = mapOf(
        "useSpringBoot3" to "true",
        "interfaceOnly" to "true",
        "skipDefaultInterface" to "true",
        "requestMappingMode" to "api_interface",
        "openApiNullable" to "false",
        "enumPropertyNaming" to "original",
        "serializableModel" to "true",
        "hideGenerationTimestamp" to "true",
        "useTags" to "true",
    )
}

sourceSets.main {
    java {
        srcDir(openApiGenerateTask.map { task -> task.outputDir.get() + "/src/main/java" })
    }
}

tasks.compileJava {
    dependsOn(jooqCodegenTask, openApiGenerateTask)
}

jooq {
	configuration {
		generator {
			database {
				name = "org.jooq.meta.extensions.ddl.DDLDatabase"
				properties {
					property {
						key = "scripts"
						value = "src/main/resources/db/migration/**/*.sql"
					}
					// Sort files the same way Flyway does (by version number),
					// so V20260905115213__create_table.sql in subdirectories is applied in order
					property {
						key = "sort"
						value = "flyway"
					}
					// Unquoted identifiers keep their lowercase spelling (PostgreSQL convention).
					// Must be exactly "AS_IS": the DDLDatabase visitor only skips name
					// transformation when the property matches this constant verbatim.
					property {
						key = "defaultNameCase"
						value = "AS_IS"
					}
					// Skip statements H2 can't handle (e.g. expression indexes); Flyway still applies them.
					// Markers are matched against the CONTENT of a /* ... */ comment, so the SQL writes /*[ignore]*/
					property {
						key = "parseIgnoreComments"
						value = "true"
					}
					property {
						key = "parseIgnoreCommentStart"
						value = "[ignore]"
					}
					property {
						key = "parseIgnoreCommentStop"
						value = "[/ignore]"
					}
				}
			}
			target {
				packageName = "com.meterhub.identity.jooq"
			}
		}
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
	// Same reason as bootRun: macOS resolves Europe/Kiev, which PostgreSQL rejects
	systemProperty("user.timezone", "UTC")
}
