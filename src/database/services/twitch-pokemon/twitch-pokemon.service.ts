import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma, Pokemon, PokemonTeam, PokemonBattleOutcome, PokemonTeamBattleOutcome } from '@prisma/client';
import PokemonTeamUpsertArgs = Prisma.PokemonTeamUpsertArgs;
import PokemonTeamCreateArgs = Prisma.PokemonTeamCreateArgs;
import PokemonCreateArgs = Prisma.PokemonCreateArgs;
import PokemonTeamUpdateArgs = Prisma.PokemonTeamUpdateArgs;
import TwitchUserCreateArgs = Prisma.TwitchUserCreateArgs;
import { PokemonDefault, PokemonDrop } from 'src/twitch/services/pokemon/pokemon.service';
import PokemonUpdateManyArgs = Prisma.PokemonUpdateManyArgs;
import BatchPayload = Prisma.BatchPayload;
import PokemonUpdateArgs = Prisma.PokemonUpdateArgs;
import PokemonGroupByArgs = Prisma.PokemonGroupByArgs;
import TwitchUserFindManyArgs = Prisma.TwitchUserFindManyArgs;
import PokemonFindManyArgs = Prisma.PokemonFindManyArgs;

export class PokemonRedeemException extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class PokemonSwapException extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class PokemonCatchException extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class PokemonLevelException extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

// 1: Define a type that includes the relation to `RegisteredUser`
const userWithPokemonTeam = Prisma.validator<Prisma.TwitchUserArgs>()({
    include: { pokemonTeam: { include: { pokemon: true } } }
});

// 2: This type will include a user and their registeredUser
export type UserWithPokemonTeam = Prisma.TwitchUserGetPayload<typeof userWithPokemonTeam>;

const pokemonTeamWithPokemon = Prisma.validator<Prisma.PokemonTeamArgs>()({
    include: { pokemon: true }
});
export type PokemonTeamWithPokemon = Prisma.PokemonTeamGetPayload<typeof pokemonTeamWithPokemon>;

@Injectable()
export class TwitchPokemonService {
    private readonly logger = new Logger(TwitchPokemonService.name);

    constructor(private readonly prisma: PrismaService) {}

    async upsertPokemon(
        where: Prisma.PokemonWhereUniqueInput,
        update: Prisma.PokemonUpdateInput,
        create: Prisma.PokemonCreateInput
    ): Promise<Pokemon> {
        return this.prisma.pokemon.upsert({
            where,
            update,
            create
        });
    }

    async findUniquePokemonTeam(oauthId: string): Promise<PokemonTeamWithPokemon | null> {
        return this.prisma.pokemonTeam.findUnique({
            where: { userOauthId: oauthId },
            include: { pokemon: true }
        });
    }

    async findStarterPokemon(oauthId: string): Promise<Pokemon | null> {
        return this.prisma.pokemon.findFirst({
            where: {
                userOauthId: oauthId,
                slot: 1
            }
        });
    }

    async updateDrawPokemon(drawPokemon: Pokemon): Promise<Pokemon | null> {
        const query: PokemonUpdateArgs = {
            where: { id: drawPokemon.id },
            data: { draws: { increment: 1 } }
        };
        return this.prisma.pokemon.update(query);
    }

    async updateDrawTeam(drawTeam: PokemonTeam): Promise<PokemonTeam | null> {
        const query: PokemonTeamUpdateArgs = {
            where: { id: drawTeam.id },
            data: { pokemon: { updateMany: { where: {}, data: { draws: { increment: 1 } } } } }
        };
        return this.prisma.pokemonTeam.update(query);
    }

    async updateWinnerTeam(winnerTeam: PokemonTeam): Promise<PokemonTeam | null> {
        const query: PokemonTeamUpdateArgs = {
            where: { id: winnerTeam.id },
            data: { pokemon: { updateMany: { where: {}, data: { wins: { increment: 1 } } } } }
        };
        return this.prisma.pokemonTeam.update(query);
    }

