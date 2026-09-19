export default () => ({
    port: parseInt(process.env.SERVER_PORT ?? "8084", 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    database: {
        url: process.env.DATABASE_URL ?? 'postgresql://reading_user:reading_dev@localhost:5432/reading_db',
    },
    meter: {
        url: process.env.METER_SERVICE_URL ?? 'http://localhost:8083'
    },
    identity: {
        jwt: {
            issuer: process.env.IDENTITY_JWT_ISSUER ?? 'identity-service',
            audience: process.env.IDENTITY_JWT_AUDIENCE ?? 'meterhub-api',
            publicKeyPath: process.env.IDENTITY_JWT_PUBLIC_KEY_PATH ?? './certs/identity.jwt.public-key'
        }
    }
});
