/*----------------------------------------------------------------------------*
 * Expressive time functionality handler.
 * Meant to be an expressive wrapper over the moment-timezone class.
 * 
 * My goal for this file is to help serverside time handling/conversion 
 * operations very declarative and expressive, so time handling and conversion
 * on the server is very clear and readable - both converting to UTC and out
 * of UTC.
 * 
 * That also being said, the first two functions are called toUTC and 
 * reverseUTC. This is because this file was written with intent to translate
 * all clientside requests INTO UTC, since all data should be stored in 
 * UTC. This, instead of naming the file that translates the timezones back
 * into the clients timezone "fromUTC" or something like that is because I 
 * want the user to know that serverside: get your timezones in UTC. Handle
 * your logic, and return data back to the client in their timezone: thus,
 * reversing the transformation process of client timezone -> UTC BACK 
 * into client timezone.
 *----------------------------------------------------------------------------*/
'use strict';
const moment = require('moment-timezone');

const ISO_DATE = 'YYYY-MM-DD';
const ISO_TIME = 'HH:mm:ss';
const ISO_DT = `${ISO_DATE} ${ISO_TIME}`;
const DEFAULT_DATE = '1970-01-01';
const DEFAULT_TIME = '00:00:00';

// TODO: start building this mapping of date format types
const FMT = {
  ISO_DATE,
  ISO_TIME,
  ISO_DT,
  ISO8601: 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', // like the native date... and the date returned by mysql 
};

const logErr = (fn, err) => `UTIL ERR:v2TimeUtil:${fn}:${err}`;

/**
 * Ensure that a timestamp is in UTC time format.
 * @t (str): YYYY-MM-DD HH:mm:ss. Time that will be converted if necessary.
 * @offsetString (str): +HH:MM or -HH:MM. Offset to adjust 't' by. 
 * @return (str): YYYY-MM-DD HH:mm:ss. In UTC timezone.
 * TODO: implement the fmt / outfmt stuff
 */
const toUTC = (t, offsetString = '00:00', fmt = ISO_DT, outFmt) => {
  // find the hours and minutes t needs to be adjusted by
  const [hours, mins] = offsetString.split(':').map(parseInt);

  // convert t into a moment object and apply the offset
  const utcMoment = moment(t).add(-1 * hours, 'hours').add(mins, 'minutes');
  return utcMoment.format(ISO_DT);
}

/**
 * Ensure that a timestamp is in the specified timezone.
 * We ensure that all dates are handled in UTC through functionality.
 * This is the function to tranform the string back from whatever 
 * timezone (offset) it came from.
 * @t (str): YYYY-MM-DD HH:mm:ss. Time that will be converted if necessary.
 * @offsetString (str): +HH:MM || -HH:MM. Same as toUTC: time "t" is off of pst.
 * @fmt (str): format of the time coming in. 
 * @outFmt (str): format to be returned to the caller. If null, we will assume fmt
 * @return (str): YYYY-MM-DD HH:mm:ss. In UTC timezone.
 */
const reverseUTC = (t, offsetString = '00:00', fmt = ISO_DT, outFmt) => {
  const [hours, mins] = offsetString.split(':').map(parseInt);

  // convert t into a moment object and apply the offset (in reverse)
  const utcMoment = moment(t, fmt).subtract(-1 * hours, 'hours').add(mins, 'minutes');
  return utcMoment.format(outFmt ? outFmt : fmt);
}

/**
 * Ensure some portion of a timestamp is in the expected ISO format.
 * This goes for dates, times, and datetimes.
 * @t (str): String we evaluate is in proper format. 
 * @unit (str): 'DATE' || 'TIME' || 'DATETIME'
 * @return (obj): Depending on unit supplied:
 *  date: 'YYYY-MM-DD' || DEFAULT_DATE, 
 *  time: 'HH:mm:ss' || DEFAULT_TIME // 0 fill where ever missing
 *  // NOTE DATETIME SUPPORT YET. datetime: {date} ${time}
 * 
 * TODO: EVERYTHING this code is trash
 * 1) refactor, there's lots of potential here. 
 * 2) range checking for the dates and times.
 */
const toISO = (t, unit) => {
  let base, actual, missing;
  switch(unit.toUpperCase()) {
    case 'DATE':
      base = DEFAULT_DATE.split('-');
      actual = t.split('-');
      missing = actual.length !== base.length ? base.slice(actual.length) : [];
      return [...actual, ...missing].join('-');
    case 'TIME':
      base = DEFAULT_TIME.split(':');
      actual = t.split(':');
      missing = actual.length !== base.length ? base.slice(actual.length) : [];
      return [...actual, ...missing].join(':');
    default:
      logErr('toISO', 'Bad time format');
      return t;
  }
}

/**
 * Take a date object in ISO8601 and get it back in a format you don't absolutely hate.
 * Mainly useful for the mySQL date objects that come back from queries.
 */
const fromISO8601 = (dt, fmt = ISO_DT) => moment(dt, FMT.ISO8601).format(fmt);

/**
 * Series of time comparison functions.
 * @t1  (str): Time evaluating the comparison for.
 * @t2  (str): Time evaluating the comparison against.
 * @fmt (str): Format string to convert the times into moment objects.
 * @return (bool): Validity of the comparison
 */
const isSame = (t1, t2, fmt = ISO_DT) => moment(t1, fmt).isSame(moment(t2, fmt));
const isBefore = (t1, t2, fmt = ISO_DT) => moment(t1, fmt).isBefore(moment(t2, fmt));
const isAfter = (t1, t2, fmt = ISO_DT) => moment(t1, fmt).isAfter(moment(t2, fmt));
const isSameOrBefore = (t1, t2, fmt = ISO_DT) => moment(t1, fmt).isSameOrBefore(moment(t2, fmt));
const isSameOrAfter = (t1, t2, fmt = ISO_DT) => moment(t1, fmt).isSameOrAfter(moment(t2, fmt));

/**
 * Grab all the times between two timestamps at some defined interval
 * @t1  (str): Start time (inclusive)
 * @t2  (str): End time (inclusive)
 * @stepAmt  (int): Amount to step the interval
 * @interval (str): Interval between timesteps. 'seconds', 'minutes', 'days', etc
 * @tFmt (str): Timestamp formats of t1 and t2 used to convert into moment objects
 * @outFmt (str): Output format for the times between t1 and t2 to be returned
 * @return (List [strings]): List of string converted timestamps from t1 -> t2 in outFmt format.
 */
const timesBetween = (t1, t2, stepAmt, interval, tFmt = ISO_DT, outFmt) => {
  const m1 = moment(t1, tFmt);
  const m2 = moment(t2, tFmt);

  let times = [];
  while(m1.isSameOrBefore(m2)) {
    times.push(m1.format(outFmt));
    m1.add(stepAmt, interval);
  }

  return times;
}

module.exports = {
  FMT,
  toUTC,
  reverseUTC,
  toISO,
  fromISO8601,
  isSame, 
  isBefore,
  isAfter,
  isSameOrBefore,
  isSameOrAfter,
  timesBetween
};