import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StreamerGateway } from 'src/socket/gateways/streamer/streamer.gateway';

@Module({
    imports: [ConfigModule],
    providers: [StreamerGateway]
})
export class SocketModule {}
