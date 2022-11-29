export enum IncomingEvents {
    // From Streamer
    CHATBAN_COMPLETE = 'chatban_complete',
    VOICEBAN_COMPLETE = 'voiceban_complete',
    CREATE_PREDICTION = 'create_prediction',
    CREATE_MARKER = 'create_marker',
    PLAY_AD = 'play_ad',
    // To UI
    POKEMON_ROAR_COMPLETE = 'pokemon_roar_complete',
    DEBS_ALERT_COMPLETE = 'debs_alert_complete'
}

export enum OutgoingEvents {
    // To Streamer
    CHATBAN = 'chatban',
    VOICEBAN = 'voiceban',
    // To UI
    POKEMON_ROAR = 'pokemon_roar',
    DEBS_ALERT = 'debs_alert',
    QUACK = 'quack'
}
