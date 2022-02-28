import moment from 'moment-timezone';

export const formatUTCToEST = (utcMilli: number): string => {
    return moment.tz(utcMilli, 'America/New_York').format('LLL');
};

export const getCurrentDateEST = (): string => {
    return moment.tz(Date.now(), 'America/New_York').format('LLL');
};
