export default () => ({
    port: parseInt(process.env.SERVER_PORT ?? "8083", 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    database: {
        url: process.env.DATABASE_URL ?? 'postgresql://meter_user:meter_dev@localhost:5432/meter_db',
    },
    household: {
        url: process.env.HOUSEHOLD_SERVICE_URL ?? 'http://localhost:8082'
    },
    identity: {
        jwt: {
            issuer: process.env.IDENTITY_JWT_ISSUER ?? 'identity-service',
            audience: process.env.IDENTITY_JWT_AUDIENCE ?? 'meterhub-api',
            publicKeyPath: process.env.IDENTITY_JWT_PUBLIC_KEY_PATH ?? './certs/identity.jwt.public-key'
        }
    }
});
