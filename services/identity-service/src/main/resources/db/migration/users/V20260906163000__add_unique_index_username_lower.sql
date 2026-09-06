-- Usernames must be unique case-insensitively, matching the email behavior.
-- Expression indexes are invisible to the jOOQ code generator, so this
-- statement is wrapped in ignore markers (see build.gradle.kts codegen config).
/*[ignore]*/
CREATE UNIQUE INDEX uq_users_username_lower ON users (LOWER(username));
/*[/ignore]*/
