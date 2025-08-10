import { PatientDataRow, ReferenceDataRow } from "../types";

/**
 * Enhanced reference data matching with debugging
 */
export const findBestReferenceMatch = (
  patientRow: PatientDataRow,
  referenceMap: Map<string, ReferenceDataRow[]>
): ReferenceDataRow | null => {
  const testName = patientRow.LBTEST?.toString().trim();
  const patientGender = patientRow.Gender?.toString().trim().toLowerCase();
  
  console.log(`🔍 Looking for match for: "${testName}" (Gender: ${patientGender})`);
  
  if (!testName) {
    console.log('❌ No test name provided');
    return null;
  }

  // Get all reference keys for debugging
  const allKeys = Array.from(referenceMap.keys());
  console.log(`📋 Available reference keys:`, allKeys);
  console.log(`🔍 Looking for: "${testName}"`);

  // Strategy 1: Exact match (case-insensitive) - but check for better alternatives first
  const exactMatch = allKeys.find(key => 
    key.toLowerCase() === testName.toLowerCase()
  );
  
  if (exactMatch) {
    console.log(`✅ Exact match found: "${exactMatch}"`);
    
    // Check if there are better alternatives (more specific matches)
    const betterAlternatives = allKeys.filter(key => {
      const keyLower = key.toLowerCase();
      const testLower = testName.toLowerCase();
      // Look for more specific matches that contain the test name
      return keyLower.includes(testLower) && keyLower !== testLower;
    });
    
    if (betterAlternatives.length > 0) {
      console.log(`🔍 Found better alternatives: ${betterAlternatives.join(', ')}`);
      
      // Special handling for Glucose case - check both exact and contains matches
      if (testName.toLowerCase() === 'glucose' || testName.toLowerCase().includes('glucose')) {
        const fastingMatch = betterAlternatives.find(alt => alt.toLowerCase().includes('fasting'));
        if (fastingMatch) {
          console.log(`🍯 Special Glucose case: Found "Glucose (Fasting)", preferring it over "Glucose"`);
          const fastingRefs = referenceMap.get(fastingMatch);
          if (fastingRefs) {
            const result = selectBestGenderMatch(fastingRefs, patientGender);
            console.log(`📊 Selected Glucose (Fasting) reference:`, result);
            return result;
          }
        }
      }
      
      // Get all reference options for comparison
      const allRefOptions: Array<{ key: string; ref: ReferenceDataRow }> = [];
      
      // Add the exact match
      const exactRefs = referenceMap.get(exactMatch);
      if (exactRefs) {
        exactRefs.forEach(ref => allRefOptions.push({ key: exactMatch, ref }));
      }
      
      // Add the better alternatives
      betterAlternatives.forEach(alt => {
        const altRefs = referenceMap.get(alt);
        if (altRefs) {
          altRefs.forEach(ref => allRefOptions.push({ key: alt, ref }));
        }
      });
      
      // Check if any have numeric ranges vs string values
      const numericRanges = allRefOptions.filter(option => {
        const range = option.ref['Normal Range']?.toString() || '';
        return /\d/.test(range) && !range.toLowerCase().includes('negative') && !range.toLowerCase().includes('positive');
      });
      
      const stringRanges = allRefOptions.filter(option => {
        const range = option.ref['Normal Range']?.toString() || '';
        return range.toLowerCase().includes('negative') || range.toLowerCase().includes('positive') || !/\d/.test(range);
      });
      
      console.log(`📊 Found ${numericRanges.length} numeric ranges and ${stringRanges.length} string ranges`);
      
      // If we have numeric ranges and the patient value is numeric, prefer numeric range
      const patientValue = patientRow.LBORRES?.toString() || '';
      const isPatientValueNumeric = /\d/.test(patientValue);
      
      if (isPatientValueNumeric && numericRanges.length > 0) {
        console.log(`🎯 Patient value is numeric (${patientValue}), preferring numeric range over exact match`);
        const bestNumericRef = selectBestGenderMatch(numericRanges.map(n => n.ref), patientGender);
        if (bestNumericRef) {
          console.log(`📊 Selected numeric reference:`, bestNumericRef);
          return bestNumericRef;
        }
      }
    }
    
    // If no better alternatives or no numeric ranges, use the exact match
    const matchingRefs = referenceMap.get(exactMatch)!;
    
    // Final check: If this is glucose and we have a numeric patient value, 
    // check if there's a glucose (fasting) option available
    if (testName.toLowerCase() === 'glucose' || testName.toLowerCase().includes('glucose')) {
      const patientValue = patientRow.LBORRES?.toString() || '';
      const isPatientValueNumeric = /\d/.test(patientValue);
      
      if (isPatientValueNumeric) {
        const fastingKey = allKeys.find(key => key.toLowerCase().includes('glucose') && key.toLowerCase().includes('fasting'));
        if (fastingKey && fastingKey !== exactMatch) {
          console.log(`🍯 Final check: Patient has numeric glucose value (${patientValue}), switching to "Glucose (Fasting)"`);
          const fastingRefs = referenceMap.get(fastingKey);
          if (fastingRefs) {
            const result = selectBestGenderMatch(fastingRefs, patientGender);
            console.log(`📊 Selected Glucose (Fasting) reference:`, result);
            return result;
          }
        }
      }
    }
    
    const result = selectBestGenderMatch(matchingRefs, patientGender);
    console.log(`📊 Selected reference:`, result);
    return result;
  }

  // Strategy 2: Contains match (test name contains reference key or vice versa)
  const containsMatches = allKeys.filter(key => {
    const keyLower = key.toLowerCase();
    const testLower = testName.toLowerCase();
    return testLower.includes(keyLower) || keyLower.includes(testLower);
  });

  if (containsMatches.length > 0) {
    // Sort by specificity (more specific matches first)
    containsMatches.sort((a, b) => {
      // Priority 1: Exact substring match (e.g., "Glucose (Fasting)" contains "Glucose")
      const aIsExactSubstring = testName.toLowerCase().includes(a.toLowerCase());
      const bIsExactSubstring = testName.toLowerCase().includes(b.toLowerCase());
      
      if (aIsExactSubstring && !bIsExactSubstring) return -1;
      if (!aIsExactSubstring && bIsExactSubstring) return 1;
      
      // Priority 2: Length (longer matches are more specific)
      if (a.length !== b.length) return b.length - a.length;
      
      // Priority 3: Alphabetical order for consistency
      return a.localeCompare(b);
    });
    
    const bestMatch = containsMatches[0];
    console.log(`🔗 Contains match found: "${bestMatch}" (from: ${containsMatches.join(', ')})`);
    console.log(`🎯 Selected best match based on specificity`);
    
    // Special handling for multiple matches - prefer numeric ranges over string values
    if (containsMatches.length > 1) {
      console.log(`🔍 Multiple matches found, checking for numeric vs string ranges`);
      
      // Get all reference options for the matches
      const allRefOptions: Array<{ key: string; ref: ReferenceDataRow }> = [];
      containsMatches.forEach(match => {
        const refs = referenceMap.get(match);
        if (refs) {
          refs.forEach(ref => allRefOptions.push({ key: match, ref }));
        }
      });
      
      // Check if any have numeric ranges vs string values
      const numericRanges = allRefOptions.filter(option => {
        const range = option.ref['Normal Range']?.toString() || '';
        return /\d/.test(range) && !range.toLowerCase().includes('negative') && !range.toLowerCase().includes('positive');
      });
      
      const stringRanges = allRefOptions.filter(option => {
        const range = option.ref['Normal Range']?.toString() || '';
        return range.toLowerCase().includes('negative') || range.toLowerCase().includes('positive') || !/\d/.test(range);
      });
      
      console.log(`📊 Found ${numericRanges.length} numeric ranges and ${stringRanges.length} string ranges`);
      
      // If we have numeric ranges and the patient value is numeric, prefer numeric range
      const patientValue = patientRow.LBORRES?.toString() || '';
      const isPatientValueNumeric = /\d/.test(patientValue);
      
      if (isPatientValueNumeric && numericRanges.length > 0) {
        console.log(`🎯 Patient value is numeric (${patientValue}), preferring numeric range`);
        const bestNumericRef = selectBestGenderMatch(numericRanges.map(n => n.ref), patientGender);
        if (bestNumericRef) {
          console.log(`📊 Selected numeric reference:`, bestNumericRef);
          return bestNumericRef;
        }
      }
    }
    
    const matchingRefs = referenceMap.get(bestMatch)!;
    const result = selectBestGenderMatch(matchingRefs, patientGender);
    console.log(`📊 Selected reference:`, result);
    return result;
  }

  // Strategy 3: Fuzzy matching for common variations
  const fuzzyMatches = allKeys.filter(key => {
    const keyLower = key.toLowerCase();
    const testLower = testName.toLowerCase();
    
    // Handle common abbreviations and variations
    const variations = [
      // WBC variations
      { test: ['wbc', 'white blood cell', 'white blood cells'], ref: ['wbc', 'white blood cell', 'white blood cells'] },
      // Albumin variations
      { test: ['albumin', 'alb'], ref: ['albumin', 'alb'] },
      // Hemoglobin variations
      { test: ['hemoglobin', 'hgb', 'hb'], ref: ['hemoglobin', 'hgb', 'hb'] },
      // Platelet variations
      { test: ['platelet', 'platelets', 'plt'], ref: ['platelet', 'platelets', 'plt'] },
      // Glucose variations
      { test: ['glucose', 'glu'], ref: ['glucose', 'glu'] },
      // ALT variations
      { test: ['alt', 'sgpt', 'alanine aminotransferase'], ref: ['alt', 'sgpt', 'alanine aminotransferase'] },
      // AST variations
      { test: ['ast', 'sgot', 'aspartate aminotransferase'], ref: ['ast', 'sgot', 'aspartate aminotransferase'] },
      // Alkaline phosphatase variations
      { test: ['alkaline phosphatase', 'alp'], ref: ['alkaline phosphatase', 'alp'] }
    ];

    return variations.some(variation => 
      variation.test.some(t => testLower.includes(t)) && 
      variation.ref.some(r => keyLower.includes(r))
    );
  });

  if (fuzzyMatches.length > 0) {
    fuzzyMatches.sort((a, b) => b.length - a.length);
    const bestMatch = fuzzyMatches[0];
    console.log(`🎯 Fuzzy match found: "${bestMatch}" (from: ${fuzzyMatches.join(', ')})`);
    
    const matchingRefs = referenceMap.get(bestMatch)!;
    const result = selectBestGenderMatch(matchingRefs, patientGender);
    console.log(`📊 Selected reference:`, result);
    return result;
  }

  console.log(`❌ No match found for "${testName}"`);
  return null;
};

