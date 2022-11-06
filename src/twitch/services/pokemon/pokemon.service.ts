import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BotChatService, CommandStream } from 'src/twitch/services/bot-chat/bot-chat.service';
import { StreamerGateway } from 'src/twitch/gateways/streamer/streamer.gateway';
import { pokedexArr, pokeRoarActions, gen4PokeDex } from 'src/twitch/services/pokemon/PokeInfo';
import { Dex, Nature, Species } from '@pkmn/sim';
import { Generations } from '@pkmn/data';
import { TwitchPokemonService } from 'src/database/services/twitch-pokemon/twitch-pokemon.service';
import { Prisma } from '@prisma/client';
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
    userStarted: BattleUser | null;
    userAccepted: BattleUser | null;
    battleTimer: NodeJS.Timer | null;
    // battleStatus?: BattleStatus;
}

@Injectable()
export class PokemonService implements OnModuleDestroy {
    private readonly logger = new Logger(PokemonService.name);
    private commandSubscription: Subscription;

    private chatBattle: PokemonBattle = {
        userStarted: null,
        userAccepted: null,
        battleTimer: null
    };

    /**
     * Array of all valid pokemon names
     * @private
     */
    private readonly pokedex: string[] = gen4PokeDex;

    /**
     * Array of quotes pokemon use when they roar
     * @private
     */
    private pokeRoarActionList: string[] = pokeRoarActions;

    constructor(
        private configService: ConfigService,
        private readonly httpService: HttpService,
        private botChatService: BotChatService,
        // @Inject(forwardRef(() => StreamerGateway))
        private streamerGateway: StreamerGateway,
        private pokemonDbService: TwitchPokemonService
    ) {
        console.log('PokemonService constructor');
        this.commandSubscription = this.botChatService.commandStream.subscribe(async (commandStream: CommandStream) => {
            if (commandStream.command.msg === 'pokemon') {
                const userOauthId = commandStream.pvtMessage.userInfo.userId;
                if (!userOauthId) this.logger.error('No userOauthId', commandStream.username, commandStream.message);
                switch (commandStream.command.args[0]) {
                    case 'battle':
                        // todo: pokemon model, have pokemon store auth id, and that id can link to twitchuser
                        // If no user started, create battle
                        if (!this.chatBattle.userStarted)
                            await this.create1v1Battle(commandStream.username, userOauthId);
                        // If same user tried to start battle
                        else if (this.chatBattle.userStarted.name === commandStream.username)
                            this.botChatService.clientSay(`You can't battle yourself, @${commandStream.username}`);
                        // If second unique user initiates battle
                        else if (!this.chatBattle.userAccepted)
                            await this.acceptBattle(commandStream.username, userOauthId);
                        // If we somehow entered this state
                        else
                            this.botChatService.clientSay(
                                `How unlucky, @${commandStream.username}. Things might have gotten spammy. Try again later`
                            );
                        break;
                    case 'roar':
                        break;
                    case 'seduce':
                        break;
                    default:
                        // TODO Update this
                        this.botChatService.clientSay(`Pokemon Info: https://imgur.com/a/2u62OUh`);
                        this.redeemPokemonCreate(commandStream.username, commandStream.pvtMessage.userInfo.userId);
                    // const test = this.getAllBaseSpeciesForGen(4);
                    // let count = 0;
                    // test.forEach(species => {
                    //     const isShiny = this.determineShiny();
                    //     if (isShiny) {
                    //         count++;
                    //         console.log(species);
                    //     }
                    // });
                    // console.log('count', count);
                }
            }
        });
    }

    private determineGender(pokemonName: string): 'M' | 'F' | '' {
        const pokemon = this.getGen4PokemonByName(pokemonName);
        if (pokemon.gender === 'N') {
            const genderPecent = pokemon.genderRatio.M * 100;
            const rand = this.randomIntFromInterval(0, 100);
            return rand <= genderPecent ? 'M' : 'F';
        }

        // M, F, '' (nidoranf, legendaries, etc)
        return pokemon.gender;
    }

    private determineAbility(pokemonName: string): string {
        const pokemon = this.getGen4PokemonByName(pokemonName);
        const abilities = Object.values(pokemon.abilities);
        const random = this.randomIntFromInterval(0, abilities.length - 1);
        return abilities[random];
    }

    private determineNature(): Nature {
        const natures = Dex.forGen(4)
            .natures.all()
            .filter(s => !s.isNonstandard);
        const random = this.randomIntFromInterval(0, natures.length - 1);
        return natures[random];
    }

    private async determinePokemonMoveset(name: string): Promise<string[]> {
        // can also do pokemon.id instead of name using getById
        const pokemonLearnset = await Dex.forGen(4).learnsets.get(name);
        if (pokemonLearnset.learnset) return Object.keys(pokemonLearnset.learnset);
        return [];
    }

    private isShiny(): boolean {
        return this.randomIntFromInterval(1, 250) <= 1;
    }

