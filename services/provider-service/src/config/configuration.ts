export default () => ({
    port: parseInt(process.env.SERVER_PORT ?? "8086", 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    database: {
        url: process.env.DATABASE_URL ?? 'postgresql://provider_user:provider_dev@localhost:5432/provider_db',
    },
    meter: {
        url: process.env.METER_SERVICE_URL ?? 'http://localhost:8083'
    },
    kafka: {
        brokers: process.env.KAFKA_BROKERS ?? 'localhost:29092'
    },
    outbox: {
        relayEnabled: (process.env.OUTBOX_RELAY_ENABLED ?? 'true') !== 'false',
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
