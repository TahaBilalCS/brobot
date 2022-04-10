# Brobot

## Description

A Node.js Express https and websocket server written in Typescript that can be hosted on an AWS EC2 instance with automated deployment.

Brobot was inspired by my sister, who is a streamer on Twitch.tv. This application adds a unique centralized layer of viewer/streamer interactions 
that are not commonly available among other Twitch bots.

Some example features:

- `!chatban`: Allows viewers to disable a streamer's `Enter/Return` key. 
- `!voiceban`: Allows viewers to mute the streamer's microphone.
- `!pokemon`: Allows viewers to create and battle other viewers' pokemon using Pokemon Showdown's Battle simulator.

This project helped define my personal best practices when developing a long term scalable application.
I was able to expose myself to many technologies that I'm interested in such as:
- Websockets
- Hosting on an AWS EC2 instance
- Automated deployment
- Git hooks, linting, and formatting configurations
- Pub/Sub event messaging
- Unit testing with `Mocha/Chai/Sinon`
- Daemon process management with `pm2`
- Integrating `Typescript` with `Babel` using the latest ES Module syntax
- Development vs Production Environments
- Reverse proxy and re-routing with `nginx`
- OAuth2 using `passport.js`
- MongoDB Atlas Cloud Database
- API MVC architecture
- Windows Subsystem for Linux (`WSL2`)

## Installation

- This project runs on `node v17.8.0`. I recommend using [nvm](https://github.com/nvm-sh/nvm).

- After cloning this repo, in the root directory, run `npm install`

## Usage

You also need to configure your own `.env` file in the root directory with the following keys for development:
```
# These 3 fields can be configured following Twitch's Node.js Sample App (https://github.com/twitchdev/authentication-node-sample)
TWITCH_CLIENT_ID=
TWITCH_SECRET=
TWITCH_CALLBACK_URL=

# Bot and Streamer Config
BROBOT_ACCESS_TOKEN= The access token generated when logging into this application with the bot's Twitch account credentials
BROBOT_REFRESH_TOKEN= The refresh token generated when logging into this application with the bot's Twitch account credentials
TWITCH_BOT_USERNAME= The username of the bot account used to communicate on a streamer's channel 

STREAMER_ACCESS_TOKEN= Same as BOT_ACCESS_TOKEN, but with the Streamer's Twitch account credentials
STREAMER_REFRESH_TOKEN= Same as BOT_REFRESH_TOKEN, but with the Streamer's Twitch account credentials
STREAMER_AUTH_ID= The OAuth ID retrieved when logging in with a Streamer's credentials
TWITCH_CHANNEL_LISTEN= The username of the twitch channel you want to connect the bot to

# Database
MONGO_URI= Mongo DB Atlas URI (Ex: mongodb+srv://server.example.com/)

# Express
PORT= Port to configure server on

# API Tokens
LICHESS_AUTH_TOKEN=Personal access token for Chess API (https://lichess.org/api)

# Secrets
SESSION_SECRET= Any secret string (optionally used for cookieSession middleware)
COOKIE_KEY= Any secret string (used for cookieSession middleware)
WS_SECRET= Any secret string for basic websocket authentication
TEST_SECRET= Any secret string (used to subscribe to event subscriptions)
```

After that run: `npm run build` and then `npm run dev` to start up your server.

## Tests

Generate coverage report with: `npm run test`

## Credits

This application is heavily dependent on the [Twurple](https://github.com/twurple/twurple) library.
Shout out to the maintainers as they have been a great help on the [Twitch API Libraries Discord Server](https://discord.gg/WUxGcDSR)
