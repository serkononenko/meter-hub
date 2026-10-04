import {defineConfig} from 'prisma/config';


export default defineConfig({
    schema: 'prisma/schema.prisma',
    typedSql: {
        path: 'prisma/sql',
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
