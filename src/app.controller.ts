import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common';
import { BotApiService } from 'src/twitch/services/bot-api/bot-api.service';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';
import { TwitchPokemonService } from 'src/database/services/twitch-pokemon/twitch-pokemon.service';
import { StreamerApiService } from 'src/twitch/services/streamer-api/streamer-api.service';
import {
    TwitchUserService,
    TwitchUserWithOnlyNameAndPokemonTeam
} from 'src/database/services/twitch-user/twitch-user.service';
import { PokemonService } from 'src/twitch/services/pokemon/pokemon.service';
import { AuthenticatedGuard } from 'src/auth/guards';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);

    private readonly streamerAuthId: string;
    constructor(
        private botApiService: BotApiService,
        private twitchUserService: TwitchUserService,
        private streamerApiService: StreamerApiService,
        private botChatService: BotChatService,
        private pokemonDbService: TwitchPokemonService,
        private configService: ConfigService,
        private pokemonService: PokemonService
    ) {
        this.streamerAuthId = this.configService.get<string>('TWITCH_STREAMER_OAUTH_ID') || '00000000';
    }

    @Get('')
    getTest() {
        return { hi: 'there!' };
    }

    @Get('pokemonbattle')
    async getPokemonBattleOutcome() {
        const outcome = await this.pokemonDbService.getBattleOutcome();
        return outcome?.outcome;
    }

    @Get('pokemonteambattle')
    async getPokemonTeamBattleOutcome() {
        const outcome = await this.pokemonDbService.getTeamBattleOutcome();
        return outcome?.outcome;
    }

    @Get('leaderboard')
    async getTopPokemonPlayers() {
        return await this.pokemonDbService.getTopPokemonLeaderboard();
    }

    // TODO NOW need to throttle this endpoint since we are using api service
    @Get('/pokemonTeams')
    async findPokemonTeam(@Query('teamName') query: string): Promise<TwitchUserWithOnlyNameAndPokemonTeam> {
        let user;
        this.logger.log('Find Pokemon Team Used', query);
        try {
            const username = query.toString().toLowerCase();
            user = await this.streamerApiService.client?.users.getUserByName(username);
        } catch (err) {
            this.logger.error('Finding User errored found for team', err);
            throw new NotFoundException('Finding user did not succeed');
        }

        if (!user || !user.id) {
            this.logger.error('No user or OauthID', user);
            throw new NotFoundException('User not found');
        }
        let team;
        try {
            team = await this.twitchUserService.getTwitchUserWithOnlyNameAndPokemonTeamByOauthID(user.id);
        } catch (err) {
            this.logger.error('Team Errored for user', err, team);
            throw new InternalServerErrorException('Error Finding Team');
        }
        if (!team) throw new NotFoundException('Team not found');
        return team;
    }

    @Post('updateRewardsStatus')
    @UseGuards(AuthenticatedGuard)
    async updateRewardsStatus(@Req() req: Request, @Body() body: { isPaused: boolean }) {
        const user = req.user as any;
        const userOauthId = user?.oauthId;
        if (body.isPaused !== true && body.isPaused !== false) {
            throw new InternalServerErrorException('Incorrect body params');
        }
        if (userOauthId && userOauthId === this.streamerAuthId) {
            try {
                await this.streamerApiService.updateCustomRewards(body.isPaused);
                return { success: true };
            } catch (err) {
                throw new InternalServerErrorException('Error updating channel point redeems');
            }
        } else {
            throw new ForbiddenException('You are not the streamer');
        }
    }
    // todo - also why no use streamerauth guard?
    @Post('createChannelPointRedeems')
    @UseGuards(AuthenticatedGuard)
    async createChannelPointRedeems(@Req() req: Request) {
        const user = req.user as any;
        const userOauthId = user?.oauthId;
        if (userOauthId && userOauthId === this.streamerAuthId) {
            try {
                await this.streamerApiService.createChannelPointRedeems();
                return { success: true };
            } catch (err) {
                throw new InternalServerErrorException('Error creating channel point redeems');
            }
        } else {
            throw new ForbiddenException('You are not the streamer');
        }
    }

    // todo - also why no use streamerauth guard?
    @Post('deleteChannelPointRedeems')
    @UseGuards(AuthenticatedGuard)
    async deleteChannelPointRedeems(@Req() req: Request) {
        const user = req.user as any;
        const userOauthId = user?.oauthId;
        if (userOauthId && userOauthId === this.streamerAuthId) {
            try {
                await this.streamerApiService.deleteChannelPointRewards();
                return { success: true };
            } catch (err) {
                throw new InternalServerErrorException('Error deleting channel point redeems');
            }
        } else {
            throw new ForbiddenException('You are not the streamer');
        }
    }

    @Post('disableQuack')
    @UseGuards(AuthenticatedGuard)
    disableQuack(@Req() req: Request) {
        const user = req.user as any;
        const userOauthId = user?.oauthId;
        if (userOauthId && userOauthId === this.streamerAuthId) {
            this.botChatService.disableQuack();
            return { success: true };
        } else {
            throw new ForbiddenException('You are not the streamer');
        }
    }
}
