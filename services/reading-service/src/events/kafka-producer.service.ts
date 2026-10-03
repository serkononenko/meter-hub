import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Kafka, Partitioners} from 'kafkajs';


type Event = {
    eventId: string,
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaProducerService.name);
    private readonly producer: Awaited<ReturnType<Kafka['producer']>>;

    constructor(configService: ConfigService) {
        const kafka = new Kafka({
            clientId: 'reading-service',
            brokers: [configService.getOrThrow<string>('kafka.brokers')],
        });

        this.producer = kafka.producer({createPartitioner: Partitioners.DefaultPartitioner});
    }

    async onModuleInit() {
        await this.producer.connect();
        this.logger.log('Kafka producer connected');
    }

    async onModuleDestroy() {
        await this.producer.disconnect();
    }

    async send<T extends Event>(topic: string, key: string, event: T, traceparent: string | null) {
        await this.producer.send({
            topic,
            messages: [{
                key,
                value: JSON.stringify(event),
                headers: {
                    eventId: event.eventId,
                    ...(traceparent ? {traceparent} : {}),
                },
            }],
        });
    }
}
