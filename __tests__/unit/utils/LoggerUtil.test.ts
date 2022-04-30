import sinon, { stub, SinonStub } from 'sinon';
import { expect } from 'chai';
import { logError, logger } from '../../../src/utils/LoggerUtil.js';

describe('LoggerUtil', function () {
    let logErrStub: SinonStub;

    beforeEach(function () {
        logErrStub = stub(logger, 'error');
    });
    afterEach(function () {
        sinon.restore();
    });

    it('should log Error obj in the correct format', function () {
        // Create an error obj and pass into function
        const err = new Error('Actual error message');
        logError(err, 'Custom message for error tracking');
        // Expect correct error logs to be outputted

        expect(logErrStub.getCall(0).lastArg).equal('Custom message for error tracking');
        expect(logErrStub.getCall(1).lastArg).equal('Actual error message');
    });

    it('should log Error string in the correct format', function () {
        // Create an error string and pass into function
        const err = 'Actual error message';
        logError(err, 'Custom message for error tracking');
        // Expect correct error logs to be outputted

        expect(logErrStub.getCall(0).lastArg).equal('Custom message for error tracking');
        expect(logErrStub.getCall(1).lastArg).equal('Actual error message');
    });

    it('should notify that it could not determine the type of error', function () {
        // Create an error and pass into function
        const err = 123;
        logError(err, 'Custom message for error tracking');
        // Expect correct error logs to be outputted

        expect(logErrStub.getCall(0).lastArg).equal('Could not determine type of error');
        // It will still try to log out the error and converts it to a string
        expect(logErrStub.getCall(1).lastArg).equal('Custom message for error tracking');
        expect(logErrStub.getCall(2).lastArg).equal(String(err));
    });
});
