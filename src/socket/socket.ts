import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway()
export class StreamerSocket {
    @SubscribeMessage('newMessage')
    onNewMessage(@MessageBody() body: any) {
        console.log('New message', body);
        console.log('New message');
    }
}
