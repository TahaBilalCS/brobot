export interface AuthenticationProvider {
    findTwitchUser(uuid: string): any;
    validateOrCreateTwitchUser(user: any): any;
    createTwitchUser(user: any): any;
    validateOrCreateTwitchStreamer(streamer: any): any;
    createTwitchStreamer(streamer: any): any;
    validateOrCreateTwitchBot(bot: any): any;
    createTwitchBot(bot: any): any;
}
