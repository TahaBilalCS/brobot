// Import models
import '../../../../src/api/models/Twurple.js';

import { expect } from 'chai';
import sinon, { stub, spy, SinonStub, SinonSpy } from 'sinon';
import { OutgoingEvents } from '../../../../src/twurple/types/EventsInterface.js';
import { expressSocket } from '../../../../src/ws/ExpressSocket.js';
import { twurpleInstance } from '../../../../src/twurple/TwurpleInstance.js';
import { Vote } from '../../../../src/twurple/commands/Vote.js';

/**
 * Individual client listening on socket
 */
interface WssClient {
    clients: Record<string, unknown>[];
}

/**
 * The array of clients retrieved from our ws instance
 */
interface getWssClient {
    getWss: () => WssClient;
}

describe('Vote', function () {
    let getListeningClientsStub: SinonStub;
    let chatSaySpy: SinonSpy;
    let username: string;
    let mockGetWSClients: getWssClient;

    beforeEach(function () {
        chatSaySpy = spy();
        stub(twurpleInstance, 'botChatClient').value({ say: chatSaySpy });

        // Mock clients returned from ws instance
        mockGetWSClients = {
            getWss: (): WssClient => {
                return { clients: [{ send: (): undefined => undefined }] };
            }
        };
        // Stub ws instance clients
        stub(expressSocket, 'wsInstance').value(mockGetWSClients);
        getListeningClientsStub = stub(expressSocket, 'getListeningClientsOnSocket');
        username = 'random_username_123';
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should reset votes', async function () {
        getListeningClientsStub.returns(1);
        const vote = new Vote(2, OutgoingEvents.CHATBAN, 'ChatBan initiated');
        await vote.handleMessage(username);
        vote.resetUniqueVotedUsers();
        await vote.handleMessage(username);
        // Expect both consecutive calls to be the same since it reset
        expect(chatSaySpy.getCall(0).lastArg).equal('Your vote is 1 of 2 >:)');
        expect(chatSaySpy.getCall(1).lastArg).equal('Your vote is 1 of 2 >:)');
    });

    it('notifies users when a client is disconnected', async function () {
        getListeningClientsStub.returns(0); // 0 clients listening on socket
        const vote = new Vote(1, OutgoingEvents.VOICEBAN, 'VoiceBan initiated');
        await vote.handleMessage(username);
        expect(chatSaySpy.getCall(0).lastArg).equal(` is disconnected. Voting won't do sheet`);
    });

    it('notifies user that client is already banned if voting threshold is already met', async function () {
        getListeningClientsStub.returns(1); // 1 client listening on socket
        const vote = new Vote(1, OutgoingEvents.VOICEBAN, 'VoiceBan initiated');
        await vote.handleMessage(username);
        await vote.handleMessage(username);
        expect(chatSaySpy.getCall(2).lastArg).equal(` is already caged. Wait until they are free again.`);
    });

    it('notifies user that they already voted', async function () {
        getListeningClientsStub.returns(1); // 1 client listening on socket
        const vote = new Vote(2, OutgoingEvents.VOICEBAN, 'VoiceBan initiated');
        await vote.handleMessage(username);
        await vote.handleMessage(username);
        expect(chatSaySpy.getCall(1).lastArg).equal(`You already voted, @${username}`);
    });
});
