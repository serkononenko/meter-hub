CREATE TABLE users
(
    id            UUID PRIMARY KEY,
    email         VARCHAR(320) NOT NULL,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/*[ignore]*/
CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));
/*[/ignore]*/