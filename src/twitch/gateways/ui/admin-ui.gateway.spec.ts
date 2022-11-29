import { Test, TestingModule } from '@nestjs/testing';
import { AdminUiGateway } from './admin-ui.gateway';

describe('AdminUiGateway', () => {
    let gateway: AdminUiGateway;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AdminUiGateway]
        }).compile();

        gateway = module.get<AdminUiGateway>(AdminUiGateway);
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });
});
