export default () => ({
    port: parseInt(process.env.SERVER_PORT ?? "8085", 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    database: {
        url: process.env.DATABASE_URL ?? 'postgresql://events_demo_user:events_demo_dev@localhost:5432/events_demo_db',
    },
    kafka: {
        brokers: process.env.KAFKA_BROKERS ?? 'localhost:29092',
        groupId: process.env.KAFKA_GROUP_ID ?? 'events-demo',
        topic: process.env.KAFKA_TOPIC ?? 'meter.reading.created',
    },
});
