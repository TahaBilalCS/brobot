import { Module } from '@nestjs/common';
import { StreamerSocket } from 'src/socket/socket';
@Module({
    providers: [StreamerSocket]
})
export class SocketModule {}
