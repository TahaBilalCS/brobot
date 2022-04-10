// Import models
import '../../../src/api/models/Twurple';
import '../../../src/api/models/Pokemon';

import { expect } from 'chai';
import sinon, { SinonStub, stub } from 'sinon';
import mongoose from 'mongoose';
import { ChatClient } from '@twurple/chat';
import { TwurpleInterface } from '../../../src/api/models/Twurple';

import { twurpleInstance } from '../../../src/twurple/TwurpleInstance';

// Init Twurple instance
import { logger } from '../../../src/utils/LoggerUtil';

/**
 * Expectations for twurple pre-init
 */
const expectClientsToBeUndefined = (): void => {
    expect(twurpleInstance.twitchBot).to.be.undefined;
    expect(twurpleInstance.botChatClient).to.be.undefined;
    expect(twurpleInstance.streamerApiClient).to.be.undefined;
    expect(twurpleInstance.botApiClient).to.be.undefined;
};

/**
 * Expectations for twurple post-init after successful DB call
 */
const expectClientsToBeDefined = (): void => {
    expect(twurpleInstance.twitchBot).to.be.ok;
    expect(twurpleInstance.botChatClient).to.be.ok;
    expect(twurpleInstance.streamerApiClient).to.be.ok;
    expect(twurpleInstance.botApiClient).to.be.ok;
};

describe('TwurpleInstance', function () {
    let dbFindOneStub: SinonStub;
    let logWarnStub: SinonStub;
    let logErrStub: SinonStub;

    beforeEach(function () {
        dbFindOneStub = stub(mongoose.Model, 'findOne');
        logWarnStub = stub(logger, 'warn');
        logErrStub = stub(logger, 'error');
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should initialize and resolve undefined clients', async function () {
        // Stub and resolve mongoose methods
        dbFindOneStub.resolves(undefined);
        stub(mongoose.Model.prototype, 'save');

        // Expect clients to be undefined before and after initializing instance with undefined value from DB
        expectClientsToBeUndefined();
        await twurpleInstance.initTwurple();
        expectClientsToBeUndefined();

        // Expect correct logs for this scenario
        expect(logErrStub.getCall(0).args[0]).equal('Error Obtaining Twurple Options');
        expect(logWarnStub.getCall(0).args[0]).equal(
            'Twurple Options Could Not Be Retrieved From DB, Creating A New One'
        );
        expect(logWarnStub.getCall(1).args[0]).equal(
            'Twurple Options Could Not Be Retrieved From DB, Creating A New One'
        );
    });

    it('should initialize and resolve connected clients', async function () {
        // Mock options from DB
        const botOptions: TwurpleInterface = {
            user: 'bot-test',
            accessToken: '1234',
            refreshToken: '5678',
            scope: [],
            expiresIn: 0,
            obtainmentTimestamp: 0
        };
        const streamerOptions: TwurpleInterface = {
            user: 'streamer-test',
            accessToken: '5678',
            refreshToken: '1234',
            scope: [],
            expiresIn: 0,
            obtainmentTimestamp: 0
        };

        // Stub ChatClient connection and resolve
        stub(ChatClient.prototype, 'connect');
        stub(ChatClient.prototype, 'on').callsFake((eventBinder, eventListener) => {
            eventListener();
            return {} as never; // >:(
        });

        // Return these mock values from stubbed DB
        dbFindOneStub.onCall(0).returns(botOptions);
        dbFindOneStub.onCall(1).returns(streamerOptions);

        // Init and expect the clients to be resolved with proper logging
        await twurpleInstance.initTwurple();
        expectClientsToBeDefined();
        expect(logWarnStub.getCall(0).args[0]).equal('Twurple Options Obtained');
        expect(logWarnStub.getCall(1).args[0]).equal('Connecting To Twurple Chat Client...');
        expect(logWarnStub.getCall(2).args[0]).equal('Twitch Bot Registered');
    });
});
