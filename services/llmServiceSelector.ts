import { PatientDataRow, ReferenceDataRow, ComparisonStatus } from "../types";
import { getBulkComparisonStatus } from "./geminiService";
import { getGroqBulkComparisonStatus } from "./groqService";

export type LLMProvider = 'gemini' | 'groq';

export const getLLMService = (provider: LLMProvider) => {
  switch (provider) {
    case 'gemini':
      return getBulkComparisonStatus;
    case 'groq':
      return getGroqBulkComparisonStatus;
    default:
      return getBulkComparisonStatus; // Default to Gemini
  }
};

export const getLLMProviderInfo = (provider: LLMProvider) => {
  switch (provider) {
    case 'gemini':
      return {
        name: 'Google Gemini',
        freeTier: '50 requests/day',
        batchSize: 15,
        setup: 'Requires API_KEY environment variable',
        pros: ['High accuracy', 'Structured responses'],
        cons: ['Low free tier limits', 'Rate limited']
      };
    case 'groq':
      return {
        name: 'Groq',
        freeTier: '1000 requests/day',
        batchSize: 20,
        setup: 'Requires GROQ_API_KEY environment variable',
        pros: ['High free tier', 'Fast responses', 'No rate limits'],
        cons: ['Requires API key setup']
      };

    default:
      return getLLMProviderInfo('gemini');
  }
};

// Main function to use any LLM provider
export const processWithLLM = async (
  provider: LLMProvider,
  patientRows: PatientDataRow[],
  referenceMap: Map<string, ReferenceDataRow[]>,
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{ row: PatientDataRow; status: ComparisonStatus; requiredValue?: string }>> => {
  
  const service = getLLMService(provider);
  const info = getLLMProviderInfo(provider);
  
  console.log(`Using ${info.name} for processing ${patientRows.length} records`);
  console.log(`Free tier: ${info.freeTier}, Batch size: ${info.batchSize}`);
  
  return service(patientRows, referenceMap, onProgress);
};
