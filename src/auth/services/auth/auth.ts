export interface AuthenticationProvider {
    validateTwitchUser(user: any): any;
    createTwitchUser(user: any): any;
    findTwitchUser(uuid: string): any;
}
