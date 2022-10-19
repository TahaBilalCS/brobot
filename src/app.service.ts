import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    constructor() {
        console.log('APP Service Init');
    }
    getHello(): string {
        return 'Sup Yo';
    }
}
