import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BotChatService, CommandStream } from 'src/twitch/services/bot-chat/bot-chat.service';
import { StreamerGateway } from 'src/twitch/gateways/streamer/streamer.gateway';
import * as fs from 'fs';

import {
    pokeSlaughterApproachList,
    pokeSlaughterActionList,
    pokeRoarActions,
    gen4PokeDex,
    pokeFailedCatchList
} from 'src/twitch/services/pokemon/PokeInfo';
import { BattleStreams, Dex, Nature, Species, Teams, StatsTable, PokemonSet, RandomPlayerAI } from '@pkmn/sim';
import { Generations } from '@pkmn/data';
import {
    PokemonCatchException,
    PokemonLevelException,
    PokemonRedeemException,
    PokemonSwapException,
    PokemonTeamWithPokemon,
    TwitchPokemonService
} from 'src/database/services/twitch-pokemon/twitch-pokemon.service';
import { Prisma, Pokemon, PokemonTeam } from '@prisma/client';
import { TeamGenerators } from '@pkmn/randoms';
import { BattleStream } from '@pkmn/sim/build/sim/battle-stream';
import { CronJob, CronTime } from 'cron';
import { EventSubChannelRedemptionAddEvent } from '@twurple/eventsub';
import { AdminUiGateway, PokemonRoarChatEvent } from 'src/twitch/gateways/ui/admin-ui.gateway';

interface TODOREMOVE extends PokemonCreateChatEvent {
    pokemonLevel: number;
}
interface PokemonCreateChatEvent {
    username: string;
    oauthId: string;
    slot: number;
}

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

export interface PokemonDefault {
    name: string;
    slot: number;
    nameId: string;
    shiny: boolean;
    gender: string;
    moves: string[];
    color: string;
    dexNum: number;
    types: string[];
    nature: string;
    ability: string;
    level: number;
    wins: number;
    losses: number;
    draws: number;
    item: string;
    updatedDate: Date;
    createdDate: Date;
}

export interface PokemonDrop {
    name: string;
    nameId: string;
    shiny: boolean;
    gender: string;
    moves: string[];
    color: string;
    dexNum: number;
    types: string[];
    nature: string;
    ability: string;
    level: number;
    wins: number;
    losses: number;
    draws: number;
    item: string;
    updatedDate: Date;
    createdDate: Date;
}

export interface PokemonChatDrop {
    active: boolean;
    interval: null | NodeJS.Timer;
    totalCaught: number;
    pokemonDrop: PokemonDrop | null;
    uniqueRedeemers: Set<string>;
    userAttemptsMap: Map<string, number>;
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

    private chatTeamBattle: PokemonBattle = {
        userStarted: null,
        userAccepted: null,
        battleTimer: null
    };

    private pokemonChatDrop: PokemonChatDrop = {
        active: false,
        interval: null,
        totalCaught: 0,
        pokemonDrop: null,
        uniqueRedeemers: new Set(),
        userAttemptsMap: new Map()
    };

