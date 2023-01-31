import { appenv } from '../../config/appenv.js';
import { BattleStreams, Dex, PokemonSet, RandomPlayerAI, StatsTable, Teams } from '@pkmn/sim';
import { TeamGenerators } from '@pkmn/randoms';
import mongoose, { QueryOptions } from 'mongoose';
import { PokemonInterface } from '../../api/models/Pokemon.js';
import { pokedexArr, pokeRoarActions } from './pokemon/pokeInfo.js';
import { OutgoingEvents } from '../types/EventsInterface.js';
import { twurpleInstance } from '../TwurpleInstance.js';
import { expressSocket } from '../../ws/ExpressSocket.js';
import { Species } from '@pkmn/sim/build/sim/dex-species';
import { logger } from '../../utils/LoggerUtil.js';

/**
 * Status of pokemon battle
 */
// enum BattleStatus {
//     PENDING = 'PENDING',
//     STARTED = 'STARTED',
//     FINISHED = 'FINISHED'
// }

/**
 * Stored player info
 */
interface BattleUser {
    name: string;
    id: string;
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

/**
 * Handles all pokemon related commands
 */
export class Pokemon {
    /**
     * Twurple model from db
     * @private
     */
    private _dbPokemon = mongoose.model<PokemonInterface>('pokemon');

    /**
     * Twitch streamer's channel name
     * @private
     */
    private readonly _channel: string = appenv.TWITCH_CHANNEL_LISTEN;

    /**
     * Array of all valid pokemon names
     * @private
     */
    private readonly _pokedex: string[] = pokedexArr;

    /**
     * Array of quotes pokemon use when they roar
     * @private
     */
    private _pokeRoarActionList: string[] = pokeRoarActions;

    /**
     * Stores 2-player battle info
     * @private
     */
    private _battle: PokemonBattle = {};

    /**
     * Return a random pokemon out of the 386 available
     * @private
     */
    private _getRandomPokemon(): Species {
        // Random int from 0 - 385
        const randomPokeIndex = Math.floor(Math.random() * 385);
        // Convert to pokemon species object to ensure pokemon is usable
        return Dex.forGen(3).species.get(this._pokedex[randomPokeIndex]);
    }

    /**
     * Determine the moves to assign a pokemon based on what's available
     * @param pokemon
     * @private
     */
    private _determinePokemonMoves(pokemon: Species): string[] {
        let pokemonMoves: string[] = [];
        // Get moves if they are available
        if (pokemon && pokemon.randomBattleMoves) {
            // Convert readonly ID type into string array to satisfy PokemonInterface
            pokemon.randomBattleMoves.forEach((move, idx) => {
                pokemonMoves[idx] = move;
            });
        } else {
            // Otherwise use a fallback moveset
            pokemonMoves = ['hyperbeam', 'splash'];
        }

        return pokemonMoves;
    }

    /**
     * Add or update a user's pokemon and log results
     * @param userPokemon
     * @param filter
     * @param queryOptions
     * @private
     */
    private async _updateOrAddUserPokemon(
        userPokemon: PokemonInterface,
        filter: Record<string, unknown>,
        queryOptions?: QueryOptions
    ): Promise<PokemonInterface | null> {
        try {
            // Replace user's pokemon in db or create new document if not found
            return await this._dbPokemon.findOneAndUpdate(filter, userPokemon, queryOptions);
        } catch (err) {
            logger.error(`Couldn't get @${userPokemon.twitchName}'s updated Pokemon`);
            logger.error(err);
            return null;
        }
    }

