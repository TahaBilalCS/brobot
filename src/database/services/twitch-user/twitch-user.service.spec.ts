import { Test, TestingModule } from '@nestjs/testing';
import { TwitchUserService } from './twitch-user.service';

describe('TwitchUserService', () => {
    let service: TwitchUserService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TwitchUserService]
        }).compile();

        service = module.get<TwitchUserService>(TwitchUserService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
