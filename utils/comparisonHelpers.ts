/**
 * Helper functions for clinical data comparisons
 */

/**
 * Extracts numeric value from a string that may contain units
 * @param value - The value to extract number from (e.g., "8187.7 cells/mm³")
 * @returns The numeric value as a number, or null if not found
 */
export const extractNumericValue = (value: string | number): number | null => {
  if (typeof value === 'number') return value;
  
  // Remove common units and extract the first number
  const numericMatch = value.toString().match(/^([+-]?\d*\.?\d+)/);
  return numericMatch ? parseFloat(numericMatch[1]) : null;
};

/**
 * Parses a range string and returns min/max values
 * @param range - The range string (e.g., "4,000 - 11,000", "13.8-17.2")
 * @returns Object with min and max values, or null if invalid
 */
export const parseRange = (range: string): { min: number; max: number } | null => {
  // Remove commas and normalize dashes
  const cleanRange = range.replace(/,/g, '').replace(/–/g, '-');
  
  // Match patterns like "4000 - 11000" or "13.8-17.2"
  const rangeMatch = cleanRange.match(/^([+-]?\d*\.?\d+)\s*-\s*([+-]?\d*\.?\d+)$/);
  
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max };
    }
  }
  
  return null;
};

/**
 * Checks if a value is within a range
 * @param value - The value to check
 * @param range - The range string
 * @returns true if value is within range, false otherwise
 */
export const isWithinRange = (value: string | number, range: string): boolean => {
  const numericValue = extractNumericValue(value);
  const parsedRange = parseRange(range);
  
  if (numericValue === null || parsedRange === null) {
    return false;
  }
  
  return numericValue >= parsedRange.min && numericValue <= parsedRange.max;
};

/**
 * Checks if a value matches a threshold condition
 * @param value - The value to check
 * @param threshold - The threshold string (e.g., "<100", ">50")
 * @returns true if value matches threshold, false otherwise
 */
export const matchesThreshold = (value: string | number, threshold: string): boolean => {
  const numericValue = extractNumericValue(value);
  if (numericValue === null) return false;
  
  // Match patterns like "<100", ">50", "<=200", ">=10"
  const thresholdMatch = threshold.match(/^([<>]=?)\s*([+-]?\d*\.?\d+)$/);
  
  if (thresholdMatch) {
    const operator = thresholdMatch[1];
    const thresholdValue = parseFloat(thresholdMatch[2]);
    
    switch (operator) {
      case '<': return numericValue < thresholdValue;
      case '<=': return numericValue <= thresholdValue;
      case '>': return numericValue > thresholdValue;
      case '>=': return numericValue >= thresholdValue;
      default: return false;
    }
  }
  
  return false;
};

/**
 * Checks if a string value matches exactly (case-insensitive)
 * @param value - The value to check
 * @param expected - The expected value
 * @returns true if values match, false otherwise
 */
export const matchesString = (value: string | number, expected: string): boolean => {
  const stringValue = value.toString().trim().toLowerCase();
  const expectedValue = expected.trim().toLowerCase();
  
  // Handle special cases
  if (stringValue.includes('+/-') || stringValue.includes('negative +/-')) {
    return expectedValue === 'negative';
  }
  
  return stringValue === expectedValue;
};
