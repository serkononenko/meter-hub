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
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-jooq")
	implementation("org.flywaydb:flyway-database-postgresql")
	runtimeOnly("org.postgresql:postgresql")
	jooqCodegen("org.jooq:jooq-meta-extensions:3.21.7")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-jooq-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

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
					property { key = "scripts"; value = "src/main/resources/db/migration/**/*.sql" }
					// Sort files the same way Flyway does (by version number), so
					// table references between migrations resolve correctly.
					property { key = "sort"; value = "flyway" }
					// Unquoted identifiers keep their lowercase spelling (PostgreSQL convention).
					// Must be exactly "AS_IS": the DDLDatabase visitor only skips name
					// transformation when the property matches this constant verbatim.
					property { key = "defaultNameCase"; value = "AS_IS" }
					// Skip statements H2 can't handle (e.g. foreign keys); Flyway still applies them.
					// Markers are matched against the CONTENT of a /* ... */ comment, so the SQL writes /*[ignore]*/
					property { key = "parseIgnoreComments"; value = "true" }
					property { key = "parseIgnoreCommentStart"; value = "[ignore]" }
					property { key = "parseIgnoreCommentStop"; value = "[/ignore]" }
				}
			}
			target {
				packageName = "com.meterhub.household.jooq"
			}
		}
	}
}

tasks.bootRun {
	systemProperty("user.timezone", "UTC")
}

tasks.withType<Test> {
	useJUnitPlatform()
	// Same reason as bootRun: macOS resolves Europe/Kiev, which PostgreSQL rejects
	systemProperty("user.timezone", "UTC")
}
