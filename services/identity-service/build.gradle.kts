plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
	id("org.jooq.jooq-codegen-gradle") version "3.21.7"
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
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-jooq")
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

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
tasks.compileJava {
    dependsOn(jooqCodegenTask)
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
					// Unquoted identifiers keep their lowercase spelling (PostgreSQL convention)
					property {
						key = "defaultNameCase"
						value = "as_is"
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
