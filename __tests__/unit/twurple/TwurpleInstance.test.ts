/* eslint-disable */
import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import mongoose from 'mongoose';

// Import model
import '../../../src/api/models/Twurple';

// Init Twurple instance
import { twurpleInstance } from '../../../src/twurple/TwurpleInstance';

// if you are not going to add an assertion for some specific call, don’t mock it. Use a stub instead.
describe('/twurple/TwurpleInstance', () => {
    let dbFindOneStub: SinonStub;
    let dbSaveStub: SinonStub;

    beforeEach(() => {});

    afterEach(() => {
        dbFindOneStub.restore();
        dbSaveStub.restore();
    });

    it('should initialize with undefined clients', async () => {
        dbFindOneStub = stub(mongoose.Model, 'findOne');
        dbSaveStub = stub(mongoose.Model.prototype, 'save');
        await twurpleInstance.initTwurple();
        expect(twurpleInstance.twitchBot).to.be.undefined;
        expect(twurpleInstance.botChatClient).to.be.undefined;
        expect(twurpleInstance.streamerApiClient).to.be.undefined;
        expect(twurpleInstance.botApiClient).to.be.undefined;
    });

    it('should be able to execute a test', async () => {
        dbFindOneStub = stub(mongoose.Model, 'findOne');
        dbSaveStub = stub(mongoose.Model.prototype, 'save');
        await twurpleInstance.initTwurple();
    });
});
