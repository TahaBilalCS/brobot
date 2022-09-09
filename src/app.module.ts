import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PostService } from './post.service';
import { PrismaService } from './prisma.service';
import { UserService } from './user.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
    controllers: [AppController],
    providers: [AppService, PostService, UserService, PrismaService]
})
export class AppModule {}
