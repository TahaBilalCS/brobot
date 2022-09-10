import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from './prisma.service';
import * as chokidar from 'chokidar';
import * as childProcess from 'child_process';

const envWatch = () => {
    chokidar.watch('/etc/environment').on('change', (event, path) => {
        const testSH = childProcess.execSync('. /etc/environment && echo $TESTSH');
        console.log('ENVWATCH', testSH.toString());
        console.log('WWW', process.env.TESTSH);
        // console.log(event, path);
    });
};

async function bootstrap() {
    envWatch();
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    const prismaService = app.get(PrismaService);
    await prismaService.enableShutdownHooks(app);

    await app.listen(3000);
}
bootstrap();
