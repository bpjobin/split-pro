import {
  CSV_DELIMITERS,
  type CsvColumnMapping,
  detectColumns,
  detectDelimiter,
  generateCsvTemplate,
  isLikelyHeaderRow,
  parseAmount,
  parseCsv,
  parseDate,
} from '~/utils/csv';

describe('parseCsv', () => {
  it('should parse a simple comma-separated CSV', () => {
    const result = parseCsv('a,b,c\n1,2,3');
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('should handle quoted fields containing delimiters', () => {
    const result = parseCsv('a,"b,c",d\n1,2,3');
    expect(result).toEqual([
      ['a', 'b,c', 'd'],
      ['1', '2', '3'],
    ]);
  });

  it('should handle escaped quotes', () => {
    const result = parseCsv('a,"say ""hi""",b');
    expect(result).toEqual([['a', 'say "hi"', 'b']]);
  });

  it('should handle CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2\r\n');
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('should parse semicolon-delimited CSV', () => {
    const result = parseCsv('a;b;c\n1;2;3', ';');
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('should handle quoted fields spanning newlines', () => {
    const result = parseCsv('a,"line1\nline2",c');
    expect(result).toEqual([['a', 'line1\nline2', 'c']]);
  });
});

describe('detectDelimiter', () => {
  it('should detect comma delimiter', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
  });

  it('should detect semicolon delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('should detect tab delimiter', () => {
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('should default to comma when ambiguous', () => {
    expect(CSV_DELIMITERS).toContain(detectDelimiter('abc'));
  });
});

describe('parseAmount', () => {
  it('should parse integer dollars to cents', () => {
    expect(parseAmount('12')).toBe(1200n);
  });

  it('should parse decimal dollars to cents', () => {
    expect(parseAmount('12.34')).toBe(1234n);
  });

  it('should parse negative amounts', () => {
    expect(parseAmount('-12.34')).toBe(-1234n);
  });

  it('should parse parenthesized negative amounts', () => {
    expect(parseAmount('(12.34)')).toBe(-1234n);
  });

  it('should parse amounts with currency symbols', () => {
    expect(parseAmount('$1,234.56')).toBe(123456n);
  });

  it('should parse European comma-decimal amounts', () => {
    expect(parseAmount('1.234,56')).toBe(123456n);
  });

  it('should parse comma-decimal amounts', () => {
    expect(parseAmount('12,34')).toBe(1234n);
  });

  it('should return null for empty or invalid values', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('parseDate', () => {
  it('should parse ISO dates', () => {
    expect(parseDate('2024-01-15')?.getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it('should parse ISO datetime strings', () => {
    expect(parseDate('2024-01-15T10:30:00')?.getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it('should parse US mm/dd/yyyy dates', () => {
    expect(parseDate('01/15/2024')?.getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it('should parse European dd/mm/yyyy dates', () => {
    expect(parseDate('15/01/2024')?.getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it('should parse dotted dates', () => {
    expect(parseDate('15.01.2024')?.getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it('should parse two-digit years', () => {
    expect(parseDate('15/01/24')?.getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it('should parse named month dates', () => {
    expect(parseDate('Jan 15, 2024')?.getTime()).toBe(new Date(2024, 0, 15).getTime());
  });

  it('should parse day-before-month with year', () => {
    expect(parseDate('28 Jan 2026')?.getTime()).toBe(new Date(2026, 0, 28).getTime());
  });

  it('should parse French month names', () => {
    expect(parseDate('15 juin 2026')?.getTime()).toBe(new Date(2026, 5, 15).getTime());
    expect(parseDate('3 avril 2026')?.getTime()).toBe(new Date(2026, 3, 3).getTime());
  });

  it('should parse dates without a year using the current year', () => {
    const currentYear = new Date().getFullYear();
    expect(parseDate('28 Jan')?.getTime()).toBe(new Date(currentYear, 0, 28).getTime());
  });

  it('should parse French dates without a year', () => {
    const currentYear = new Date().getFullYear();
    expect(parseDate('3 fev')?.getTime()).toBe(new Date(currentYear, 1, 3).getTime());
    expect(parseDate('28 mars')?.getTime()).toBe(new Date(currentYear, 2, 28).getTime());
  });

  it('should return null for invalid dates', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('detectColumns', () => {
  it('should detect date, description and amount columns', () => {
    const mapping = detectColumns(['Date', 'Description', 'Amount']);
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it('should detect columns case-insensitively', () => {
    const mapping = detectColumns(['date', 'description', 'amount']);
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it('should return -1 for missing columns', () => {
    const mapping: CsvColumnMapping = detectColumns(['Alpha', 'Beta']);
    expect(mapping.date).toBe(-1);
    expect(mapping.description).toBe(-1);
    expect(mapping.amount).toBe(-1);
  });
});

describe('isLikelyHeaderRow', () => {
  it('should return true for header rows with letters', () => {
    expect(isLikelyHeaderRow(['Date', 'Description'])).toBe(true);
  });

  it('should return false for data rows', () => {
    expect(isLikelyHeaderRow(['2024-01-15', 'Coffee'])).toBe(false);
  });
});

describe('generateCsvTemplate', () => {
  it('should generate a template with the standard headers', () => {
    const template = generateCsvTemplate();
    const firstLine = template.split('\n')[0];
    expect(firstLine).toBe('description,date,amount');
  });

  it('should generate a parseable template', () => {
    const template = generateCsvTemplate();
    const rows = parseCsv(template);
    expect(rows[0]).toEqual(['description', 'date', 'amount']);
    expect(rows.length).toBe(4);
    const dataRows = rows.slice(1);
    for (const row of dataRows) {
      expect(parseDate(row[1] ?? '')).not.toBeNull();
      expect(parseAmount(row[2] ?? '')).not.toBeNull();
    }
  });
});
