export const BUSINESS_TIME_ZONE = 'Asia/Colombo';

const businessDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const formattedParts = (date) => Object.fromEntries(
  businessDateTimeFormatter.formatToParts(date)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]),
);

export const getBusinessDateParts = (date) => {
  const { year, month, day } = formattedParts(date);
  return { year, month, day };
};

export const formatBusinessDateTime = (date) => {
  const { year, month, day, hour, minute, second } = formattedParts(date);
  const twoDigits = (value) => String(value).padStart(2, '0');
  return `${year}-${twoDigits(month)}-${twoDigits(day)}T${twoDigits(hour)}:${twoDigits(minute)}:${twoDigits(second)}+05:30`;
};

const offsetAt = (instant) => {
  const { year, month, day, hour, minute, second } = formattedParts(instant);
  const localTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const instantAtSecondPrecision = instant.getTime() - instant.getUTCMilliseconds();
  return localTimeAsUtc - instantAtSecondPrecision;
};

export const businessMidnightUtc = (year, month, day) => {
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let instant = new Date(localMidnightAsUtc);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = new Date(localMidnightAsUtc - offsetAt(instant));
  }

  return instant;
};

export const addBusinessCalendarDays = ({ year, month, day }, amount) => {
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

export const differenceInBusinessCalendarDays = (earlier, later) => {
  const earlierParts = getBusinessDateParts(earlier);
  const laterParts = getBusinessDateParts(later);
  const earlierOrdinal = Date.UTC(earlierParts.year, earlierParts.month - 1, earlierParts.day);
  const laterOrdinal = Date.UTC(laterParts.year, laterParts.month - 1, laterParts.day);
  return (laterOrdinal - earlierOrdinal) / (24 * 60 * 60 * 1000);
};

export const businessMonthParts = (year, month, amount = 0) => {
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
};