    async updateLoserTeam(loserTeam: PokemonTeam): Promise<PokemonTeam | null> {
        const query: PokemonTeamUpdateArgs = {
            where: { id: loserTeam.id },
            data: { pokemon: { updateMany: { where: {}, data: { losses: { increment: 1 } } } } }
        };
        return this.prisma.pokemonTeam.update(query);
    }

    async updateWinnerPokemon(winnerPokemon: Pokemon, levelIncrease: number): Promise<Pokemon | null> {
        const query: PokemonUpdateArgs = {
            where: { id: winnerPokemon.id },
            data: { level: { increment: levelIncrease }, wins: { increment: 1 } }
        };
        return this.prisma.pokemon.update(query);
    }

    async updateLoserPokemon(loserPokemon: Pokemon): Promise<Pokemon | null> {
        const query: PokemonUpdateArgs = {
            where: { id: loserPokemon.id },
            data: { losses: { increment: 1 } }
        };
        return this.prisma.pokemon.update(query);
    }

    async saveBattleOutcome(outcome: string[]): Promise<PokemonBattleOutcome | null> {
        const currentOutcome = await this.prisma.pokemonBattleOutcome.findFirst();
        if (currentOutcome) {
            // update outcome
            const query: Prisma.PokemonBattleOutcomeUpdateArgs = {
                where: { id: currentOutcome.id },
                data: {
                    outcome
                }
            };
            return this.prisma.pokemonBattleOutcome.update(query);
        }

        return this.prisma.pokemonBattleOutcome.create({
            data: { outcome }
        });
    }

    async saveTeamBattleOutcome(outcome: string[]): Promise<PokemonTeamBattleOutcome | null> {
        const currentOutcome = await this.prisma.pokemonTeamBattleOutcome.findFirst();
        if (currentOutcome) {
            // update outcome
            const query: Prisma.PokemonTeamBattleOutcomeUpdateArgs = {
                where: { id: currentOutcome.id },
                data: {
                    outcome
                }
            };
            return this.prisma.pokemonTeamBattleOutcome.update(query);
        }

        return this.prisma.pokemonTeamBattleOutcome.create({
            data: { outcome }
        });
    }

    async getBattleOutcome(): Promise<PokemonBattleOutcome | null> {
        return this.prisma.pokemonBattleOutcome.findFirst();
    }

    async getTeamBattleOutcome(): Promise<PokemonTeamBattleOutcome | null> {
        return this.prisma.pokemonTeamBattleOutcome.findFirst();
    }

    async getTopPokemonLeaderboard(): Promise<any> {
        const query: PokemonFindManyArgs = {
            take: 30,
            select: {
                level: true,
                name: true,
                twitchUser: { select: { displayName: true } }
            },
            where: {},
            orderBy: {
                level: 'desc'
            }
        };

        return this.prisma.pokemon.findMany(query);
    }

    async levelUpStarter(oauthId: string): Promise<Pokemon | null> {
        const starter = await this.findStarterPokemon(oauthId);
        if (!starter) {
            throw new PokemonLevelException('you have no starter pokemon in slot 1');
        }
        const query: PokemonUpdateArgs = {
            where: { id: starter.id },
            data: { level: { increment: 1 } }
        };
        return this.prisma.pokemon.update(query);
    }

    async getTeam(oauthId: string): Promise<PokemonTeamWithPokemon | null> {
        return (await this.prisma.pokemonTeam.findUnique({
            include: { pokemon: true },
            where: { userOauthId: oauthId }
        })) as PokemonTeamWithPokemon;
    }

