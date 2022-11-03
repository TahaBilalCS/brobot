import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BotChatService, CommandStream } from 'src/twitch/services/bot-chat/bot-chat.service';
import { StreamerGateway } from 'src/twitch/gateways/streamer/streamer.gateway';
import { pokedexArr, pokeRoarActions, gen4PokeDex } from 'src/twitch/services/pokemon/PokeInfo';
import { Dex, Species } from '@pkmn/sim';
/**
 * Stored player info
 */
interface BattleUser {
    name: string;
    oauthId: string;
}
/**
 * Stores player battle info
 */
interface PokemonBattle {
    userStarted?: BattleUser;
    userAccepted?: BattleUser;
    battleTimer?: NodeJS.Timer;
    // battleStatus?: BattleStatus;
}

@Injectable()
export class PokemonService implements OnModuleDestroy {
    private readonly logger = new Logger(PokemonService.name);
    private commandSubscription: Subscription;

    private chatBattle: PokemonBattle = {};

    /**
     * Array of all valid pokemon names
     * @private
     */
    private readonly pokedex: string[] = gen4PokeDex;

    /**
     * Array of quotes pokemon use when they roar
     * @private
     */
    private _pokeRoarActionList: string[] = pokeRoarActions;

    constructor(
        private configService: ConfigService,
        private readonly httpService: HttpService,
        private botChatService: BotChatService,
        // @Inject(forwardRef(() => StreamerGateway))
        private streamerGateway: StreamerGateway
    ) {
        console.log('PokemonService constructor');
        this.commandSubscription = this.botChatService.commandStream.subscribe(async (commandStream: CommandStream) => {
            if (commandStream.command.msg === 'pokemon') {
                const userOauthId = commandStream.pvtMessage.userInfo.userId;
                if (!userOauthId) this.logger.error('No userOauthId', commandStream.username, commandStream.message);
                switch (commandStream.command.args[0]) {
                    case 'battle':
                        // todo: pokemon model, have pokemon store auth id, and that id can link to twitchuser
                        if (!this.chatBattle.userStarted) await this.createBattle(userOauthId);
                        break;
                    case 'roar':
                        break;
                    default:
                        // TODO Update this
                        this.botChatService.clientSay(`Pokemon Info: https://imgur.com/a/2u62OUh`);
                }
            }
        });
    }

    private createBattle(userOauthId: string) {
        // when finding db pokemon, how to know which one is starter?
    }

    /**
     * Create our pokedex for a specific generation
     * @param gen
     */
    getAllBaseSpeciesForGen(gen: number): string[] {
        // Filter out non standard pokemon, and then only store non duplicate baseSpecies
        // Ex: Arceus has 18 forms, but only 1 baseSpecies
        const arr: string[] = [];
        Dex.forGen(gen)
            .species.all()
            .filter(s => !s.isNonstandard)
            .forEach(s => {
                if (!arr.includes(s.baseSpecies)) {
                    arr.push(s.baseSpecies);
                }
            });
        return arr;
    }

    private getRandomGen4Pokemon() {
        // 386 for gen 3
        const randomPokeIndex = Math.floor(Math.random() * 493);
        return Dex.forGen(4).species.get(this.pokedex[randomPokeIndex]);
    }

    public async upsertRandomPokemon(oauthId: string): Promise<void> {
        const randomPokemon = this.getRandomGen4Pokemon();
    }

    public onModuleDestroy(): any {
        this.commandSubscription.unsubscribe();
    }
}
