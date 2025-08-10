import { PatientDataRow, ReferenceDataRow, ComparisonStatus } from "../types";
import { findBestReferenceMatch, debugReferenceMap, testReferenceMatching } from "../utils/referenceMatcher";

// Groq API configuration
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Rate limiting utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Groq configuration - very conservative for rate limits
const GROQ_CONFIG = {
  BATCH_SIZE: 5, // Very small batch size to avoid rate limits
  DELAY_BETWEEN_BATCHES: 5000, // 5 seconds between batches
  MAX_RETRIES: 5,
  RETRY_DELAY_MULTIPLIER: 3
};

export const getGroqBulkComparisonStatus = async (
  patientRows: PatientDataRow[],
  referenceMap: Map<string, ReferenceDataRow[]>,
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }>> => {
  
  // Debug: Check environment variables
  console.log('Environment variables check:');
  console.log('VITE_GROQ_API_KEY:', import.meta.env.VITE_GROQ_API_KEY ? 'Set' : 'Not set');
  console.log('process.env.GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
  console.log('Final GROQ_API_KEY:', GROQ_API_KEY ? 'Available' : 'Missing');
  
  if (!GROQ_API_KEY) {
    throw new Error("VITE_GROQ_API_KEY environment variable is required");
  }

  // Debug reference data
  debugReferenceMap(referenceMap);
  
  // Test reference matching logic
  testReferenceMatching();

  const results: Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }> = [];
  let processedCount = 0;
  
  // Calculate expected API calls
  const expectedApiCalls = Math.ceil(patientRows.length / GROQ_CONFIG.BATCH_SIZE);
  console.log(`Processing ${patientRows.length} records in ${expectedApiCalls} API calls with Groq`);
  
  // Process in batches
  for (let i = 0; i < patientRows.length; i += GROQ_CONFIG.BATCH_SIZE) {
    const batch = patientRows.slice(i, i + GROQ_CONFIG.BATCH_SIZE);
    let batchResults: Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }> = [];
    let retryCount = 0;
    
    // Retry logic for failed batches
    while (retryCount < GROQ_CONFIG.MAX_RETRIES) {
      try {
                 batchResults = await processGroqBatch(batch, referenceMap, i);
         break; // Success, exit retry loop
       } catch (error: any) {
         retryCount++;
         console.warn(`Groq batch ${Math.floor(i / GROQ_CONFIG.BATCH_SIZE) + 1} failed (attempt ${retryCount}/${GROQ_CONFIG.MAX_RETRIES}):`, error);
         
         // Check if it's a rate limit error
         if (error.message && error.message.includes('429')) {
           console.warn(`🚨 Rate limit detected! Waiting 30 seconds before retry...`);
           await delay(30000); // Wait 30 seconds for rate limit
         }
         
         if (retryCount >= GROQ_CONFIG.MAX_RETRIES) {
           // If all retries failed, return error status for all items in this batch
           batchResults = batch.map((pRow) => ({
             row: pRow,
             status: 'Error' as ComparisonStatus
           }));
         } else {
           // Wait before retrying
           await delay(GROQ_CONFIG.DELAY_BETWEEN_BATCHES * GROQ_CONFIG.RETRY_DELAY_MULTIPLIER);
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
    if (i + GROQ_CONFIG.BATCH_SIZE < patientRows.length) {
      await delay(GROQ_CONFIG.DELAY_BETWEEN_BATCHES);
    }
  }
  
  return results;
};

const processGroqBatch = async (
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

    Return a JSON object with an array of comparison results in this exact format:
    {
      "comparisons": [
        {
          "index": 0,
          "status": "Matched|Unmatched|Not Found",
          "requiredValue": "normal range value (only for Unmatched)"
        }
      ]
    }
  `;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192', // Fast and free model
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const jsonText = data.choices[0].message.content.trim();
  
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : jsonText;
  
  const result = JSON.parse(jsonString);

  // Debug: Log what LLM returned
  console.log('📥 LLM Response:', result);

  // Map results back to patient rows
  return batchData.map((item) => {
    const comparisonResult = result.comparisons.find((c: any) => c.index === item.index);
    
    // Debug: Log individual result
    console.log(`📊 Result for ${item.patientData.LBTEST}:`, comparisonResult);
    
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