    private pokemonSlaughterLimitMap: Map<string, number> = new Map();
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
        private adminUiGateway: AdminUiGateway,
        private pokemonDbService: TwitchPokemonService
    ) {
        // At Midnight EST
        const slaughterResetJob = new CronJob(
            '0 0 0 * * *',
            async () => {
                this.logger.warn(`Clearing Slaughter List`);
                this.pokemonSlaughterLimitMap.clear();
            },
            null,
            true,
            'America/New_York'
        );

        // Every 15 seconds */15 * * * * *
        // 9th minute every 2nd hour '0 9 */2 * * *'
        const pokemonChatDropCron = new CronJob(
            '*/20 * * * * *',
            async () => {
                const pokemonDrop = await this.generatePokemonDrop();
                this.logger.warn(`Creating New Drop: ${pokemonDrop.name}`, new Date().toISOString());
                const dropInterval = setInterval(() => {
                    // If timer not cleared yet, then end the pending battle
                    if (this.pokemonChatDrop.interval) {
                        if (this.pokemonChatDrop.active) {
                            const peopleString = this.pokemonChatDrop.totalCaught === 1 ? 'person' : 'people';
                            this.botChatService.clientSay(
                                `Ending encounter. ${this.pokemonChatDrop.totalCaught} ${peopleString} caught ${this.pokemonChatDrop?.pokemonDrop?.name}`
                            );
                        }
                        clearInterval(this.pokemonChatDrop.interval);
                        this.pokemonChatDrop = {
                            active: false,
                            interval: null,
                            totalCaught: 0,
                            pokemonDrop: null,
                            uniqueRedeemers: new Set(),
                            userAttemptsMap: new Map()
                        };
                    }
                }, 1000 * 15);
                // todo change back to 60 ^
                this.pokemonChatDrop = {
                    active: true,
                    interval: dropInterval,
                    totalCaught: 0,
                    pokemonDrop: pokemonDrop,
                    uniqueRedeemers: new Set(),
                    userAttemptsMap: new Map()
                };

                await this.botChatService.clientSay(
                    `/me A wild level 1 ${pokemonDrop.shiny ? 'PogChamp ****SHINY**** PogChamp' : ''} ${
                        pokemonDrop.name
                    } has appeared for 1 minute! Type "!pokemon catch" for a chance to catch it if you have space for another pokemon`
                );
            },
            null,
            true,
            'America/New_York'
        );

        this.commandSubscription = this.botChatService.commandStream.subscribe(async (commandStream: CommandStream) => {
            if (commandStream.command.msg === 'pokemon') {
                const userOauthId = commandStream.pvtMessage.userInfo.userId;
                if (!userOauthId) this.logger.error('No userOauthId', commandStream.username, commandStream.message);
                switch (commandStream.command.args[0].toLowerCase()) {
                    case 'team':
                        this.logger.log(`Pokemon Team Command`);
                        const team = await this.pokemonDbService.getTeam(userOauthId);
                        if (team) {
                            if (team.pokemon.length === 0) {
                                await this.botChatService.clientSay(`You have no pokemon in your team`);
                                return;
                            }
                            const battleOutcomeUrl = `${
                                process.env.UI_URL
                            }/pokemon/team?username=${commandStream.username.toLowerCase()}`;
                            await this.botChatService.clientSay(`Check out your team here: ${battleOutcomeUrl}`);
                        } else {
                            await this.botChatService.clientSay(`You have no pokemon team`);
                        }
                        break;
                    case 'battle':
                        // If no user started, create battle
                        if (!this.chatBattle.userStarted)
                            await this.create1v1Battle(commandStream.username, userOauthId);
                        // If same user tried to start battle
                        else if (this.chatBattle.userStarted.name === commandStream.username)
                            this.botChatService.clientSay(`You can't battle yourself, @${commandStream.username}`);
                        // If second unique user initiates battle
                        else if (!this.chatBattle.userAccepted)
                            await this.accept1v1Battle(commandStream.username, userOauthId);
                        // If we somehow entered this state
                        else
                            this.botChatService.clientSay(
                                `How unlucky, @${commandStream.username}. Things might have gotten spammy. Try again later`
                            );
                        break;
                    case 'teambattle':
                        // If no user started, create battle
                        if (!this.chatTeamBattle.userStarted)
                            await this.createTeamBattle(commandStream.username, userOauthId);
                        // If same user tried to start battle
                        else if (this.chatTeamBattle.userStarted.name === commandStream.username)
                            this.botChatService.clientSay(`You can't team battle yourself, @${commandStream.username}`);
                        // If second unique user initiates battle
                        else if (!this.chatTeamBattle.userAccepted)
                            await this.acceptTeamBattle(commandStream.username, userOauthId);
                        // If we somehow entered this state
                        else
                            this.botChatService.clientSay(
                                `How unlucky, @${commandStream.username}. Things have gotten spammy. Try again later`
                            );
                        break;
                    case 'catch':
                        if (!this.pokemonChatDrop.active)
                            this.botChatService.clientSay(
                                `No pokemon available. Wait for the 69th minute of every other hour`
                            );
                        await this.catchPokemon(this.pokemonChatDrop.pokemonDrop, userOauthId, commandStream.username);
                        break;
                    // case 'seduce':
                    //     break;
                    case 'remove':
                    case 'delete':
                        {
                            const pokemonSlotString = commandStream.command.args[1];
                            const pokemonSlotNum = parseInt(pokemonSlotString);
                            if (isNaN(pokemonSlotNum) || pokemonSlotNum < 1 || pokemonSlotNum > 6) {
                                this.botChatService.clientSay(
                                    `@${commandStream.username}, please enter a slot number between 1 and 6`
                                );
                                return;
                            }
                            await this.deletePokemon(commandStream.username, userOauthId, pokemonSlotNum);
                        }
                        break;
                    case 'swap':
                    case 'switch':
                        {
                            const pokemonSlotString1 = commandStream.command.args[1];
                            const pokemonSlotNum1 = parseInt(pokemonSlotString1);

                            const pokemonSlotString2 = commandStream.command.args[2];
                            const pokemonSlotNum2 = parseInt(pokemonSlotString2);

                            if (
                                isNaN(pokemonSlotNum1) ||
                                pokemonSlotNum1 < 1 ||
                                pokemonSlotNum1 > 6 ||
                                isNaN(pokemonSlotNum2) ||
                                pokemonSlotNum2 < 1 ||
                                pokemonSlotNum2 > 6
                            ) {
                                this.botChatService.clientSay(
                                    `@${commandStream.username}, make sure both slot numbers are between 1 and 6`
                                );
                                return;
                            }

                            await this.swapPokemon(
                                commandStream.username,
                                userOauthId,
                                pokemonSlotNum1,
                                pokemonSlotNum2
                            );
                        }
                        break;
                    // case 'create': {
                    //     const pokemonSlotString = commandStream.command.args[1];
                    //     const pokemonSlotNum = parseInt(pokemonSlotString);
                    //     if (isNaN(pokemonSlotNum) || pokemonSlotNum < 1 || pokemonSlotNum > 6) {
                    //         this.botChatService.clientSay(
                    //             `@${commandStream.username}, please enter a slot number between 1 and 6`
                    //         );
                    //         return;
                    //     }
                    //     const event: PokemonCreateChatEvent = {
                    //         username: commandStream.username,
                    //         oauthId: userOauthId,
                    //         slot: pokemonSlotNum
                    //     };
                    //     await this.redeemPokemonCreate(event);
                    //     break;
                    // }
                    case 'test':
                        {
                            // fix json todo also remove
                            // https://codebeautify.org/json-fixer
                            const test = fs.readFileSync('pokemon.json', 'utf8');
                            const obj = JSON.parse(test);
                            let i;
                            const failedUsers = [];
                            for (i = 0; i < obj.length; i++) {
                                // console.log(obj[i]);
                                const user = await this.botChatService.checkUser(obj[i]);
                                if (!user) {
                                    console.error('No user found', obj[i].twitchName, obj[i].uid);
                                    // todo store in list for rama
                                    failedUsers.push(obj);
                                    continue;
                                }

                                if (user.id !== obj[i].uid) {
                                    // critical should not happen ever
                                    console.error("UIDs don't match", obj[i].uid, user.id);
                                    console.error('MISMATCH', obj[i].twitchName, user.displayName, user.name);
                                    failedUsers.push(user);
                                    continue;
                                }

                                if (!obj[i].pokemonLevel) {
                                    console.error('No pokemon level', obj[i].twitchName, obj[i].uid);
                                    failedUsers.push(user);
                                    continue;
                                }

                                // Dont care about this, just use username from streamer api service
                                if (user.displayName.toLowerCase() !== obj[i].twitchName.toLowerCase()) {
                                    console.error(
                                        `Usernames Dont Match: ${user.displayName} --- ${user.name} ||| ${obj[i].twitchName}`
                                    );
                                }

                                // todo enable this when ready
                                // const event: TODOREMOVE = {
                                //     username: user.name, // user.displayName can have special characters
                                //     oauthId: user.id,
                                //     slot: 1,
                                //     pokemonLevel: obj[i].pokemonLevel
                                // };
                                // await this.redeemPokemonCreateFIXTODOREMOVE(event);
                            }
                            console.log('done', i);
                            console.log('failed', failedUsers.length);
                            // await this.redeemPokemonRoar({ username: commandStream.username, oauthId: userOauthId });
                        }
                        break;
                    default:
                        const commandsUrl = `${process.env.UI_URL}/commands`;
                        await this.botChatService.clientSay(`Pokemon Commands: ${commandsUrl}`);
                }
            }
        });
    }

    private determineGender(pokemonName: string): 'M' | 'F' | 'N' {
        const pokemon = this.getGen4PokemonByName(pokemonName);

        if (pokemon.gender === '') {
            const genderPercent = pokemon.genderRatio.M * 100;
            const rand = this.randomIntFromInterval(0, 100);
            return rand <= genderPercent ? 'M' : 'F';
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

    private async create1v1Battle(username: string, userOauthId: string): Promise<void> {
        // when finding db pokemon, how to know which one is starter?
        this.chatBattle.userStarted = { name: username, oauthId: userOauthId };
        let userPokemonTeam: PokemonTeamWithPokemon | null = null;
        try {
            userPokemonTeam = await this.pokemonDbService.findUniquePokemonTeam(userOauthId);
        } catch (err) {
            this.logger.error('Error Finding Unique Pokemon Team', err);
        }

        if (!userPokemonTeam || userPokemonTeam.pokemon.length < 1) {
            this.chatBattle.userStarted = null;
            await this.botChatService.clientSay(
                `@${username}, you don't have any pokemon. You can birth one using channel points`
            );
            return;
        }

        // find pokemon in team in slot 1
        const starterPokemon = userPokemonTeam.pokemon.find(pokemon => pokemon.slot === 1);

        if (!starterPokemon) {
            this.chatBattle.userStarted = null;
            await this.botChatService.clientSay(
                `@${username}, you don't have a pokemon assigned to slot 1. Swap another pokemon into slot 1 or birth one using channel points`
            );
            return;
        }

        await this.botChatService.clientSay(
            `@${username}'s Level ${starterPokemon.level} ${
                starterPokemon.shiny ? 'PogChamp ****SHINY**** PogChamp' : ''
            } ${
                starterPokemon.name
            } wants to battle! You have 1 minute to accept their challenge using the command "!pokemon battle"`
        );
        this.chatBattle.battleTimer = setInterval(() => {
            // If timer not cleared yet, then end the pending battle
            if (this.chatBattle.battleTimer) {
                if (this.chatBattle.userStarted) {
                    this.botChatService.clientSay(
                        `Ending pending pokemon battle for @${this.chatBattle.userStarted?.name}. You're simply built different`
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

    private async createTeamBattle(username: string, userOauthId: string): Promise<void> {
        this.chatTeamBattle.userStarted = { name: username, oauthId: userOauthId };
        let userPokemonTeam: PokemonTeamWithPokemon | null = null;
        try {
            userPokemonTeam = await this.pokemonDbService.findUniquePokemonTeam(userOauthId);
        } catch (err) {
            this.logger.error('Error Finding Unique Team Battle', err);
        }

        if (!userPokemonTeam || userPokemonTeam.pokemon.length < 1) {
            this.chatTeamBattle.userStarted = null;
            this.botChatService.clientSay(
                `@${username}, you don't have any pokemon. You can birth one using channel points`
            );
            return;
        }

        // todo show team level or link to pokemon team page
        await this.botChatService.clientSay(
            `@${username} wants to team battle! You have 1 minute to accept their challenge using the command "!pokemon teambattle"`
        );

        this.chatTeamBattle.battleTimer = setInterval(() => {
            // If timer not cleared yet, then end the pending battle
            if (this.chatTeamBattle.battleTimer) {
                if (this.chatTeamBattle.userStarted) {
                    this.botChatService.clientSay(
                        `Ending pending pokemon team battle for @${this.chatTeamBattle.userStarted?.name}. Pokemon is for children`
                    );
                }
                clearInterval(this.chatTeamBattle.battleTimer);
                this.chatTeamBattle = {
                    userStarted: null,
                    userAccepted: null,
                    battleTimer: null
                };
            }
        }, 1000 * 60);
    }

    public async redeemLevelUp(event: EventSubChannelRedemptionAddEvent): Promise<void> {
        const username = event.userDisplayName.trim().toLowerCase();
        const userOauthId = event.userId;
        try {
            const pokemon = await this.pokemonDbService.levelUpStarter(userOauthId);
            if (pokemon) {
                await this.botChatService.clientSay(`@${username}'s ${pokemon.name} leveled up to ${pokemon.level}!`);
                await event.updateStatus('FULFILLED');
            } else {
                await this.botChatService.clientSay(
                    `@${username}, something went wrong leveling up your pokemon. You will be automatically refunded`
                );
                await event.updateStatus('CANCELED');
            }
        } catch (err) {
            if (err instanceof PokemonLevelException) {
                this.logger.error('Exception Leveling Up', err);
                await this.botChatService.clientSay(`@${username}, ${err.message}. You will be automatically refunded`);
                await event.updateStatus('CANCELED');
                return;
            }
            this.logger.error('Unhandled Error Leveling Up', err);
            await this.botChatService.clientSay(
                `@${username}, something went wrong leveling up your pokemon. You will be automatically refunded`
            );
            await event.updateStatus('CANCELED');
        }
    }

    private async handleBattleOutcome(
        winnerPokemon: Pokemon,
        loserPokemon: Pokemon,
        turnChunk: string,
        turnCount: number,
        battleOutcome: string
    ): Promise<void> {
        // Array of ways to win a battle - Adds a bit of flair you know
        const randomMoveList = [
            'completely obliterated',
            'absolutely brutalized',
            'thoroughly whooped',
            'downright annihilated',
            'unreservedly decimated',
            'utterly devastated',
            'totally eradicated',
            'perfectly liquidated',
            'unconditionally demolished'
        ];

        let noMoveString = '';
        let winningMoveString = '';
        // Find index of last move used to determine battle outcome
        const indexOfWinningMove = turnChunk.lastIndexOf('|move|');
        // If winning move found
        if (indexOfWinningMove !== -1) {
            const moveUnparsed = turnChunk.substring(indexOfWinningMove);
            const move = moveUnparsed.split('\n')[0];
            const winnerMove = move.split('|');
            winningMoveString = 'used ' + winnerMove[3] + ' and'; // e.g. used Ice Beam and
        } else {
            noMoveString = 'somehow'; // Use temp string since winning move not found
        }

        const randomMoveIndex = this.randomIntFromInterval(0, randomMoveList.length - 1);
        const randomMoveString = randomMoveList[randomMoveIndex];
        const moveString = noMoveString + winningMoveString; // One or the other is empty

        let winnerName;
        let loserName;
        if (this.chatBattle.userAccepted?.oauthId === winnerPokemon.userOauthId) {
            winnerName = this.chatBattle.userAccepted.name;
            loserName = this.chatBattle.userStarted?.name;
        } else {
            winnerName = this.chatBattle.userStarted?.name;
            loserName = this.chatBattle.userAccepted?.name;
        }
        // e.g. On turn 6, Bill's Level 6 Charizard totally eradicated Elia's Level 3 Bulbasaur
        await this.botChatService.clientSay(
            `On turn ${turnCount}, ${winnerName}'s Level ${winnerPokemon.level} ${
                winnerPokemon.shiny ? 'PogChamp ****SHINY**** PogChamp' : ''
            } ${winnerPokemon.name} ${moveString} ${randomMoveString} ${loserName}'s Level ${loserPokemon.level} ${
                loserPokemon.name
            }! ${battleOutcome}`
        );

        // Determine if the winner should level up. Winner has to be <= 20 levels higher than opponents' level
        let levelUpWinner = true;
        if (winnerPokemon.level - loserPokemon.level > 20) {
            levelUpWinner = false;
            await this.botChatService
                .clientSay(`@${winnerName}, your pokemon is over 20 levels higher than your opponent's. 
                You ain't leveling up from this one`);
        }

        // Level up winner if it applies
        try {
            await this.pokemonDbService.updateLoserPokemon(loserPokemon);
            let updatedWinnerPokemon;
            if (levelUpWinner) {
                updatedWinnerPokemon = await this.pokemonDbService.updateWinnerPokemon(winnerPokemon, 1);
            } else {
                updatedWinnerPokemon = await this.pokemonDbService.updateWinnerPokemon(winnerPokemon, 0);
            }

            if (updatedWinnerPokemon) {
                await this.botChatService.clientSay(
                    `@${winnerName}'s ${updatedWinnerPokemon.name} leveled up to ${updatedWinnerPokemon.level}!`
                );
            }
        } catch (err) {
            this.logger.error('Error updating pokemon outcome', err);
        }
    }

    private async accept1v1Battle(username: string, userOauthId: string): Promise<void> {
        // Immediately set user to ensure no other battles are created while retrieving info
        this.chatBattle.userAccepted = { name: username, oauthId: userOauthId };

        if (!this.chatBattle.userStarted) {
            this.logger.error('This should never happen. User accepted battle but no user started');
            return;
        }

        let userStartedPokemon: Pokemon | null = null;
        let userAcceptedPokemon: Pokemon | null = null;

        try {
            userStartedPokemon = await this.pokemonDbService.findStarterPokemon(this.chatBattle.userStarted.oauthId);
            userAcceptedPokemon = await this.pokemonDbService.findStarterPokemon(this.chatBattle.userAccepted.oauthId);
        } catch (err) {
            this.logger.error('Error Finding Starter Pokemon For Battle', err);
        }

        if (!userStartedPokemon) {
            this.chatBattle.userAccepted = null;
            this.botChatService.clientSay(`Something went horribly wrong. Try accepting this battle again`);
            return;
        }

        if (!userAcceptedPokemon) {
            this.chatBattle.userAccepted = null;
            this.botChatService.clientSay(
                `@${username}, you tryna fight with your bare hands? Birth a pokemon using channel points, or swap an existing one to slot 1`
            );
            return;
        }

        try {
            // Initialize teams and pokemon battle stream
            Teams.setGeneratorFactory(TeamGenerators);
            const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
            const spec = { formatid: 'gen4customgame' };

            const teamStarted = [
                {
                    name: userStartedPokemon.name,
                    species: userStartedPokemon.name,
                    gender: userStartedPokemon.gender,
                    moves: userStartedPokemon.moves,
                    ability: userStartedPokemon.ability,
                    evs: {} as StatsTable,
                    ivs: {} as StatsTable,
                    item: userStartedPokemon.item,
                    level: userStartedPokemon.level,
                    shiny: userStartedPokemon.shiny,
                    nature: userStartedPokemon.nature
                } as PokemonSet
            ];

            const teamAccepted = [
                {
                    name: userAcceptedPokemon.name,
                    species: userAcceptedPokemon.name,
                    gender: userAcceptedPokemon.gender,
                    moves: userAcceptedPokemon.moves,
                    ability: userAcceptedPokemon.ability,
                    evs: {} as StatsTable,
                    ivs: {} as StatsTable,
                    item: userAcceptedPokemon.item,
                    level: userAcceptedPokemon.level,
                    shiny: userAcceptedPokemon.shiny,
                    nature: userAcceptedPokemon.nature
                } as PokemonSet
            ];

            // Init players' teams
            const p1spec = { name: this.chatBattle.userStarted.name, team: Teams.pack(teamStarted) };
            const p2spec = { name: this.chatBattle.userAccepted.name, team: Teams.pack(teamAccepted) };

            // Init players
            const p1 = new RandomPlayerAI(streams.p1);
            const p2 = new RandomPlayerAI(streams.p2);

            // Recommended usage in Pokemon-Showdown documentation
            // A little weird but using await here will prevent the app from continuing.
            // Seems the way this library works is it initializes some things asynchronously and then
            // lets the stream handle future inputs
            void p1.start().then(null);
            void p2.start().then(null);

            const battleOutcome: string[] = [];

            // Handle what happens during simulation
            void (async (): Promise<void> => {
                let turnCount = 0;
                let turnChunk = '';
                // Loop through each chunk of info in simulation
                for await (turnChunk of streams.omniscient) {
                    battleOutcome.push(turnChunk);
                    // Count total number of turns in simulation
                    if (turnChunk.includes('|turn|')) {
                        turnCount++;
                    }
                }

                const battleOutcomeUrl = `${process.env.UI_URL}/pokemon/battleoutcome`;
                const battleOutcomeString = `Details: ${battleOutcomeUrl}`;
                await this.pokemonDbService.saveBattleOutcome(battleOutcome);

                // Find index where winner is determined
                const indexOfWin = turnChunk.lastIndexOf('|win|');
                // If someone won
                if (indexOfWin !== -1) {
                    // The line where the winner is determined
                    const winString = turnChunk.substring(indexOfWin);
                    // Parsing out the winner's name.
                    // Note: Winner string sometimes has new line e.g WinnerName \n |upkeep, use .includes() to determine
                    const winner = winString.split('|win|')[1];

                    // Handle winner outcomes
                    if (this.chatBattle.userStarted?.name && winner.includes(this.chatBattle.userStarted.name)) {
                        await this.handleBattleOutcome(
                            userStartedPokemon,
                            userAcceptedPokemon,
                            turnChunk,
                            turnCount,
                            battleOutcomeString
                        );
                    } else if (
                        this.chatBattle.userAccepted?.name &&
                        winner.includes(this.chatBattle.userAccepted.name)
                    ) {
                        await this.handleBattleOutcome(
                            userAcceptedPokemon,
                            userStartedPokemon,
                            turnChunk,
                            turnCount,
                            battleOutcomeString
                        );
                    } else {
                        this.logger.warn('Winner', winner);
                        this.logger.warn('Battle', this.chatBattle);
                        await this.botChatService.clientSay(
                            `Oof, could not determine winner. Report to the indie police`
                        );
                    }
                } else {
                    // If no one won, check for a tie (Assuming the last line contains the tie string)
                    const lastNewLineIndex = turnChunk.lastIndexOf('\n');
                    const lastLineString = turnChunk.substring(lastNewLineIndex);
                    if (lastLineString.includes('tie')) {
                        await this.pokemonDbService.updateDrawPokemon(userStartedPokemon);
                        await this.pokemonDbService.updateDrawPokemon(userAcceptedPokemon);
                        await this.botChatService.clientSay(
                            `After ${turnCount} turns...it was a tie? \n ${battleOutcomeString}`
                        );
                    } else {
                        this.logger.error(`Didn't win and didn't draw? Wtf happened: ${lastLineString}`);
                        this.logger.error(`Last Turn Details: \n ${turnChunk}`);
                        await this.botChatService.clientSay(`Didn't win and didn't draw? Wut. ${battleOutcomeString}`);
                    }
                }
                // Empty battle regardless of outcome
                if (this.chatBattle.battleTimer) clearInterval(this.chatBattle.battleTimer);
                this.chatBattle = {
                    userStarted: null,
                    userAccepted: null,
                    battleTimer: null
                };
            })().then(null);

            // Write streams but will jump to logic above
            void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
            void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
            void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);
        } catch (err) {
            this.logger.error('Error Simulating Battle', err);
            // Empty battle regardless of outcome
            if (this.chatBattle.battleTimer) clearInterval(this.chatBattle.battleTimer);
            this.chatBattle = {
                userStarted: null,
                userAccepted: null,
                battleTimer: null
            };
            await this.botChatService.clientSay(`Unknown Error. Ending Battle...`);
        }
    }

    private async acceptTeamBattle(username: string, userOauthId: string): Promise<void> {
        // Immediately set user to ensure no other battles are created while retrieving info
        this.chatTeamBattle.userAccepted = { name: username, oauthId: userOauthId };

        if (!this.chatTeamBattle.userStarted) {
            this.logger.error('This should never happen. User accepted team battle but no user started');
            return;
        }

        let userStartedTeam: PokemonTeamWithPokemon | null = null;
        let userAcceptedTeam: PokemonTeamWithPokemon | null = null;

        try {
            userStartedTeam = await this.pokemonDbService.findUniquePokemonTeam(
                this.chatTeamBattle.userStarted.oauthId
            );
            userAcceptedTeam = await this.pokemonDbService.findUniquePokemonTeam(
                this.chatTeamBattle.userAccepted.oauthId
            );
        } catch (err) {
            this.logger.error('Error Finding Pokemon Teams For Battle', err);
        }

        if (!userStartedTeam || userStartedTeam.pokemon?.length === 0) {
            this.chatTeamBattle.userAccepted = null;
            await this.botChatService.clientSay(`Something went horribly wrong. Try accepting this battle again`);
            return;
        }

        if (!userAcceptedTeam || userAcceptedTeam.pokemon?.length === 0) {
            this.chatTeamBattle.userAccepted = null;
            await this.botChatService.clientSay(
                `@${username}, you tryna fight with your bare hands? Birth a pokemon using channel points, or swap an existing one to slot 1`
            );
            return;
        }

        try {
            // Initialize teams and pokemon battle stream
            Teams.setGeneratorFactory(TeamGenerators);
            const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
            const spec = { formatid: 'gen4customgame' };

            const teamStarted = userStartedTeam.pokemon.map(pokemon => {
                return {
                    name: pokemon.name,
                    species: pokemon.name,
                    gender: pokemon.gender,
                    moves: pokemon.moves,
                    ability: pokemon.ability,
                    evs: {} as StatsTable,
                    ivs: {} as StatsTable,
                    item: pokemon.item,
                    level: pokemon.level,
                    shiny: pokemon.shiny,
                    nature: pokemon.nature
                } as PokemonSet;
            });

            const teamAccepted = userAcceptedTeam.pokemon.map(pokemon => {
                return {
                    name: pokemon.name,
                    species: pokemon.name,
                    gender: pokemon.gender,
                    moves: pokemon.moves,
                    ability: pokemon.ability,
                    evs: {} as StatsTable,
                    ivs: {} as StatsTable,
                    item: pokemon.item,
                    level: pokemon.level,
                    shiny: pokemon.shiny,
                    nature: pokemon.nature
                } as PokemonSet;
            });

            // Init players' teams
            const p1spec = { name: this.chatTeamBattle.userStarted.name, team: Teams.pack(teamStarted) };
            const p2spec = { name: this.chatTeamBattle.userAccepted.name, team: Teams.pack(teamAccepted) };

            // Init players
            const p1 = new RandomPlayerAI(streams.p1);
            const p2 = new RandomPlayerAI(streams.p2);

            // Recommended usage in Pokemon-Showdown documentation
            // A little weird but using await here will prevent the app from continuing.
            // Seems the way this library works is it initializes some things asynchronously and then
            // lets the stream handle future inputs
            void p1.start().then(null);
            void p2.start().then(null);

            const teamBattleOutcome: string[] = [];

            // Handle what happens during simulation
            void (async (): Promise<void> => {
                let turnCount = 0;
                let turnChunk = '';
                // Loop through each chunk of info in simulation
                for await (turnChunk of streams.omniscient) {
                    teamBattleOutcome.push(turnChunk);
                    // Count total number of turns in simulation
                    if (turnChunk.includes('|turn|')) {
                        turnCount++;
                    }
                }

                const battleOutcomeUrl = `${process.env.UI_URL}/pokemon/battleoutcome`;
                const battleOutcomeString = `Details: ${battleOutcomeUrl}`;
                await this.pokemonDbService.saveTeamBattleOutcome(teamBattleOutcome);

                // Find index where winner is determined
                const indexOfWin = turnChunk.lastIndexOf('|win|');
                // If someone won
                if (indexOfWin !== -1) {
                    // The line where the winner is determined
                    const winString = turnChunk.substring(indexOfWin);
                    // Parsing out the winner's name.
                    // Note: Winner string sometimes has new line e.g WinnerName \n |upkeep, use .includes() to determine
                    const winner = winString.split('|win|')[1];

                    // Handle winner outcomes
                    if (
                        this.chatTeamBattle.userStarted?.name &&
                        winner.includes(this.chatTeamBattle.userStarted.name)
                    ) {
                        await this.handleTeamBattleOutcome(
                            userStartedTeam,
                            userAcceptedTeam,
                            turnChunk,
                            turnCount,
                            battleOutcomeString
                        );
                    } else if (
                        this.chatTeamBattle.userAccepted?.name &&
                        winner.includes(this.chatTeamBattle.userAccepted.name)
                    ) {
                        await this.handleTeamBattleOutcome(
                            userAcceptedTeam,
                            userStartedTeam,
                            turnChunk,
                            turnCount,
                            battleOutcomeString
                        );
                    } else {
                        this.logger.warn('Winner', winner);
                        this.logger.warn('Battle', this.chatTeamBattle);
                        await this.botChatService.clientSay(
                            `Oof, could not determine winner. Try again next time or report to the indie police`
                        );
                    }
                } else {
                    // If no one won, check for a tie (Assuming the last line contains the tie string)
                    const lastNewLineIndex = turnChunk.lastIndexOf('\n');
                    const lastLineString = turnChunk.substring(lastNewLineIndex);
                    if (lastLineString.includes('tie')) {
                        await this.pokemonDbService.updateDrawTeam(userStartedTeam);
                        await this.pokemonDbService.updateDrawTeam(userAcceptedTeam);
                        await this.botChatService.clientSay(
                            `After ${turnCount} turns...it was a tie? ${battleOutcomeString}`
                        );
                    } else {
                        this.logger.error(`Didn't win and didn't draw? Wtf happened: ${lastLineString}`);
                        this.logger.error(`Last Turn Details: \n ${turnChunk}`);
                        await this.botChatService.clientSay(`Didn't win and didn't draw? Wut. ${battleOutcomeString}`);
                    }
                }
                // Empty battle regardless of outcome
                if (this.chatTeamBattle.battleTimer) clearInterval(this.chatTeamBattle.battleTimer);
                this.chatTeamBattle = {
                    userStarted: null,
                    userAccepted: null,
                    battleTimer: null
                };
            })().then(null);

            // Write streams but will jump to logic above
            void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
            void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
            void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);
        } catch (err) {
            this.logger.error('Error Simulating Team Battle', err);
            // Empty battle regardless of outcome
            if (this.chatTeamBattle.battleTimer) clearInterval(this.chatTeamBattle.battleTimer);
            this.chatTeamBattle = {
                userStarted: null,
                userAccepted: null,
                battleTimer: null
            };
            await this.botChatService.clientSay(`Unknown Error. Ending Team Battle...`);
        }
    }

    private async handleTeamBattleOutcome(
        winnerTeam: PokemonTeamWithPokemon,
        loserTeam: PokemonTeamWithPokemon,
        turnChunk: string,
        turnCount: number,
        battleOutcome: string
    ): Promise<void> {
        // Array of ways to win a battle - Adds a bit of flair you know
        const randomMoveList = [
            'completely obliterated',
            'absolutely brutalized',
            'thoroughly whooped',
            'downright annihilated',
            'unreservedly decimated',
            'utterly devastated',
            'totally eradicated',
            'perfectly liquidated',
            'unconditionally demolished'
        ];

        let noMoveString = '';
        let winningMoveString = '';
        // Find index of last move used to determine battle outcome
        const indexOfWinningMove = turnChunk.lastIndexOf('|move|');
        // If winning move found
        if (indexOfWinningMove !== -1) {
            const moveUnparsed = turnChunk.substring(indexOfWinningMove);
            const move = moveUnparsed.split('\n')[0];
            const winnerMove = move.split('|');
            winningMoveString = 'used ' + winnerMove[3] + ' and'; // e.g. used Ice Beam and
        } else {
            noMoveString = 'somehow'; // Use temp string since winning move not found
        }

        const randomMoveIndex = this.randomIntFromInterval(0, randomMoveList.length - 1);
        const randomMoveString = randomMoveList[randomMoveIndex];
        const moveString = noMoveString + winningMoveString; // One or the other is empty

        let winnerName;
        let loserName;
        if (this.chatTeamBattle.userAccepted?.oauthId === winnerTeam.userOauthId) {
            winnerName = this.chatTeamBattle.userAccepted.name;
            loserName = this.chatTeamBattle.userStarted?.name;
        } else {
            winnerName = this.chatTeamBattle.userStarted?.name;
            loserName = this.chatTeamBattle.userAccepted?.name;
        }

        const winnerTeamLevel = winnerTeam.pokemon?.reduce((acc, cur) => acc + cur.level, 0);
        const loserTeamLevel = loserTeam.pokemon?.reduce((acc, cur) => acc + cur.level, 0);

        // todo how embarrassing turnCount low
        // todo more informative message

        // todo ehh fix message, maybe show final move used to end enemy team
        await this.botChatService.clientSay(
            `On turn ${turnCount}, ${winnerName}'s team(+${winnerTeamLevel}) ${randomMoveString} ${loserName}'s team(+${loserTeamLevel}). ${battleOutcome}`
        );

        try {
            await this.pokemonDbService.updateLoserTeam(loserTeam);
            await this.pokemonDbService.updateWinnerTeam(winnerTeam);
        } catch (err) {
            this.logger.error('Error updating teams outcome', err);
        }
    }

    private async catchPokemon(pokemonDrop: PokemonDrop | null, oauthId: string, username: string): Promise<void> {
        if (!oauthId || !pokemonDrop) {
            this.logger.error('No oauthId/pokemon found while catching pokemon', oauthId, pokemonDrop);
            return;
        }

        if (this.pokemonChatDrop.uniqueRedeemers.has(oauthId)) {
            this.logger.warn("Can't catch pokemon more than once", oauthId);
            return;
        }

        const userAttempts = this.pokemonChatDrop.userAttemptsMap.get(oauthId);
        if (userAttempts && userAttempts >= 3) {
            await this.botChatService.clientSay(
                `@${username} you somehow failed 3 times. Try again on the next encounter`
            );
            return;
        }

        if (this.randomIntFromInterval(1, 2) <= 1) {
            this.pokemonChatDrop.userAttemptsMap.set(
                oauthId,
                (this.pokemonChatDrop.userAttemptsMap.get(oauthId) ?? 0) + 1
            );
            const pokemonRefuseString = this.pickRandomPokemonFailedCatch();
            const wasLastAttempt = this.pokemonChatDrop.userAttemptsMap.get(oauthId) === 3;
            await this.botChatService.clientSay(
                `@${username}, ${this.pokemonChatDrop.pokemonDrop?.name} ${pokemonRefuseString}. ${
                    wasLastAttempt ? 'You are out of attempts' : 'Try again...'
                }`
            );
            return;
        }

        // Assume query will pass to prevent multiple redeems
        this.pokemonChatDrop.totalCaught++;
        this.pokemonChatDrop.uniqueRedeemers.add(oauthId);

        try {
            await this.pokemonDbService.catchPokemon(pokemonDrop, oauthId, username);
            await this.botChatService.clientSay(`@${username}, success!`);
        } catch (err) {
            this.pokemonChatDrop.totalCaught--;
            this.pokemonChatDrop.uniqueRedeemers.delete(oauthId);
            if (err instanceof PokemonCatchException) {
                this.logger.error('Error Pokemon Catch -', err);
                await this.botChatService.clientSay(`@${username}, ${err.message}`);
                return;
            }
            this.logger.error(`Error Catching Pokemon For ${username}`, err);
            return;
        }
    }

    private async generatePokemonDrop(): Promise<PokemonDrop> {
        const randomPokemon = this.getRandomGen4Pokemon();
        const pokemonMoveset = await this.determinePokemonMoveset(randomPokemon.name);
        const isShiny = this.randomIntFromInterval(1, 8) <= 1;
        const currentDateUTC = new Date();
        return {
            name: randomPokemon.name,
            nameId: randomPokemon.id,
            color: randomPokemon.color,
            dexNum: randomPokemon.num,
            types: randomPokemon.types,
            shiny: isShiny,
            gender: this.determineGender(randomPokemon.name),
            moves: pokemonMoveset,
            nature: this.determineNature().name,
            ability: this.determineAbility(randomPokemon.name),
            level: 1,
            wins: 0,
            losses: 0,
            draws: 0,
            item: '',
            updatedDate: currentDateUTC,
            createdDate: currentDateUTC
        };
    }

    /**
     * Create our pokedex for a specific generation
     * Every Pokemon Has These
     * abilities, dexNumber, types, color, generation, genderRatio
     * @param gen
     */
    public getAllBaseSpeciesForGen(gen: number): string[] {
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
        // 0-492
        const randomPokeIndex = this.randomIntFromInterval(0, 492);
        return Dex.forGen(4).species.get(this.pokedex[randomPokeIndex]);
    }

    private getGen4PokemonByName(name: string): Species {
        return Dex.forGen(4).species.get(name);
    }

    private async swapPokemon(username: string, oauthId: string, slot1: number, slot2: number): Promise<void> {
        try {
            await this.pokemonDbService.swapPokemon(oauthId, slot1, slot2);
        } catch (err) {
            if (err instanceof PokemonSwapException) {
                this.logger.error(`Error Pokemon Swapping Pokemon For ${username}`, err);
                await this.botChatService.clientSay(err.message);
                return;
            }
            this.logger.error(`Error Swapping Pokemon For ${username}`, err);
            await this.botChatService.clientSay(`Swapping pokemon failed. That's not a good sign`);
        }
    }

    private async deletePokemon(username: string, oauthId: string, slot: number): Promise<void> {
        try {
            const pokemonToDelete = await this.pokemonDbService.findPokemon(oauthId, slot);
            if (pokemonToDelete) {
                const deleteCount = this.pokemonSlaughterLimitMap.get(oauthId);
                if (deleteCount && deleteCount >= 6) {
                    await this.botChatService.clientSay(
                        `@${username}, you've exceeded your limit for the day. Try again after 12AM EST`
                    );
                    this.logger.warn('User has reached max pokemon slaughter limit', oauthId);
                    return;
                }

                const team = await this.pokemonDbService.deletePokemon(oauthId, slot);
                this.pokemonSlaughterLimitMap.set(oauthId, (this.pokemonSlaughterLimitMap.get(oauthId) ?? 0) + 1);
                const slaughterApproach = this.pickRandomSlaughterApproach();
                const slaughterAction = this.pickRandomSlaughterAction();
                if (team) {
                    await this.botChatService.clientSay(
                        `@${username} ${slaughterApproach} ${pokemonToDelete.name} ${slaughterAction}`
                    );
                } else {
                    await this.botChatService.clientSay(`@${username}, something went wrong. Try again later`);
                }
            } else {
                await this.botChatService.clientSay(`You have no pokemon in slot ${slot}`);
            }
        } catch (err) {
            await this.botChatService.clientSay(
                `Something went horribly wrong deleting a pokemon. Complain to someone`
            );
        }
    }

    public async redeemPokemonRoar(event: EventSubChannelRedemptionAddEvent | PokemonRoarChatEvent): Promise<void> {
        let username, oauthId;
        if (event instanceof EventSubChannelRedemptionAddEvent) {
            username = event.userDisplayName.trim().toLowerCase();
            oauthId = event.userId;
        } else {
            username = event.username;
            oauthId = event.oauthId;
        }

        if (!oauthId) {
            this.logger.error('No oauthId found while roaring random pokemon', username);
            await this.botChatService.clientSay(`@${username} failed to roar. You have been refunded`);
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }

        let userStarterPokemon;
        try {
            userStarterPokemon = await this.pokemonDbService.findStarterPokemon(oauthId);
            if (!userStarterPokemon) {
                await this.botChatService.clientSay(`@${username} you have no starter pokemon. You have been refunded`);
                if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
                return;
            }
            await this.adminUiGateway.pokemonRoar(userStarterPokemon, event);
        } catch (err) {
            this.logger.error('Error Finding Starter Pokemon For Roar', err);
            await this.botChatService.clientSay(
                `@${username}: Unable to find a pokemon in Slot 1. You have been refunded`
            );
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }
    }

    public async redeemPokemonCreateFIXTODOREMOVE(event: TODOREMOVE): Promise<void> {
        const username = event.username;
        const oauthId = event.oauthId;
        const slot = event.slot;
        const pokemonLevel = event.pokemonLevel;

        if (!oauthId) {
            this.logger.error('No oauthId found while creating random pokemon', username);
            await this.botChatService.clientSay(`@${username} failed to change pokemon. You have been refunded`);
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }

        const randomPokemon = this.getRandomGen4Pokemon();
        const pokemonMoveset = await this.determinePokemonMoveset(randomPokemon.name);

        if (pokemonMoveset.length === 0) {
            this.logger.error(`Pokemon found with no moves: ${randomPokemon.name}`);
            await this.botChatService.clientSay(
                `@${username}, your pokemon ${randomPokemon.name} has no moves. You have been refunded`
            );
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }
        const isShiny = this.isShiny();

        const currentDateUTC = new Date();
        const userPokemon: PokemonDefault = {
            name: randomPokemon.name,
            color: randomPokemon.color,
            dexNum: randomPokemon.num,
            types: randomPokemon.types,
            slot: slot,
            nameId: randomPokemon.id,
            shiny: isShiny,
            gender: this.determineGender(randomPokemon.name),
            moves: pokemonMoveset,
            nature: this.determineNature().name,
            ability: this.determineAbility(randomPokemon.name),
            level: 1,
            wins: 0,
            losses: 0,
            draws: 0,
            item: '',
            updatedDate: currentDateUTC,
            createdDate: currentDateUTC
        };

        // Can't create pokemon with user
        const userCreateDTO = {
            oauthId,
            displayName: username
        };
        let team;
        try {
            team = await this.pokemonDbService.redeemPokemon(userPokemon, userCreateDTO);
        } catch (err) {
            if (err instanceof PokemonRedeemException) {
                this.logger.error(err);
                await this.botChatService.clientSay(`${err.message}. You have been refunded`);
                if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
                return;
            }
            this.logger.error(
                `1: Failed to upsert pokemon for user: ${username}: ${randomPokemon.name} at slot: ${slot}`,
                err
            );
            await this.botChatService.clientSay(
                `@${username} failed to update/create pokemon in slot ${slot}. You have been refunded`
            );
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }
        if (!team) {
            this.logger.error(
                `2: Failed to upsert pokemon for user: ${username}: ${randomPokemon.name} at slot: ${slot}`
            );
            await this.botChatService.clientSay(
                `@${username} failed to update/create pokemon in slot ${slot}. You have been refunded`
            );
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');

            return;
        }

        const randomRoar = this.pickRandomRoar();
        await this.botChatService.clientSay(
            `/me @${username}'s Level 1 ${isShiny ? 'PogChamp ****SHINY**** PogChamp' : ''} ${
                randomPokemon.name
            } roared ${randomRoar}`
        );
    }

    // Changes starter pokemon
    public async redeemPokemonCreate(event: EventSubChannelRedemptionAddEvent | PokemonCreateChatEvent): Promise<void> {
        let username, oauthId, slot;
        if (event instanceof EventSubChannelRedemptionAddEvent) {
            username = event.userDisplayName.trim().toLowerCase();
            const pokemonSlotNum = parseInt(event.input);
            if (isNaN(pokemonSlotNum) || pokemonSlotNum < 1 || pokemonSlotNum > 6) {
                this.botChatService.clientSay(
                    `@${username}, please enter a slot number between 1 and 6. You have been refunded`
                );
                await event.updateStatus('CANCELED');
                return;
            }
            oauthId = event.userId;
            slot = pokemonSlotNum;
        } else {
            username = event.username;
            oauthId = event.oauthId;
            slot = event.slot;
        }

        if (!oauthId) {
            this.logger.error('No oauthId found while creating random pokemon', username);
            await this.botChatService.clientSay(`@${username} failed to change pokemon. You have been refunded`);
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }

        const randomPokemon = this.getRandomGen4Pokemon();
        const pokemonMoveset = await this.determinePokemonMoveset(randomPokemon.name);

        if (pokemonMoveset.length === 0) {
            this.logger.error(`Pokemon found with no moves: ${randomPokemon.name}`);
            await this.botChatService.clientSay(
                `@${username}, your pokemon ${randomPokemon.name} has no moves. You have been refunded`
            );
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }
        const isShiny = this.isShiny();

        const currentDateUTC = new Date();
        const userPokemon: PokemonDefault = {
            name: randomPokemon.name,
            color: randomPokemon.color,
            dexNum: randomPokemon.num,
            types: randomPokemon.types,
            slot: slot,
            nameId: randomPokemon.id,
            shiny: isShiny,
            gender: this.determineGender(randomPokemon.name),
            moves: pokemonMoveset,
            nature: this.determineNature().name,
            ability: this.determineAbility(randomPokemon.name),
            level: 1,
            wins: 0,
            losses: 0,
            draws: 0,
            item: '',
            updatedDate: currentDateUTC,
            createdDate: currentDateUTC
        };

        // Can't create pokemon with user
        const userCreateDTO = {
            oauthId,
            displayName: username
        };
        let team;
        try {
            team = await this.pokemonDbService.redeemPokemon(userPokemon, userCreateDTO);
        } catch (err) {
            if (err instanceof PokemonRedeemException) {
                this.logger.error(err);
                await this.botChatService.clientSay(`${err.message}. You have been refunded`);
                if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
                return;
            }
            this.logger.error(
                `1: Failed to upsert pokemon for user: ${username}: ${randomPokemon.name} at slot: ${slot}`,
                err
            );
            await this.botChatService.clientSay(
                `@${username} failed to update/create pokemon in slot ${slot}. You have been refunded`
            );
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            return;
        }
        if (!team) {
            this.logger.error(
                `2: Failed to upsert pokemon for user: ${username}: ${randomPokemon.name} at slot: ${slot}`
            );
            await this.botChatService.clientSay(
                `@${username} failed to update/create pokemon in slot ${slot}. You have been refunded`
            );
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');

            return;
        }

        const randomRoar = this.pickRandomRoar();
        await this.botChatService.clientSay(
            `/me @${username}'s Level 1 ${isShiny ? 'PogChamp ****SHINY**** PogChamp' : ''} ${
                randomPokemon.name
            } roared ${randomRoar}`
        );
    }

    /**
     * Pick a random roar from array
     * @private
     */
    private pickRandomRoar(): string {
        const randomRoarIndex = this.randomIntFromInterval(0, this.pokeRoarActionList.length - 1);
        return this.pokeRoarActionList[randomRoarIndex];
    }

    private pickRandomSlaughterApproach(): string {
        const randomMessageIndex = this.randomIntFromInterval(0, pokeSlaughterApproachList.length - 1);
        return pokeSlaughterApproachList[randomMessageIndex];
    }

    private pickRandomSlaughterAction(): string {
        const randomMessageIndex = this.randomIntFromInterval(0, pokeSlaughterActionList.length - 1);
        return pokeSlaughterActionList[randomMessageIndex];
    }

    private pickRandomPokemonFailedCatch(): string {
        const randomMessageIndex = this.randomIntFromInterval(0, pokeFailedCatchList.length - 1);
        return pokeFailedCatchList[randomMessageIndex];
    }

    public onModuleDestroy(): any {
        this.commandSubscription.unsubscribe();
    }
}
