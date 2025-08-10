
import { GoogleGenAI, Type } from "@google/genai";
import { PatientDataRow, ReferenceDataRow, ComparisonStatus } from "../types";
import { findBestReferenceMatch, debugReferenceMap, testReferenceMatching } from "../utils/referenceMatcher";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || process.env.API_KEY });

// Configuration for rate limiting - adjust these based on your API tier
// Free tier: BATCH_SIZE=5-6, DELAY_BETWEEN_BATCHES=2000-3000, MAX_RETRIES=5
// Paid tier: BATCH_SIZE=10-15, DELAY_BETWEEN_BATCHES=500-1000, MAX_RETRIES=3
const CONFIG = {
  BATCH_SIZE: 15, // Increased to 15 rows per API call (250 ÷ 15 ≈ 17 calls)
  DELAY_BETWEEN_BATCHES: 4000, // 4 seconds between batches for free tier
  MAX_RETRIES: 5, // Increased from 3 to 5 for free tier
  RETRY_DELAY_MULTIPLIER: 2 // Multiply delay by this factor on retries
};

const bulkResponseSchema = {
  type: Type.OBJECT,
  properties: {
    comparisons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.NUMBER },
          status: {
            type: Type.STRING,
            enum: ["Matched", "Unmatched", "Not Found"],
          },
          requiredValue: { type: Type.STRING }
        },
        required: ["index", "status"]
      }
    }
  },
  required: ["comparisons"]
};

// Rate limiting utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getBulkComparisonStatus = async (
  patientRows: PatientDataRow[],
  referenceMap: Map<string, ReferenceDataRow[]>,
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }>> => {
  
  // Debug reference data
  debugReferenceMap(referenceMap);
  
  // Test reference matching logic
  testReferenceMatching();
  
  const results: Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }> = [];
  let processedCount = 0;
  
  // Calculate expected API calls and warn if approaching daily limit
  const expectedApiCalls = Math.ceil(patientRows.length / CONFIG.BATCH_SIZE);
  if (expectedApiCalls > 45) { // Warning threshold
    console.warn(`⚠️ WARNING: This will require ~${expectedApiCalls} API calls. Free tier limit is 50/day.`);
  }
  
  // Process in batches
  for (let i = 0; i < patientRows.length; i += CONFIG.BATCH_SIZE) {
    const batch = patientRows.slice(i, i + CONFIG.BATCH_SIZE);
    let batchResults: Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }> = [];
    let retryCount = 0;
    
    // Retry logic for failed batches
    while (retryCount < CONFIG.MAX_RETRIES) {
      try {
        batchResults = await processBatch(batch, referenceMap, i);
        break; // Success, exit retry loop
      } catch (error: any) {
        retryCount++;
        console.warn(`Batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1} failed (attempt ${retryCount}/${CONFIG.MAX_RETRIES}):`, error);
        
        // Check if it's a rate limit error (429)
        if (error?.error?.code === 429) {
          console.log('Rate limit hit! Waiting longer before retry...');
          
          // Check if it's daily quota limit
          const isDailyLimit = error?.error?.details?.some((detail: any) => 
            detail?.quotaId?.includes('PerDay')
          );
          
          if (isDailyLimit) {
            console.error('🚨 DAILY QUOTA LIMIT REACHED! Cannot process more data today.');
            // Return error status for remaining items
            const remainingItems = patientRows.slice(i);
            const errorResults = remainingItems.map(pRow => ({
              row: pRow,
              status: 'Error' as ComparisonStatus
            }));
            results.push(...errorResults);
            return results; // Exit early
          } else {
            // Per-minute rate limit - wait and retry
            await delay(32000); // 32 seconds
          }
        } else {
          // Wait longer before retrying other errors
          await delay(CONFIG.DELAY_BETWEEN_BATCHES * CONFIG.RETRY_DELAY_MULTIPLIER);
        }
        
        if (retryCount >= CONFIG.MAX_RETRIES) {
          // If all retries failed, return error status for all items in this batch
          batchResults = batch.map((pRow, batchIndex) => ({
            row: pRow,
            status: 'Error' as ComparisonStatus
          }));
        }
      }
    }
    
    results.push(...batchResults);
    processedCount += batch.length;
    
    // Update progress
    if (onProgress) {
      onProgress(processedCount, patientRows.length);
    }
    
    // Add delay between batches (except for the last batch)
    if (i + CONFIG.BATCH_SIZE < patientRows.length) {
      await delay(CONFIG.DELAY_BETWEEN_BATCHES);
    }
  }
  
  return results;
};

