/* eslint-disable */
import { describe, it, beforeEach } from 'mocha';
// import { expect } from 'chai';
import { stub } from 'sinon';
import mongoose from 'mongoose';

// Import model
import '../../../src/api/models/Twurple';

// Init Twurple instance
import { twurpleInstance } from '../../../src/twurple/TwurpleInstance';

// if you are not going to add an assertion for some specific call, don’t mock it. Use a stub instead.
describe('/twurple/TwurpleInstance', () => {
    let twurpleStub;
    let twurpleDocSaveStub;

    beforeEach(() => {
        twurpleStub = stub(mongoose.Model, 'findOne');
        twurpleDocSaveStub = stub(mongoose.Model.prototype, 'save');
    });

    it('should be able to execute a test', done => {
        console.log(twurpleInstance);
        // expect(twurpleInstance.twitchBot).to.be.undefined;
        void twurpleInstance
            .initTwurple()
            .then(() => {
                console.log('New2', twurpleInstance);
                done();
                // expect(twurpleInstance.twitchBot).not.to.be.undefined;
            })
            .catch(err => {
                done();
                console.log('Err', err);
            });
    });
});
