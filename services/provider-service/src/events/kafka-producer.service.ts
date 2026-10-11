import {Injectable, Logger, OnModuleDestroy} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Kafka, Partitioners} from 'kafkajs';


type Event = {
    eventId: string,
}

type Producer = ReturnType<Kafka['producer']>;

@Injectable()
export class KafkaProducerService implements OnModuleDestroy {
    private readonly logger = new Logger(KafkaProducerService.name);
    private readonly producer: Producer;
    private connected: Promise<void> | null = null;

    constructor(configService: ConfigService) {
        const kafka = new Kafka({
            clientId: 'provider-service',
            brokers: [configService.getOrThrow<string>('kafka.brokers')],
        });

        this.producer = kafka.producer({createPartitioner: Partitioners.DefaultPartitioner});
    }

    async onModuleDestroy() {
        if (this.connected) {
            await this.producer.disconnect();
        }
    }

    // Connected on first use rather than at startup: the service must come up and serve HTTP while the
    // broker is down (events simply queue in the outbox), and tests that never publish need no broker.
    async send<T extends Event>(topic: string, key: string, event: T, traceparent: string | null) {
        await this.ensureConnected();

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

    private ensureConnected(): Promise<void> {
        if (!this.connected) {
            this.connected = this.producer.connect().then(
                () => this.logger.log('Kafka producer connected'),
                (error) => {
                    this.connected = null;
                    throw error;
                },
            );
        }

        return this.connected;
    }
}
