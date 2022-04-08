// Import models
import '../../../../src/api/models/Twurple';

import sinon, { stub, spy, SinonStub, SinonSpy } from 'sinon';
import { expect } from 'chai';
import axios from 'axios';
import { twurpleInstance } from '../../../../src/twurple/TwurpleInstance';
import { Chess } from '../../../../src/twurple/commands/Chess';
import { logger } from '../../../../src/utils/LoggerUtil';

describe('Chess', function() {
    let chessInstance: Chess;
    let axiosStub: SinonStub;
    // let logErrorStub: SinonStub; TODO: Need to use babel to stub ES Modules
    let chatSpy: SinonSpy;
    let username: string;
    beforeEach(function() {
        username = 'random_user_123';
        // logErrorStub = stub(LogUtil, 'logError')
        chatSpy = spy();
        stub(twurpleInstance, 'botChatClient').value({ say: chatSpy });
        stub(logger, 'error');
        axiosStub = stub(axios, 'post');
        chessInstance = new Chess();
    });

    afterEach(function() {
        sinon.restore();
    });

    it('returns url after successful fetch', async function() {
        const res = {
            data: {
                challenge: {
                    url: 'http://somechesslink.com'
                }
            }
        };
        axiosStub.resolves(res);
        await chessInstance.handleMessage(username);
        expect(chatSpy.getCall(0).lastArg).equal(
            `@${username} wants to play Chess. If you hate yourself too, click the link to challenge them! http://somechesslink.com`
        );
        expect(axiosStub.getCall(0).firstArg).equal('https://lichess.org/api/challenge/open');
    });

    it('notifies users that an error occurred while fetching url', async function() {
        axiosStub.throws(new Error('Error fetching Chess URL'));
        await chessInstance.handleMessage(username);
        expect(chatSpy.getCall(0).lastArg).equal(`Uhoh, couldn't fetch Chess URL :(`);
    });
});
