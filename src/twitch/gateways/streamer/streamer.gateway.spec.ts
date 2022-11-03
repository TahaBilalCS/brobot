import { Test, TestingModule } from '@nestjs/testing';
import { StreamerGateway } from 'src/twitch/gateways/streamer/streamer.gateway';

describe('StreamerGateway', () => {
    let gateway: StreamerGateway;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [StreamerGateway]
        }).compile();

        gateway = module.get<StreamerGateway>(StreamerGateway);
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });
});
