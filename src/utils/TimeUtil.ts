import moment from 'moment-timezone';

/**
 * Get current date and return in EST string format
 */
export const getCurrentDateEST = (): string => {
    return moment.tz(Date.now(), 'America/New_York').format('LLL');
};
