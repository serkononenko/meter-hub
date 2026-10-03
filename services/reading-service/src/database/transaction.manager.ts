import {Injectable} from "@nestjs/common";
import {PrismaService} from "./prisma.service.js";
import {Prisma} from '../generated/prisma/client.js';


@Injectable()
export class TransactionManager {
    constructor(private readonly prisma: PrismaService) {
    }

    execute<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>,): Promise<T> {
        return this.prisma.$transaction(callback);
    }
}