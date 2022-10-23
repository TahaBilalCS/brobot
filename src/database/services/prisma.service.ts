import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        try {
            console.log('Prisma Service Connecting...');
            await this.$connect();
            console.log('Prisma Service Connected');
        } catch (err) {
            console.log('Prisma Service Error', err);
        }
    }

    async enableShutdownHooks(app: INestApplication) {
        this.$on('beforeExit', async () => {
            await app.close();
        });
    }

    // Might not be needed
    async onModuleDestroy() {
        await this.$disconnect();
    }
}