    /**
     * Add/update a pokemon for user based on their name. Can only be used by user with elevated permissions
     * @param username
     * @param pokemonName
     * @param level
     * @param wins
     * @param loss
     * @private
     */
    private async _fixPokemon(
        username: string,
        pokemonName: string,
        level: string,
        wins: string,
        loss: string
    ): Promise<void> {
        const userAPI = await twurpleInstance.botApiClient.users.getUserByName(username);
        const storedUserId = userAPI?.id;

        // If user id found, create a pokemon for them
        if (storedUserId) {
            const pokemon = Dex.forGen(3).species.get(pokemonName); // Get pokemon stats from name
            const pokemonMoves: string[] = this._determinePokemonMoves(pokemon);

            const userPokemon = {
                twitchName: username,
                pokemonName: pokemon.name,
                pokemonLevel: parseInt(level),
                pokemonMoves: pokemonMoves,
                wins: parseInt(wins),
                losses: parseInt(loss),
                uid: storedUserId
            };

            // upsert will create a doc if not found, new will ensure newPokeDoc contains the newest db obj
            const options: QueryOptions = { upsert: true, new: true };
            const filter = { uid: userPokemon.uid };
            await this._updateOrAddUserPokemon(userPokemon, filter, options);
        } else {
            await twurpleInstance.botChatClient?.say(this._channel, `Couldn't find user id for @${username}`);
        }
    }

    /**
     * Pick a random roar from array
     * @private
     */
    private _pickRandomRoar(): string {
        const randomRoadIndex = Math.floor(Math.random() * (this._pokeRoarActionList.length - 1));
        return this._pokeRoarActionList[randomRoadIndex];
    }

    /**
     * Create or replace a pokemon with base stats for a given user
     * @param username
     * @param userId
     */
    public async createOrReplacePokemon(username: string, userId: string): Promise<void | undefined> {
        const failureMessage = `@${username} failed to change pokemon. The refund police will be notified`;

        const randomPokemon = this._getRandomPokemon();
        const pokemonMoves: string[] = this._determinePokemonMoves(randomPokemon);
        if (userId) {
            const userRandomPokemon: PokemonInterface = {
                twitchName: username,
                pokemonName: randomPokemon.name,
                pokemonLevel: 1,
                pokemonMoves: pokemonMoves,
                wins: 0,
                losses: 0,
                uid: userId
            };

            const options: QueryOptions = { upsert: true, new: true };
            const filter = { uid: userRandomPokemon.uid };
            const newPokeDoc = await this._updateOrAddUserPokemon(userRandomPokemon, filter, options);

            // If updated document retrieved from db
            if (newPokeDoc) {
                const randomRoar = this._pickRandomRoar();
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `/me @${username}'s Level 1 ${newPokeDoc.pokemonName} roared ${randomRoar}`
                );
                // If the new pokemon has no moves, notify user
                if (!randomPokemon.randomBattleMoves) {
                    await twurpleInstance.botChatClient?.say(
                        this._channel,
                        `@${username}, your pokemon can only use 'Hyperbeam' & 'Splash'... Details: https://imgur.com/a/2u62OUh`
                    );
                }
            }
        } else {
            logger.error(`No user id for @${username} when creating pokemon`);
            await twurpleInstance.botChatClient?.say(this._channel, failureMessage);
        }
    }

