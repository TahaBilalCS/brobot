import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma } from '@prisma/client';
import { TwitchUserRegisteredIncomplete } from 'src/auth/strategies';

// 1: Define a type that includes the relation to `RegisteredUser`
const twitchUserWithRegistered = Prisma.validator<Prisma.TwitchUserArgs>()({
    include: { registeredUser: true }
});

// 2: This type will include a user and their registeredUser
export type TwitchUserWithRegistered = Prisma.TwitchUserGetPayload<typeof twitchUserWithRegistered>;

const twitchUserWithRegisteredStreamer = Prisma.validator<Prisma.TwitchUserArgs>()({
    include: { registeredStreamerAuth: true }
});
export type TwitchUserWithRegisteredStreamer = Prisma.TwitchUserGetPayload<typeof twitchUserWithRegisteredStreamer>;

const twitchUserWithRegisteredBot = Prisma.validator<Prisma.TwitchUserArgs>()({
    include: { registeredBotAuth: true }
});
// 2: This type will include a user and their registeredUser
export type TwitchUserWithRegisteredBot = Prisma.TwitchUserGetPayload<typeof twitchUserWithRegisteredBot>;

@Injectable()
export class TwitchUserService {
    constructor(private readonly prisma: PrismaService) {}

    public async upsertUserAndRegisteredUser(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredUserDetails: TwitchUserRegisteredIncomplete
    ): Promise<TwitchUserWithRegistered> {
        const query: Prisma.TwitchUserUpsertArgs = {
            where: { oauthId: userDetails.oauthId },
            include: { registeredUser: true },
            create: {
                ...userDetails,
                registeredUser: {
                    create: {
                        ...registeredUserDetails
                    }
                }
            },
            // if user already created, through pokemon, etc, update the name and upsert the registered user
            update: {
                displayName: userDetails.displayName,
                registeredUser: {
                    upsert: {
                        create: {
                            ...registeredUserDetails
                        },
                        update: {
                            ...registeredUserDetails
                        }
                    }
                }
            }
        };

        // todo setup namespace correctly instead of using as
        return (await this.prisma.twitchUser.upsert(query)) as TwitchUserWithRegistered;
    }

    async getUniqueTwitchUserWithRegistered(
        twitchUserWhereUniqueInput: Prisma.TwitchUserWhereUniqueInput
    ): Promise<TwitchUserWithRegistered | null> {
        // todo add selects to this? just for deserialization
        const query = {
            where: twitchUserWhereUniqueInput,
            include: { registeredUser: true }
        };
        return this.prisma.twitchUser.findUnique(query);
    }

    async getUniqueTwitchUserWithStreamerAuth(
        twitchUserWhereUniqueInput: Prisma.TwitchUserWhereUniqueInput
    ): Promise<TwitchUserWithRegisteredStreamer | null> {
        // todo add selects to this? just for deserialization
        const query = {
            where: twitchUserWhereUniqueInput,
            include: { registeredStreamerAuth: true }
        };
        return this.prisma.twitchUser.findUnique(query);
    }

    async getUniqueTwitchUserWithBotAuth(
        twitchUserWhereUniqueInput: Prisma.TwitchUserWhereUniqueInput
    ): Promise<TwitchUserWithRegisteredBot | null> {
        // todo add selects to this? just for deserialization
        const query = {
            where: twitchUserWhereUniqueInput,
            include: { registeredBotAuth: true }
        };
        return this.prisma.twitchUser.findUnique(query);
    }
}