const processBatch = async (
  patientRows: PatientDataRow[],
  referenceMap: Map<string, ReferenceDataRow[]>,
  startIndex: number
): Promise<Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }>> => {
  
  // Prepare batch data for API
  const batchData = patientRows.map((pRow, batchIndex) => {
    const globalIndex = startIndex + batchIndex;
    
    // Use improved reference matching
    const refToUse = findBestReferenceMatch(pRow, referenceMap);

    // Debug: Log what we're sending to LLM
    console.log(`📤 Sending to LLM for ${pRow.LBTEST}:`, {
      patientData: pRow,
      referenceData: refToUse,
      hasReference: !!refToUse
    });

    return {
      index: globalIndex,
      patientData: pRow,
      referenceData: refToUse
    };
  });

  const prompt = `
    Analyze the following batch of clinical data comparisons. For each comparison, determine if the patient's result is within the normal range.

    ${batchData.map((item, i) => `
    Comparison ${i + 1} (Index: ${item.index}):
    Patient data:
    - Test: ${item.patientData.LBTEST}
    - Gender: ${item.patientData.Gender}
    - Result: ${item.patientData.LBORRES}

    Reference data:
    - Test: ${item.referenceData?.Parameter || 'Not Found'}
    - Gender specification: ${item.referenceData?.['Gender/Notes'] || 'Not Found'}
    - Normal Range: ${item.referenceData?.['Normal Range'] || 'Not Found'}
    `).join('\n')}

    For each comparison:
    - If reference data shows "Not Found" for Test, Gender specification, or Normal Range, return status "Not Found"
    - If reference data is available, compare the patient result against the normal range
    - For numeric ranges like 'A – B', 'A-B', or 'A,000 - B,000', remove commas and check if the result is between A and B inclusive
    - For thresholds like '<X' or '>Y', check if the result respects the inequality
    - For string values like 'Negative', check for an exact match (case-insensitive)
    - A value of '+/-' or 'Negative +/-' should be treated as 'Negative' for comparison against a 'Negative' range
    - IMPORTANT: When multiple reference options exist (e.g., "Glucose" and "Glucose (Fasting)"), prefer numeric ranges over string values for numeric patient results
    - Return "Matched" if within normal range, "Unmatched" if outside normal range
    - For "Unmatched" results, include the required normal range value

    CRITICAL NUMERIC COMPARISON RULES:
    1. Remove ALL commas from ranges: "4,000 - 11,000" → "4000 - 11000"
    2. Extract ONLY the numeric part from patient results: "8187.7 cells/mm³" → "8187.7"
    3. Compare the clean numeric values: 8187.7 is between 4000 and 11000 = MATCHED
    4. Handle decimal numbers properly: "13.8-17.2" means 13.8 ≤ value ≤ 17.2

    EXAMPLES:
    - Patient: "WBC Count" = "8187.7 cells/mm³", Range: "4,000 - 11,000" → Extract: 8187.7, Range: 4000-11000 → 8187.7 is between 4000 and 11000 → MATCHED
    - Patient: "Glucose" = "11.06 mg/dL", Range: "0 - 15" → Extract: 11.06, Range: 0-15 → 11.06 is between 0 and 15 → MATCHED (prefer numeric range over "Negative")
    - Patient: "Glucose (Fasting)" = "11.06 mg/dL", Range: "0 - 15" → Extract: 11.06, Range: 0-15 → 11.06 is between 0 and 15 → MATCHED
    - Patient: "Hemoglobin" = "14.5 g/dL", Range: "13.8-17.2" → Extract: 14.5, Range: 13.8-17.2 → 14.5 is between 13.8 and 17.2 → MATCHED
    - Patient: "Albumin" = "6.9 g/dL", Range: "3.5 - 5.0" → Extract: 6.9, Range: 3.5-5.0 → 6.9 is NOT between 3.5 and 5.0 → UNMATCHED

    Return a JSON object with an array of comparison results.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: bulkResponseSchema,
    },
  });

  const jsonText = response.text.trim();
  const result = JSON.parse(jsonText);

  // Map results back to patient rows
  return batchData.map((item, batchIndex) => {
    const comparisonResult = result.comparisons.find((c: any) => c.index === item.index);
    
    if (!comparisonResult) {
      return {
        row: item.patientData,
        status: 'Error' as ComparisonStatus
      };
    }

    return {
      row: item.patientData,
      status: comparisonResult.status as ComparisonStatus,
      requiredValue: comparisonResult.requiredValue
    };
  });
};

// Keep the old function for backward compatibility (single comparison)
export const getComparisonStatus = async (
  patientRow: PatientDataRow,
  referenceRow: ReferenceDataRow
): Promise<ComparisonStatus> => {
  const prompt = `
    Analyze the following clinical data.
    Patient data:
    - Test: ${patientRow.LBTEST}
    - Gender: ${patientRow.Gender}
    - Result: ${patientRow.LBORRES}

    Reference data:
    - Test: ${referenceRow.Parameter}
    - Gender specification: ${referenceRow['Gender/Notes']}
    - Normal Range: ${referenceRow['Normal Range']}

    Compare the patient's result to the normal range. 
    The patient's gender is ${patientRow.Gender} and the reference range applies to ${referenceRow['Gender/Notes']}.
    The patient's result is '${patientRow.LBORRES}'. The normal range is '${referenceRow['Normal Range']}'.
    For numeric ranges like 'A – B' or 'A-B', check if the result is between A and B inclusive.
    For thresholds like '<X' or '>Y', check if the result respects the inequality.
    For string values like 'Negative', check for an exact match (case-insensitive).
    A value of '+/-' or 'Negative +/-' in the patient result should be treated as 'Negative' for comparison against a 'Negative' range.
    
    Determine if the result is within the normal range ('Matched') or not ('Unmatched').
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              description: "Should be 'Matched' or 'Unmatched'",
              enum: ["Matched", "Unmatched"],
            },
          },
          required: ["status"]
        },
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);

    if (result.status === 'Matched' || result.status === 'Unmatched') {
      return result.status;
    }
    console.warn("Gemini returned unexpected status:", result.status);
    return 'Error';
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return "Error";
  }
};
