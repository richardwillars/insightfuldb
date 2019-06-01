const {
  toDate,
  startOfSecond,
  startOfMinute,
  startOfHour,
  startOfMonth,
  startOfYear,
  addSeconds,
  addMinutes,
  addHours,
  addMonths,
  addYears
} = require("date-fns");

module.exports = {
  eachSecondOfInterval: (dirtyInterval, options) => {
    if (arguments.length < 1) {
      throw new TypeError(
        "1 argument required, but only " + arguments.length + " present"
      );
    }
    console.log(dirtyInterval);
    var interval = dirtyInterval || {};
    var startDate = toDate(interval.start);
    var endDate = toDate(interval.end);

    var endTime = endDate.getTime();

    // Throw an exception if start date is after end date or if any date is `Invalid Date`
    if (!(startDate.getTime() <= endTime)) {
      throw new RangeError("Invalid interval");
    }

    var startDateSecond = startOfSecond(startDate, options);
    var endDateSecond = startOfSecond(endDate, options);

    endTime = endDateSecond.getTime();

    var seconds = [];
    var currentSecond = startDateSecond;

    while (currentSecond.getTime() <= endTime) {
      seconds.push(toDate(currentSecond));
      currentSecond = addSeconds(currentSecond, 1);
    }
    return seconds;
  },
  eachMinuteOfInterval: (dirtyInterval, options) => {
    if (arguments.length < 1) {
      throw new TypeError(
        "1 argument required, but only " + arguments.length + " present"
      );
    }

    var interval = dirtyInterval || {};
    var startDate = toDate(interval.start);
    var endDate = toDate(interval.end);

    var endTime = endDate.getTime();

    // Throw an exception if start date is after end date or if any date is `Invalid Date`
    if (!(startDate.getTime() <= endTime)) {
      throw new RangeError("Invalid interval");
    }

    var startDateMinute = startOfMinute(startDate, options);
    var endDateMinute = startOfMinute(endDate, options);

    endTime = endDateMinute.getTime();

    var minutes = [];
    var currentMinute = startDateMinute;

    while (currentMinute.getTime() <= endTime) {
      minutes.push(toDate(currentMinute));
      currentMinute = addMinutes(currentMinute, 1);
    }
    return minutes;
  },
  eachHourOfInterval: (dirtyInterval, options) => {
    if (arguments.length < 1) {
      throw new TypeError(
        "1 argument required, but only " + arguments.length + " present"
      );
    }

    var interval = dirtyInterval || {};
    var startDate = toDate(interval.start);
    var endDate = toDate(interval.end);

    var endTime = endDate.getTime();

    // Throw an exception if start date is after end date or if any date is `Invalid Date`
    if (!(startDate.getTime() <= endTime)) {
      throw new RangeError("Invalid interval");
    }

    var startDateHour = startOfHour(startDate, options);
    var endDateHour = startOfHour(endDate, options);

    endTime = endDateHour.getTime();

    var hours = [];
    var currentHour = startDateHour;

    while (currentHour.getTime() <= endTime) {
      hours.push(toDate(currentHour));
      currentHour = addHours(currentHour, 1);
    }
    return hours;
  },
  eachMonthOfInterval: (dirtyInterval, options) => {
    if (arguments.length < 1) {
      throw new TypeError(
        "1 argument required, but only " + arguments.length + " present"
      );
    }

    var interval = dirtyInterval || {};
    var startDate = toDate(interval.start);
    var endDate = toDate(interval.end);

    var endTime = endDate.getTime();

    // Throw an exception if start date is after end date or if any date is `Invalid Date`
    if (!(startDate.getTime() <= endTime)) {
      throw new RangeError("Invalid interval");
    }

    var startDateMonth = startOfMonth(startDate, options);
    var endDateMonth = startOfMonth(endDate, options);

    // Some timezones switch DST at midnight, making start of day unreliable in these timezones, 3pm is a safe bet
    startDateMonth.setHours(15);
    endDateMonth.setHours(15);

    endTime = endDateMonth.getTime();

    var months = [];

    var currentMonth = startDateMonth;

    while (currentMonth.getTime() <= endTime) {
      currentMonth.setHours(0);
      months.push(toDate(currentMonth));
      currentMonth = addMonths(currentMonth, 1);
      currentMonth.setHours(15);
    }
    return months;
  },
  eachYearOfInterval: (dirtyInterval, options) => {
    if (arguments.length < 1) {
      throw new TypeError(
        "1 argument required, but only " + arguments.length + " present"
      );
    }

    var interval = dirtyInterval || {};
    var startDate = toDate(interval.start);
    var endDate = toDate(interval.end);

    var endTime = endDate.getTime();

    // Throw an exception if start date is after end date or if any date is `Invalid Date`
    if (!(startDate.getTime() <= endTime)) {
      throw new RangeError("Invalid interval");
    }

    var startDateYear = startOfYear(startDate, options);
    var endDateYear = startOfYear(endDate, options);

    // Some timezones switch DST at midnight, making start of day unreliable in these timezones, 3pm is a safe bet
    startDateYear.setHours(15);
    endDateYear.setHours(15);

    endTime = endDateYear.getTime();

    var years = [];

    var currentYear = startDateYear;

    while (currentYear.getTime() <= endTime) {
      currentYear.setHours(0);
      years.push(toDate(currentYear));
      currentYear = addYears(currentYear, 1);
      currentYear.setHours(15);
    }
    return years;
  }
};