    /**
     * Level up given user's pokemon in db
     * @param username
     * @param userId
     */
    public async levelUpUserPokemon(username: string, userId: string): Promise<void> {
        if (userId) {
            let userPokeDoc: PokemonInterface | null = null;
            try {
                const filter = { uid: userId };
                const options: QueryOptions = { new: true };
                // Level up winner's pokemon
                userPokeDoc = await this._dbPokemon.findOneAndUpdate(filter, { $inc: { pokemonLevel: 1 } }, options);
            } catch (err) {
                logger.error(`Couldn't get @${username}'s updated Pokemon`);
                logger.error(err);
            }

            // If level up updated and retrieved from DB
            if (userPokeDoc) {
                // Note: The response is not the updated document for 'findOneAndUpdate'
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `@${username}'s ${userPokeDoc.pokemonName} leveled up to ${userPokeDoc.pokemonLevel}!`
                );
            } else {
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `@${username}, you either don't have a pokemon, or something exploded. The refund police will be notified.`
                );
            }
        } else {
            logger.error(`No user id for @${username} when leveling pokemon`);
        }
    }

    /**
     * Make a given user's pokemon roar in chat and send sound trigger event through ws
     * @param username
     * @param userId
     */
    public async roarUserPokemon(username: string, userId: string): Promise<void> {
        if (userId) {
            let userPokeDoc: PokemonInterface | null = null;
            try {
                userPokeDoc = await this._dbPokemon.findOne({ uid: userId });
            } catch (err) {
                logger.error(`Couldn't get @${username}'s updated Pokemon`);
                logger.error(err);
            }

            if (userPokeDoc) {
                const randomRoar = this._pickRandomRoar();
                expressSocket.wsInstance.getWss().clients.forEach(localClient => {
                    // TODO: if client === trama, although its authenticated anyways
                    logger.info('Send Roar Websocket');
                    localClient.send(
                        JSON.stringify({ event: OutgoingEvents.POKEMON_ROAR, pokemonName: userPokeDoc?.pokemonName })
                    );
                });
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `/me @${username}'s Level ${userPokeDoc.pokemonLevel} ${userPokeDoc.pokemonName} roared ${randomRoar}`
                );
            } else {
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `@${username}, you either don't have a pokemon redeemed with channel points, or something exploded. Git gud`
                );
            }
        } else {
            logger.error(`No user id for @${username} when pokemon roars`);
        }
    }

    /**
     * Create a battle request and check user who started the battle has a pokemon
     * @param username
     * @param userId
     * @private
     */
    private async _createBattle(username: string, userId: string): Promise<void> {
        // Immediately set user to ensure no other battles are created while retrieving info
        this._battle.userStarted = { name: username, id: userId };

        let userPokeDoc;
        try {
            userPokeDoc = await this._dbPokemon.findOne({ uid: userId });
        } catch (err) {
            logger.error(`Can't retrieve Pokemon for @${username}`);
            logger.error(err);
        }

        // If user has pokemon in DB
        if (userPokeDoc) {
            void twurpleInstance.botChatClient?.say(
                this._channel,
                `@${username}'s Level ${userPokeDoc.pokemonLevel} ${userPokeDoc.pokemonName} wants to battle! 
                You have 1 minute to accept their challenge, by using the command "!pokemon battle"`
            );
            this._battle.battleTimer = setInterval(() => {
                // If timer not cleared yet, then end the pending battle
                if (this._battle.battleTimer) {
                    if (this._battle.userStarted) {
                        void twurpleInstance.botChatClient?.say(
                            this._channel,
                            `Ending pending pokemon battle for @${this._battle.userStarted?.name}. You're just too intimidating man`
                        );
                    }
                    clearInterval(this._battle.battleTimer);
                    this._battle = {};
                }
            }, 1000 * 60);
        } else {
            this._battle.userStarted = undefined;
            await twurpleInstance.botChatClient?.say(
                this._channel,
                `@${username}, you either don't have a pokemon, or something exploded. As they say, git gud`
            );
        }
    }

    /**
     * Handle battle simulation 2nd player is confirmed
     * @param username
     * @param userId
     */
    private async _acceptBattle(username: string, userId: string): Promise<void> {
        // Immediately set user to ensure no other battles are created while retrieving info
        this._battle.userAccepted = { name: username, id: userId };

        if (this._battle.userStarted) {
            let userStartedPokeDoc, userAcceptedPokeDoc;
            try {
                const options: QueryOptions = { new: true };
                // Find user by id, and update the username in case username has changed since they last used pokemon
                userStartedPokeDoc = await this._dbPokemon.findOneAndUpdate(
                    { uid: this._battle.userStarted.id },
                    { twitchName: this._battle.userStarted.name },
                    options
                );
                userAcceptedPokeDoc = await this._dbPokemon.findOneAndUpdate(
                    { uid: this._battle.userAccepted.id },
                    { twitchName: this._battle.userAccepted.name },
                    options
                );
            } catch (err) {
                logger.error(`Error Fetching Pokemon for battle:`, this._battle);
                logger.error(err);
            }

            if (!userStartedPokeDoc) {
                this._battle.userAccepted = undefined;
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `Something went horribly wrong. Try accepting this battle again...`
                );
            }

            if (!userAcceptedPokeDoc) {
                this._battle.userAccepted = undefined;
                await twurpleInstance.botChatClient?.say(
                    this._channel,
                    `@${username}, you tryna fight with your bare hands? Get a pokemon first using channel points`
                );
            }

            if (userStartedPokeDoc && userAcceptedPokeDoc && this._battle.userStarted && this._battle.userAccepted) {
                try {
                    // Initialize teams and pokemon battle stream
                    Teams.setGeneratorFactory(TeamGenerators);
                    const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
                    const spec = { formatid: 'gen3customgame' };

                    const teamStarted = [
                        {
                            name: userStartedPokeDoc.pokemonName,
                            species: userStartedPokeDoc.pokemonName,
                            gender: '',
                            moves: userStartedPokeDoc.pokemonMoves,
                            ability: '',
                            evs: {} as StatsTable,
                            ivs: {} as StatsTable,
                            item: '',
                            level: userStartedPokeDoc.pokemonLevel,
                            shiny: false,
                            nature: ''
                        } as PokemonSet
                    ];

                    const teamAccepted = [
                        {
                            name: userAcceptedPokeDoc.pokemonName,
                            species: userAcceptedPokeDoc.pokemonName,
                            gender: '',
                            moves: userAcceptedPokeDoc.pokemonMoves,
                            ability: '',
                            evs: {} as StatsTable,
                            ivs: {} as StatsTable,
                            item: '',
                            level: userAcceptedPokeDoc.pokemonLevel,
                            shiny: false,
                            nature: ''
                        } as PokemonSet
                    ];

                    // Init players' teams
                    const p1spec = { name: this._battle.userStarted.name, team: Teams.pack(teamStarted) };
                    const p2spec = { name: this._battle.userAccepted.name, team: Teams.pack(teamAccepted) };

                    // Init players
                    const p1 = new RandomPlayerAI(streams.p1);
                    const p2 = new RandomPlayerAI(streams.p2);

                    // Recommended usage in Pokemon-Showdown documentation
                    // A little weird but using await here will prevent the app from continuing.
                    // Seems the way this library works is it initializes some things asynchronously and then
                    // lets the stream handle future inputs
                    void p1.start().then(null);
                    void p2.start().then(null);

                    // Handle what happens during simulation
                    void (async (): Promise<void> => {
                        let turnCount = 0;
                        let turnChunk = '';
                        // Loop through each chunk of info in simulation
                        for await (turnChunk of streams.omniscient) {
                            // Count total number of turns in simulation
                            if (turnChunk.includes('|turn|')) {
                                turnCount++;
                            }
                        }

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
                            if (this._battle.userStarted?.name && winner.includes(this._battle.userStarted.name)) {
                                await this._handleBattleOutcome(
                                    userStartedPokeDoc,
                                    userAcceptedPokeDoc,
                                    turnChunk,
                                    turnCount
                                );
                            } else if (
                                this._battle.userAccepted?.name &&
                                winner.includes(this._battle.userAccepted.name)
                            ) {
                                await this._handleBattleOutcome(
                                    userAcceptedPokeDoc,
                                    userStartedPokeDoc,
                                    turnChunk,
                                    turnCount
                                );
                            } else {
                                logger.warn('Winner', winner);
                                logger.warn('Battle', this._battle);
                                await twurpleInstance.botChatClient?.say(
                                    this._channel,
                                    `Oof, could not determine winner. Try again next time or report to the indie police`
                                );
                            }
                        } else {
                            // If no one won, check for a tie (Assuming the last line contains the tie string)
                            const lastNewLineIndex = turnChunk.lastIndexOf('\n');
                            const lastLineString = turnChunk.substring(lastNewLineIndex);
                            if (lastLineString.includes('tie')) {
                                await twurpleInstance.botChatClient?.say(
                                    this._channel,
                                    `After ${turnCount} turns...it was a tie?`
                                );
                                await twurpleInstance.botChatClient?.say(
                                    this._channel,
                                    `Last Turn Details: \n ${turnChunk}`
                                );
                            } else {
                                logger.info(`Didn't win and didn't draw? Wtf happened: ${lastLineString}`);
                                logger.info(`Last Turn Details: \n ${turnChunk}`);
                                await twurpleInstance.botChatClient?.say(
                                    this._channel,
                                    `Didn't win and didn't draw? Wtf happened: ${lastLineString}`
                                );
                            }
                        }
                        // Empty battle regardless of outcome
                        if (this._battle.battleTimer) clearInterval(this._battle.battleTimer);
                        this._battle = {};
                    })().then(null);

                    // Write streams but will jump to logic above
                    void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
                    void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
                    void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);
                } catch (err) {
                    // Empty battle regardless of outcome
                    if (this._battle.battleTimer) clearInterval(this._battle.battleTimer);
                    this._battle = {};
                    logger.error('Error During Pokemon Battle');
                    logger.error(err);
                    await twurpleInstance.botChatClient?.say(this._channel, `Unknown Error. Ending Battle...`);
                }
            }
        }
    }

    /**
     * Handle the outcome of the battle and reward the winner with a level up if applicable
     * @param winnerPokeDoc user from pokemon DB who won
     * @param loserPokeDoc user from pokemon DB who lost
     * @param turnChunk the last chunk of info from a simulation
     * @param turnCount the number of turns in the simulation
     * @private
     */
    private async _handleBattleOutcome(
        winnerPokeDoc: PokemonInterface,
        loserPokeDoc: PokemonInterface,
        turnChunk: string,
        turnCount: number
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
            noMoveString = 'mysteriously'; // Use temp string since winning move not found
        }

        const randomMoveIndex = Math.floor(Math.random() * (randomMoveList.length - 1));
        const randomMoveString = randomMoveList[randomMoveIndex];
        const moveString = noMoveString + winningMoveString; // One or the other is empty

        // e.g. On turn 6, Bill's Level 6 Charizard totally eradicated Elia's Level 3 Bulbasaur
        await twurpleInstance.botChatClient?.say(
            this._channel,
            `On turn ${turnCount}, ${winnerPokeDoc.twitchName}'s Level ${winnerPokeDoc.pokemonLevel} 
            ${winnerPokeDoc.pokemonName} ${moveString} ${randomMoveString} ${loserPokeDoc.twitchName}'s Level 
            ${loserPokeDoc.pokemonLevel} ${loserPokeDoc.pokemonName}`
        );

        // Determine if the winner should level up. Winner has to be <= 20 levels higher than opponents' level
        let levelUpWinner = true;
        if (winnerPokeDoc.pokemonLevel - loserPokeDoc.pokemonLevel > 20) {
            levelUpWinner = false;
            await twurpleInstance.botChatClient?.say(
                this._channel,
                `${winnerPokeDoc.twitchName}, your pokemon is over 20 levels higher than your opponent's. 
                You ain't leveling up from this one`
            );
        }

        // Level up winner if it applies
        if (levelUpWinner) {
            await this.levelUpUserPokemon(winnerPokeDoc.twitchName, winnerPokeDoc.uid);
        }
    }

    /**
     * Handle pokemon related commands
     * @param username
     * @param args
     * @param userId
     */
    public async handleMessage(username: string, args: string[], userId: string): Promise<void> {
        switch (args[0]) {
            case 'battle':
                // If no user started, create battle
                if (!this._battle.userStarted) await this._createBattle(username, userId);
                // If same user tried to start battle
                else if (this._battle.userStarted.name === username)
                    void twurpleInstance.botChatClient?.say(this._channel, `You can't battle yourself, @${username}`);
                // If second unique user initiates battle
                else if (!this._battle.userAccepted) await this._acceptBattle(username, userId);
                // If we somehow entered this state
                else
                    void twurpleInstance.botChatClient?.say(
                        this._channel,
                        `How unlucky, @${username}. Things might have gotten spammy. Try again later`
                    );
                break;
            // Note: Since we cannot redeem channel points on dev channel, the below cases are for ensuring it works on prod
            case 'roar':
                // Used to fix people's pokemon
                if (username.toLowerCase() === 'lebrotherbill') {
                    try {
                        await this.roarUserPokemon(args[1].trim().toLowerCase(), args[2]);
                    } catch (err) {
                        logger.error('Error Brother Roar');
                        logger.error(err);
                    }
                }
                break;
            case 'fix':
                if (username.toLowerCase() === 'lebrotherbill') {
                    try {
                        await this._fixPokemon(args[1].trim().toLowerCase(), args[2], args[3], args[4], args[5]);
                    } catch (err) {
                        logger.error('Error Brother Pokemon Fix');
                        logger.error(err);
                    }
                }
                break;
            default:
                await twurpleInstance.botChatClient?.say(this._channel, `Pokemon Info: https://imgur.com/a/2u62OUh`);
                break;
        }
    }
}
