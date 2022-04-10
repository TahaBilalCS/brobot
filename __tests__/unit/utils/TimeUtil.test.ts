import { useFakeTimers, SinonFakeTimers } from 'sinon';
import { expect } from 'chai';
import { getCurrentDateEST } from '../../../src/utils/TimeUtil';

describe('TimeUtil', function () {
    let clock: SinonFakeTimers;

    beforeEach(function () {
        clock = useFakeTimers({
            now: new Date(2019, 1, 1, 0, 0)
        });
    });

    afterEach(function () {
        clock.restore();
    });

    it('should return correctly formatted date in EST', function () {
        expect(getCurrentDateEST()).equal('February 1, 2019 12:00 AM');
        clock.tick(86400000); // Advance 1 day in milliseconds
        expect(getCurrentDateEST()).equal('February 2, 2019 12:00 AM');
    });
});
