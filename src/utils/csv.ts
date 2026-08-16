const DATE_HEADER_KEYWORDS = ['date', 'datum', 'bookingdate', 'valuta', 'posted', 'fecha', 'when'];
const DESCRIPTION_HEADER_KEYWORDS = [
  'description',
  'desc',
  'details',
  'memo',
  'narrative',
  'payee',
  'name',
  'particulars',
  'reference',
  'info',
];
const AMOUNT_HEADER_KEYWORDS = [
  'amount',
  'amt',
  'value',
  'sum',
  'betrag',
  'monto',
  'importe',
  'price',
  'credit',
  'debit',
];

export const CSV_DELIMITERS = [',', ';', '\t'] as const;

export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

export interface CsvColumnMapping {
  date: number;
  description: number;
  amount: number;
}

export const detectDelimiter = (content: string): CsvDelimiter => {
  const firstLine = content.split(/\r?\n/)[0] ?? '';
  let best: CsvDelimiter = ',';
  let bestCount = 0;
  for (const delimiter of CSV_DELIMITERS) {
    const count = (
      firstLine.match(new RegExp(delimiter === '\t' ? '\\t' : `\\${delimiter}`, 'g')) ?? []
    ).length;
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
};

export function parseCsv(
  content: string,
  delimiter: CsvDelimiter = detectDelimiter(content),
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export const parseAmount = (value: string): bigint | null => {
  const trimmed = value.trim();
  if ('' === trimmed) {
    return null;
  }

  const isNegative = trimmed.startsWith('-') || (trimmed.startsWith('(') && trimmed.endsWith(')'));

  let cleaned = trimmed.replace(/^\(/, '').replace(/\)$/, '');
  cleaned = cleaned.replace(/[^0-9.,-]/g, '');

  if ('' === cleaned) {
    return null;
  }

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  let normalized: string;
  if (-1 !== lastDot && -1 !== lastComma) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    normalized = cleaned.split(thousandsSeparator).join('').split(decimalSeparator).join('.');
  } else if (-1 !== lastDot) {
    const afterDot = cleaned.slice(lastDot + 1);
    const isThousands = 3 === afterDot.length && /^\d{3}$/.test(afterDot) && !cleaned.includes(',');
    normalized = isThousands ? cleaned.replace(/\./g, '') : cleaned;
  } else if (-1 !== lastComma) {
    const afterComma = cleaned.slice(lastComma + 1);
    const isThousands = 3 === afterComma.length && /^\d{3}$/.test(afterComma);
    normalized = isThousands ? cleaned.replace(/,/g, '') : cleaned.replace(/,/g, '.');
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized.replaceAll('-', ''));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const cents = BigInt(Math.round(parsed * 100));
  return isNegative ? -cents : cents;
};

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  janv: 0,
  january: 0,
  janvier: 0,
  feb: 1,
  fev: 1,
  fevr: 1,
  fevrier: 1,
  february: 1,
  mar: 2,
  mars: 2,
  march: 2,
  apr: 3,
  avril: 3,
  april: 3,
  avr: 3,
  may: 4,
  mai: 4,
  jun: 5,
  juin: 5,
  june: 5,
  jul: 6,
  juillet: 6,
  july: 6,
  juil: 6,
  aug: 7,
  aout: 7,
  august: 7,
  sep: 8,
  sept: 8,
  septembre: 8,
  september: 8,
  oct: 9,
  octobre: 9,
  october: 9,
  nov: 10,
  novembre: 10,
  november: 10,
  dec: 11,
  decembre: 11,
  december: 11,
};

const getMonthFromName = (token: string): number | null => {
  const normalized = token
    .toLowerCase()
    .replace(/[.\s]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return MONTH_NAMES[normalized] ?? null;
};

export const parseDate = (value: string): Date | null => {
  const trimmed = value.trim();
  if ('' === trimmed) {
    return null;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (iso) {
    const [, year, month, day] = iso;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[T ].*)?$/);
  if (date) {
    const [, first, second, third] = date;
    let year = Number(third);
    if (year < 100) {
      year += year < 70 ? 2000 : 1900;
    }
    const firstNum = Number(first);
    const secondNum = Number(second);
    const day = firstNum > 12 ? firstNum : secondNum;
    const month = firstNum > 12 ? secondNum : firstNum;
    return new Date(year, month - 1, day);
  }

  const monthDayYear = trimmed.match(/^([A-Za-zÀ-ÿ]+)\s+(\d{1,2})\s*,?\s*(\d{4})$/);
  if (monthDayYear) {
    const [, monthToken, day, year] = monthDayYear;
    const month = getMonthFromName(monthToken ?? '');
    if (null !== month) {
      return new Date(Number(year), month, Number(day));
    }
  }

  const dayMonthYear = trimmed.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s*,?\s*(\d{4})$/);
  if (dayMonthYear) {
    const [, day, monthToken, year] = dayMonthYear;
    const month = getMonthFromName(monthToken ?? '');
    if (null !== month) {
      return new Date(Number(year), month, Number(day));
    }
  }

  const dayMonth = trimmed.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)$/);
  if (dayMonth) {
    const [, day, monthToken] = dayMonth;
    const month = getMonthFromName(monthToken ?? '');
    if (null !== month) {
      let year = new Date().getFullYear();
      let parsed = new Date(year, month, Number(day));
      if (parsed.getTime() > Date.now()) {
        year -= 1;
        parsed = new Date(year, month, Number(day));
      }
      return parsed;
    }
  }

  const monthDay = trimmed.match(/^([A-Za-zÀ-ÿ]+)\s+(\d{1,2})$/);
  if (monthDay) {
    const [, monthToken, day] = monthDay;
    const month = getMonthFromName(monthToken ?? '');
    if (null !== month) {
      let year = new Date().getFullYear();
      let parsed = new Date(year, month, Number(day));
      if (parsed.getTime() > Date.now()) {
        year -= 1;
        parsed = new Date(year, month, Number(day));
      }
      return parsed;
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeHeader = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const findColumn = (headers: string[], keywords: string[]): number =>
  headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return keywords.some((keyword) => normalized.includes(keyword));
  });

export const detectColumns = (headers: string[]): CsvColumnMapping => ({
  date: findColumn(headers, DATE_HEADER_KEYWORDS),
  description: findColumn(headers, DESCRIPTION_HEADER_KEYWORDS),
  amount: findColumn(headers, AMOUNT_HEADER_KEYWORDS),
});

export const isLikelyHeaderRow = (row: string[]): boolean => {
  const nonEmpty = row.filter((cell) => '' !== cell.trim());
  if (0 === nonEmpty.length) {
    return false;
  }
  const detection = detectColumns(row);
  const hasKnownColumn = 0 <= detection.date || 0 <= detection.description || 0 <= detection.amount;
  if (hasKnownColumn) {
    return true;
  }
  return nonEmpty.every((cell) => /^[a-zA-Z][a-zA-Z ._-]*$/.test(cell.trim()));
};

export const TEMPLATE_HEADERS = ['description', 'date', 'amount'] as const;

export const generateCsvTemplate = (): string => {
  const rows = [
    TEMPLATE_HEADERS,
    ['Dinner with friends', '2026-08-01', '45.60'],
    ['Groceries', '2026-08-02', '120.00'],
    ['Cinema tickets', '2026-08-03', '30.00'],
  ];
  return rows.map((row) => row.join(',')).join('\n');
};
