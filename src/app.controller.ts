import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpException,
    HttpStatus,
    InternalServerErrorException,
    NotFoundException,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common';
import { BotApiService } from 'src/twitch/services/bot-api/bot-api.service';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';
import {
    PokemonTeamWithPokemon,
    TwitchPokemonService
} from 'src/database/services/twitch-pokemon/twitch-pokemon.service';
import { StreamerApiService } from 'src/twitch/services/streamer-api/streamer-api.service';
import { PokemonTeam } from '@prisma/client';
import {
    TwitchUserService,
    TwitchUserWithOnlyNameAndPokemonTeam
} from 'src/database/services/twitch-user/twitch-user.service';
import { PokemonService } from 'src/twitch/services/pokemon/pokemon.service';
import { AuthenticatedGuard, TwitchStreamerAuthGuard } from 'src/auth/guards';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
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
        console.log('AppController Constructor');
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

    @Get('/pokemonTeams')
    async findPokemonTeam(@Query('teamName') query: string): Promise<TwitchUserWithOnlyNameAndPokemonTeam> {
        console.log('findPokemonTeam', query);
        let team;
        try {
            team = await this.twitchUserService.getTwitchUserWithOnlyNameAndPokemonTeamByName(query);
        } catch (err) {
            console.error('Error finding team', err);
            throw new InternalServerErrorException('Error Finding Team');
        }
        if (!team) throw new NotFoundException('Team not found');
        return team;
    }

    // todo
    @Post('updateRewardsStatus')
    @UseGuards(AuthenticatedGuard)
    async updateRewardsStatus(@Req() req: Request, @Body() body: { isPaused: boolean }) {
        console.log('updateRewardsStatus', body);
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
