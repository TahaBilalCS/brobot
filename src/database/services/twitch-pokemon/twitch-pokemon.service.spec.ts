import { Test, TestingModule } from '@nestjs/testing';
import { TwitchPokemonService } from './twitch-pokemon.service';

describe('TwitchPokemonService', () => {
    let service: TwitchPokemonService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TwitchPokemonService]
        }).compile();

        service = module.get<TwitchPokemonService>(TwitchPokemonService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
