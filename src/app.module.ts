import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';

console.log('App Module Init');
@Module({
    providers: [AppService],
    controllers: [AppController],
    imports: [DatabaseModule, AuthModule, ConfigModule.forRoot()],
    exports: []
})
export class AppModule {}
