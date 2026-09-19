export default () => ({
    port: parseInt(process.env.SERVER_PORT ?? "8084", 10),
    database: {
        url: process.env.DATABASE_URL ?? 'postgresql://reading_user:reading_dev@localhost:5432/reading_db',
    },
});