/**
 * Select the best gender-specific reference from multiple options
 */
const selectBestGenderMatch = (
  references: ReferenceDataRow[],
  patientGender: string
): ReferenceDataRow | null => {
  if (!references || references.length === 0) {
    return null;
  }

  console.log(`👥 Found ${references.length} reference options:`, references.map(r => ({
    parameter: r.Parameter,
    gender: r['Gender/Notes'],
    range: r['Normal Range']
  })));

  // Priority 1: Exact gender match
  const exactGenderMatch = references.find(r => 
    r['Gender/Notes']?.toString().trim().toLowerCase() === patientGender
  );
  
  if (exactGenderMatch) {
    console.log(`✅ Exact gender match: ${exactGenderMatch['Gender/Notes']}`);
    return exactGenderMatch;
  }

  // Priority 2: "Both" gender match
  const bothGenderMatch = references.find(r => 
    r['Gender/Notes']?.toString().trim().toLowerCase() === 'both'
  );
  
  if (bothGenderMatch) {
    console.log(`✅ Both gender match: ${bothGenderMatch['Gender/Notes']}`);
    return bothGenderMatch;
  }

  // Priority 3: Any reference (fallback)
  console.log(`⚠️ Using fallback reference: ${references[0]['Gender/Notes']}`);
  return references[0];
};

