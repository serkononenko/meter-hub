export default () => ({
    port: parseInt(process.env.SERVER_PORT ?? "8083", 10),
    database: {
        url: process.env.DATABASE_URL ?? 'jdbc:postgresql://localhost:5432/identity_db',
    },
    household: {
        url: process.env.HOUSEHOLD_SERVICE_URL ?? 'localhost:8082'
    }
});
