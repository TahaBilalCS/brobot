import { Controller, Get, Param, Post, Body, Put, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { PostService } from './post.service';
import { User as UserModel, Post as PostModel } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
    constructor(
        private readonly userService: UserService,
        private readonly postService: PostService,
        private configService: ConfigService
    ) {
        console.log('DB', configService.get('DATABASE_URL'));
        console.log('TEST', configService.get('TEST_SECRET'));
        console.log('TESTTT222', process.env.TEST_SECRET);
        console.log('ENVVVV', configService.get('NODE_ENV'));
        console.log('ENVVVV3\n\n', process.env);
    }

    @Get('post/:id')
    async getPostById(@Param('id') id: string): Promise<PostModel | null> {
        return this.postService.post({ id: Number(id) });
    }

    @Get('feed')
    async getPublishedPosts(): Promise<PostModel[]> {
        return this.postService.posts({
            where: { published: true }
        });
    }

    @Get('posts')
    async getPosts(): Promise<PostModel[]> {
        return this.postService.posts({});
    }

    @Get('users')
    async getUsers(): Promise<UserModel[]> {
        return this.testS();
        // return this.userService.users({});
    }

    async testS(): Promise<UserModel[]> {
        const allUsers = await this.userService.testUsers();
        console.log(allUsers);
        return allUsers;
    }

    @Get('filtered-posts/:searchString')
    async getFilteredPosts(@Param('searchString') searchString: string): Promise<PostModel[]> {
        return this.postService.posts({
            where: {
                OR: [
                    {
                        title: { contains: searchString }
                    },
                    {
                        content: { contains: searchString }
                    }
                ]
            }
        });
    }

    @Post('post')
    async createDraft(@Body() postData: { title: string; content?: string; authorEmail: string }): Promise<PostModel> {
        Logger.log(postData);
        const { title, content, authorEmail } = postData;
        return this.postService.createPost({
            title,
            content,
            author: {
                connect: { email: authorEmail }
            }
        });
    }

    @Post('user2')
    async signupUser(@Body() userData: { name?: string; email: string }): Promise<UserModel> {
        Logger.log('USER4', userData);
        return this.userService.createUser(userData);
    }

    @Put('publish/:id')
    async publishPost(@Param('id') id: string): Promise<PostModel> {
        return this.postService.updatePost({
            where: { id: Number(id) },
            data: { published: true }
        });
    }

    @Delete('post/:id')
    async deletePost(@Param('id') id: string): Promise<PostModel> {
        return this.postService.deletePost({ id: Number(id) });
    }
}