/**
 * Debug function to log all reference data
 */
export const debugReferenceMap = (referenceMap: Map<string, ReferenceDataRow[]>) => {
  console.log('🔍 === REFERENCE DATA DEBUG ===');
  console.log(`Total reference entries: ${referenceMap.size}`);
  
  for (const [key, references] of referenceMap.entries()) {
    console.log(`\n📋 Key: "${key}"`);
    references.forEach((ref, index) => {
      console.log(`  ${index + 1}. Parameter: "${ref.Parameter}"`);
      console.log(`     Gender: "${ref['Gender/Notes']}"`);
      console.log(`     Range: "${ref['Normal Range']}"`);
    });
  }
  console.log('🔍 === END REFERENCE DEBUG ===\n');
};

/**
 * Test function to demonstrate reference matching
 */
export const testReferenceMatching = () => {
  console.log('🧪 Testing Reference Matching Logic');
  
  // Simulate your scenario
  const testCases = [
    'Glucose',
    'Glucose (Fasting)',
    'WBC Count',
    'Albumin',
    'Hemoglobin'
  ];
  
  testCases.forEach(testName => {
    console.log(`\n🔍 Testing: "${testName}"`);
    
    // Simulate the matching logic
    const testLower = testName.toLowerCase();
    const referenceKeys = ['Glucose (Fasting)', 'Glucose', 'WBC Count', 'Albumin', 'Hemoglobin'];
    
    const containsMatches = referenceKeys.filter(key => {
      const keyLower = key.toLowerCase();
      return testLower.includes(keyLower) || keyLower.includes(testLower);
    });
    
    if (containsMatches.length > 0) {
      // Sort by specificity (more specific matches first)
      containsMatches.sort((a, b) => {
        // Priority 1: Exact substring match (e.g., "Glucose (Fasting)" contains "Glucose")
        const aIsExactSubstring = testName.toLowerCase().includes(a.toLowerCase());
        const bIsExactSubstring = testName.toLowerCase().includes(b.toLowerCase());
        
        if (aIsExactSubstring && !bIsExactSubstring) return -1;
        if (!aIsExactSubstring && bIsExactSubstring) return 1;
        
        // Priority 2: Length (longer matches are more specific)
        if (a.length !== b.length) return b.length - a.length;
        
        // Priority 3: Alphabetical order for consistency
        return a.localeCompare(b);
      });
      
      console.log(`  Found matches: ${containsMatches.join(', ')}`);
      console.log(`  Best match: "${containsMatches[0]}"`);
    } else {
      console.log(`  No matches found`);
    }
  });
  
  console.log('\n✅ Reference matching test completed');
};