    // todo
    private create1v1Battle(username: string, userOauthId: string): void {
        // when finding db pokemon, how to know which one is starter?
        this.chatBattle.userStarted = { name: username, oauthId: userOauthId };
        let userPokemon: any;
        try {
            // userPokemon = this.pokemonService.findStarter;
        } catch (err) {
            this.logger.error('Error finding pokemon', err);
        }

        if (!userPokemon) {
            this.chatBattle.userStarted = null;
            this.botChatService.clientSay(
                `@${username}, you don't have a starter pokemon. You can birth one by using channel points`
            );
            return;
        }

        // todo add emoji to SHINY
        this.botChatService.clientSay(
            `@${username}'s Level ${userPokemon.level} ${userPokemon.shiny ? '_SHINY_' : ''} ${
                userPokemon.name
            } wants to battle! You have 1 minute to accept their challenge, by using the command "!pokemon battle"`
        );
        this.chatBattle.battleTimer = setInterval(() => {
            // If timer not cleared yet, then end the pending battle
            if (this.chatBattle.battleTimer) {
                if (this.chatBattle.userStarted) {
                    this.botChatService.clientSay(
                        `Ending pending pokemon battle for @${this.chatBattle.userStarted?.name}. You are feared by all`
                    );
                }
                clearInterval(this.chatBattle.battleTimer);
                this.chatBattle = {
                    userStarted: null,
                    userAccepted: null,
                    battleTimer: null
                };
            }
        }, 1000 * 60);
    }

    // private createTeamBattle(username: string, userOauthId: string): void {
    //     // when finding db pokemon, how to know which one is starter?
    //     this.chatBattle.userStarted = {name: username, oauthId: userOauthId}
    //     let userPokemon = this.pokemonService.findStarter
    // }

    private async acceptBattle(username: string, userOauthId: string): Promise<void> {
        return;
    }

    /**
     * Create our pokedex for a specific generation
     * Every Pokemon Has These
     * abilities
     * dexNumber     Int
     * types         String[]
     * color         String
     * generation    Int Generation
     * genderRatio   Json
     * @param gen
     */
    private getAllBaseSpeciesForGen(gen: number): string[] {
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

    private randomIntFromInterval(min: number, max: number): number {
        // min and max included
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    private getRandomGen4Pokemon(): Species {
        // 386 for gen 3
        // Number non inclusive, 0-492
        const randomPokeIndex = Math.floor(Math.random() * 493);
        return Dex.forGen(4).species.get(this.pokedex[randomPokeIndex]);
    }

    private getGen4PokemonByName(name: string): Species {
        return Dex.forGen(4).species.get(name);
    }

    // Changes starter pokemon
    public async redeemPokemonCreate(username: string, oauthId: string): Promise<void> {
        if (!oauthId) {
            this.logger.error('No oauthId found while upserting random pokemon');
            this.botChatService.clientSay(`@${username} failed to change pokemon. The refund police will be notified`);
            // todo refund channel points
            return;
        }

        const randomPokemon = this.getRandomGen4Pokemon();
        const pokemonMoveset = await this.determinePokemonMoveset(randomPokemon.name);

        if (pokemonMoveset.length === 0) {
            this.logger.error(`Pokemon found with no moves: ${randomPokemon.name}`);
            this.botChatService.clientSay(
                `@${username}, your pokemon ${randomPokemon.name} has no moves. The refund police will be notified`
            );
            // todo refund channel points
            return;
        }
        const isShiny = this.isShiny();
        const userPokemon: Prisma.PokemonUncheckedCreateInput = {
            twitchOauthId: oauthId,
            name: randomPokemon.name
            // nameId: randomPokemon.id,
            //
            // level: 1,
            // shiny: isShiny,
            // // slot: 0, // todo wtf we tryna do here, need to check other pokemon before adding new one?
            // item: '',
            // wins: 0,
            // losses: 0,
            // draws: 0,
            // gender: this.determineGender(randomPokemon.name),
            // moves: pokemonMoveset,
            // nature: this.determineNature().name,
            // ability: this.determineAbility(randomPokemon.name)
        };

        // cant create pokemon without a User?
        //
        // todo
        const res = await this.pokemonDbService.redeemPokemon({ pokemon: userPokemon, slot: 0 }, oauthId);
        console.log('RES', res);
        // https://stackoverflow.com/questions/74288790/is-there-a-way-to-limit-the-number-of-records-for-a-user-using-prisma
        // if (!res) {
        //     this.logger.error(`Failed to upsert pokemon for user: ${username}: ${randomPokemon.name}`);
        //     this.botChatService.clientSay(`@${username} failed to update/create starter pokemon. The refund police will be notified`)
        //     // todo refund channel points
        //     return;
        // }
        // const randomRoar = this.pickRandomRoar();
        // this.botChatService.clientSay( `/me @${username}'s Level 1 ${res.pokemonName} roared ${randomRoar}`)
    }
    /**
     * Pick a random roar from array
     * @private
     */
    private pickRandomRoar(): string {
        const randomRoadIndex = Math.floor(Math.random() * (this.pokeRoarActionList.length - 1));
        return this.pokeRoarActionList[randomRoadIndex];
    }

    public onModuleDestroy(): any {
        this.commandSubscription.unsubscribe();
    }
}
