import { Test, TestingModule } from '@nestjs/testing';
import { StreamerApiService } from './streamer-api.service';

describe('StreamerApiService', () => {
    let service: StreamerApiService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [StreamerApiService]
        }).compile();

        service = module.get<StreamerApiService>(StreamerApiService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
