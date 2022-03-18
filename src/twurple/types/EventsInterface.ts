export enum IncomingEvents {
    TRAMA_CONNECTED = 'TRAMA_CONNECTED', //rename client_connected
    CHATBAN_COMPLETE = 'CHATBAN_COMPLETE',
    VOICEBAN_COMPLETE = 'VOICEBAN_COMPLETE',
    CREATE_PREDICTION = 'CREATE_PREDICTION',
    CREATE_MARKER = 'CREATE_MARKER',
    PLAY_AD = 'PLAY_AD',
    PING = 'TRAMA_PING' //rename client_ping
}

export enum OutgoingEvents {
    CHATBAN = 'CHATBAN',
    VOICEBAN = 'VOICEBAN',
    PONG = 'TRAMA_PONG', //rename server_pong
    POKEMON_ROAR = 'POKEMON_ROAR'
}

export enum OutgoingErrors {}