    async redeemPokemon(
        redemption: PokemonDefault,
        userCreateDTO: { oauthId: string; displayName: string }
    ): Promise<PokemonTeamWithPokemon | null | undefined> {
        if (redemption.slot < 1 || redemption.slot > 6) {
            throw new PokemonRedeemException('Slot number must be between 1 & 6');
        }

        const { oauthId, displayName } = userCreateDTO;
        return this.prisma.$transaction(
            async tx => {
                let user = (await tx.twitchUser.findUnique({
                    where: { oauthId: oauthId },
                    include: { pokemonTeam: { include: { pokemon: true } } }
                })) as UserWithPokemonTeam;

                // If no user
                if (!user) {
                    // Make sure user is trying to create a starter pokemon before any other slot
                    if (redemption.slot !== 1) {
                        throw new PokemonRedeemException('You must create a starter pokemon in slot 1 first');
                    }
                    const query: TwitchUserCreateArgs = {
                        data: {
                            oauthId,
                            displayName,
                            pokemonTeam: { create: { pokemon: { create: { ...redemption, userOauthId: oauthId } } } }
                        },
                        include: { pokemonTeam: { include: { pokemon: true } } }
                    };
                    // Create user with pokemon team
                    user = (await tx.twitchUser.create(query)) as UserWithPokemonTeam;
                    this.logger.log('No User Found, Created User with Pokemon Team');
                    return user.pokemonTeam;
                }

                // If user but no team
                if (!user?.pokemonTeam) {
                    // Make sure user is trying to create a starter pokemon before any other slot
                    if (redemption.slot !== 1) {
                        throw new PokemonRedeemException('You must create a starter pokemon in slot 1 first');
                    }
                    const query: PokemonTeamCreateArgs = {
                        include: { pokemon: true },
                        data: {
                            userOauthId: oauthId,
                            pokemon: { create: { ...redemption, userOauthId: oauthId } }
                        }
                    };
                    const team = (await tx.pokemonTeam.create(query)) as PokemonTeamWithPokemon;
                    this.logger.log('Created New Team For Exiting User');
                    return team;
                }

                // If team but no pokemon
                if (!user.pokemonTeam.pokemon || user.pokemonTeam.pokemon.length === 0) {
                    const query: PokemonTeamUpdateArgs = {
                        where: { id: user.pokemonTeam.id },
                        include: { pokemon: true },
                        data: { pokemon: { create: { ...redemption, userOauthId: oauthId } } }
                    };
                    const team = (await tx.pokemonTeam.update(query)) as PokemonTeamWithPokemon;
                    this.logger.log('Created New Pokemon Team Since No Pokemon In Team');
                    return team;
                }

                // If pokemon already in team
                if (user.pokemonTeam.pokemon.length >= 1) {
                    // First see if a starter pokemon is already present
                    const starterPokemon = user.pokemonTeam.pokemon.find(pokemon => pokemon.slot === 1);
                    if (!starterPokemon && redemption.slot !== 1) {
                        throw new PokemonRedeemException('You must create a starter pokemon in slot 1 first');
                    }

                    // filter out pokemon id and copy pokemon team list
                    const pokemonListCopy = user.pokemonTeam.pokemon.map(({ teamId, id, ...rest }) => rest);
                    // find number of occurrence for new slot in list
                    const slotCount = pokemonListCopy.filter(pokemon => pokemon.slot === redemption.slot).length;

                    if (slotCount > 1) {
                        this.logger.error(
                            'This should not happen. Slot already taken multiple times',
                            oauthId,
                            pokemonListCopy.filter(pokemon => pokemon.slot === 1).length
                        );
                        const newPokemonListCopy = pokemonListCopy.filter(pokemon => pokemon.slot !== redemption.slot);
                        newPokemonListCopy.push({ ...redemption, userOauthId: oauthId });
                        const query: PokemonTeamUpdateArgs = {
                            include: { pokemon: true },
                            where: { id: user.pokemonTeam.id },
                            data: { pokemon: { deleteMany: {}, createMany: { data: newPokemonListCopy } } }
                        };
                        const team = (await tx.pokemonTeam.update(query)) as PokemonTeamWithPokemon;
                        this.logger.log('Removed Duplicate Slots from Team', team);
                        return team;
                    } else if (slotCount === 1) {
                        // find index of matching slot counts
                        const index = pokemonListCopy.findIndex(pokemon => pokemon.slot === redemption.slot);
                        // swap pokemon in list with same index
                        pokemonListCopy[index] = { ...redemption, userOauthId: oauthId };
                        // update pokemon team but swap objects with same slot in pokemon list
                        const query: PokemonTeamUpdateArgs = {
                            include: { pokemon: true },
                            where: { id: user.pokemonTeam.id },
                            data: { pokemon: { deleteMany: {}, createMany: { data: pokemonListCopy } } }
                        };
                        const team = (await tx.pokemonTeam.update(query)) as PokemonTeamWithPokemon;
                        this.logger.log('Updated Team and Swapped Slots', oauthId);
                        return team;
                    } else if (slotCount === 0) {
                        // Update pokemon team by adding new pokemon with user
                        const query: PokemonTeamUpdateArgs = {
                            where: { id: user.pokemonTeam.id },
                            include: { pokemon: true },
                            data: {
                                pokemon: {
                                    create: { ...redemption, userOauthId: oauthId }
                                }
                            }
                        };
                        const team = (await tx.pokemonTeam.update(query)) as PokemonTeamWithPokemon;
                        this.logger.log('Updated Team and Added Pokemon Directly', oauthId);
                        return team;
                    }
                }
            }
            // { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
    }

    async catchPokemon(pokemonDrop: PokemonDrop, oauthId: string, username: string) {
        return this.prisma.$transaction(async tx => {
            const user = (await tx.twitchUser.findUnique({
                where: { oauthId },
                include: { pokemonTeam: { include: { pokemon: true } } }
            })) as UserWithPokemonTeam;

            if (!user) {
                const query: TwitchUserCreateArgs = {
                    data: {
                        oauthId,
                        displayName: username,
                        pokemonTeam: {
                            create: { pokemon: { create: { ...pokemonDrop, slot: 1, userOauthId: oauthId } } }
                        }
                    },
                    include: { pokemonTeam: { include: { pokemon: true } } }
                };
                // Create user with pokemon team
                const createdUser = (await tx.twitchUser.create(query)) as UserWithPokemonTeam;
                this.logger.log('No User Found Catching Pokemon, Created User with Pokemon Team', oauthId);
                return createdUser.pokemonTeam;
            }

            if (!user.pokemonTeam) {
                const query: PokemonTeamCreateArgs = {
                    include: { pokemon: true },
                    data: {
                        userOauthId: oauthId,
                        pokemon: { create: { ...pokemonDrop, slot: 1, userOauthId: oauthId } }
                    }
                };
                const team = (await tx.pokemonTeam.create(query)) as PokemonTeamWithPokemon;
                this.logger.log('Created New Team To Catch Pokemon For Existing User', oauthId);
                return team;
            }

            if (!user.pokemonTeam.pokemon || user.pokemonTeam.pokemon.length === 0) {
                const query: PokemonTeamUpdateArgs = {
                    where: { id: user.pokemonTeam.id },
                    include: { pokemon: true },
                    data: { pokemon: { create: { ...pokemonDrop, slot: 1, userOauthId: oauthId } } }
                };
                const team = (await tx.pokemonTeam.update(query)) as PokemonTeamWithPokemon;
                this.logger.log('Created New Pokemon Team Since No Pokemon In Team Catching Pokemon', oauthId);
                return team;
            }

            // const pokemon = user.pokemonTeam.pokemon.find(pokemon => pokemon.slot === pokemonDrop.slot);

            // If pokemon already in team
            if (user.pokemonTeam.pokemon.length >= 1) {
                // First see if a starter pokemon is already present
                const starterPokemon = user.pokemonTeam.pokemon.find(pokemon => pokemon.slot === 1);
                if (!starterPokemon) {
                    // Update pokemon team by adding new pokemon with user
                    const query: PokemonTeamUpdateArgs = {
                        where: { id: user.pokemonTeam.id },
                        include: { pokemon: true },
                        data: {
                            pokemon: {
                                create: { ...pokemonDrop, slot: 1, userOauthId: oauthId }
                            }
                        }
                    };
                    const team = (await tx.pokemonTeam.update(query)) as PokemonTeamWithPokemon;
                    this.logger.log('Updated Team and Added Pokemon Directly To Starter When Caught', oauthId);
                    return team;
                }
                // check the lowest available slot for pokemon on team that can be added
                const lowestAvailableSlot = this.getLowestAvailableSlot(user.pokemonTeam.pokemon);
                if (!lowestAvailableSlot || lowestAvailableSlot < 1 || lowestAvailableSlot > 6) {
                    throw new PokemonCatchException("can't catch pokemon because no slots available");
                }
                // Update pokemon team by adding new pokemon with user
                const query: PokemonTeamUpdateArgs = {
                    where: { id: user.pokemonTeam.id },
                    include: { pokemon: true },
                    data: {
                        pokemon: {
                            create: { ...pokemonDrop, slot: lowestAvailableSlot, userOauthId: oauthId }
                        }
                    }
                };
                const team = (await tx.pokemonTeam.update(query)) as PokemonTeamWithPokemon;
                this.logger.log('Updated Team and Added Pokemon Directly When Caught', oauthId);
                return team;
            }
        });
    }

    async findPokemon(oauthId: string, slot: number): Promise<Pokemon | null> {
        return this.prisma.pokemon.findFirst({
            where: { slot, userOauthId: oauthId }
        });
    }
    async deletePokemon(oauthId: string, slot: number): Promise<PokemonTeam> {
        const query: PokemonTeamUpdateArgs = {
            where: { userOauthId: oauthId },
            data: {
                pokemon: {
                    deleteMany: {
                        slot
                    }
                }
            }
        };
        return this.prisma.pokemonTeam.update(query);
    }

    async swapPokemon(oauthId: string, slot1: number, slot2: number): Promise<void> {
        if (slot1 === slot2) {
            throw new PokemonSwapException(`Can't swap to same slot`);
        }

        const team = await this.prisma.pokemonTeam.findUnique({
            where: { userOauthId: oauthId },
            include: { pokemon: true }
        });

        if (!team) {
            throw new PokemonSwapException('No team found');
        }

        if (!team.pokemon || team.pokemon.length === 0) {
            throw new PokemonSwapException('No pokemon to swap');
        }

        const pokemonTeamCopy = team.pokemon.map(({ teamId, id, ...rest }) => rest);
        const pokemon1 = pokemonTeamCopy.find(pokemon => pokemon.slot === slot1);
        const pokemon2 = pokemonTeamCopy.find(pokemon => pokemon.slot === slot2);
        if (!pokemon1 || !pokemon2) {
            throw new PokemonSwapException('One of your slots has no pokemon');
        }

        pokemon1.slot = slot2;
        pokemon2.slot = slot1;
        const query: PokemonTeamUpdateArgs = {
            include: { pokemon: true },
            where: { id: team.id },
            data: { pokemon: { deleteMany: {}, createMany: { data: pokemonTeamCopy } } }
        };
        await this.prisma.pokemonTeam.update(query);
    }

    private getLowestAvailableSlot(pokemonList: Pokemon[]): number | null {
        let lowestAvailableSlot = null;
        const pokemonSlots = pokemonList.map(pokemon => pokemon.slot);
        for (let i = 1; i <= 6; i++) {
            if (!pokemonSlots.includes(i)) {
                lowestAvailableSlot = i;
                break;
            }
        }
        return lowestAvailableSlot;
    }
}
