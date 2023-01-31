# Brobot

## Description

An Express based NestJS https and websocket server written in Typescript that can be hosted on an AWS EC2 instance with automated deployment.

bro_bot was inspired by my sister, who is a streamer on Twitch.tv. This application adds a unique centralized layer of viewer/streamer interactions
that are not commonly available among other Twitch bots.

Some example features:

-   `!chatban`: Allows viewers to disable a streamer's `Enter/Return` key.
-   `!voiceban`: Allows viewers to mute the streamer's microphone.
-   `!pokemon`: Allows viewers to create and battle other viewers' pokemon using Pokemon Showdown's Battle simulator.

This project helped define my personal best practices when developing a long term scalable application.
I was able to expose myself to many technologies that I'm interested in such as:

-   Websockets
-   Hosting on an AWS EC2 instance
-   Automated deployment using the pm2 package manager
-   Git hooks, linting, and formatting configurations
-   Pub/Sub event messaging
-   Unit testing with `Mocha/Chai/Sinon`
-   Daemon process management with `pm2`
-   Integrating `Typescript` with `Babel` with the latest ECMAScript standard
-   Development vs Production Environments
-   SSL and Reverse proxy and re-routing with `NGINX`
-   OAuth2 using `passport.js`
-   MongoDB Atlas Cloud Database
-   API MVC architecture
-   Windows Subsystem for Linux (`WSL2`)

## Credits

This application is heavily dependent on the [Twurple](https://github.com/twurple/twurple) library.
Shout out to the maintainers as they have been a great help on the [Twitch API Libraries Discord Server](https://discord.gg/WUxGcDSR)
