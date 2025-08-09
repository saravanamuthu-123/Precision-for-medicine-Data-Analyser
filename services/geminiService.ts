
import { GoogleGenAI, Type } from "@google/genai";
import { PatientDataRow, ReferenceDataRow, ComparisonStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      description: "Should be 'Matched' or 'Unmatched'",
      enum: ["Matched", "Unmatched"],
    },
  },
  required: ["status"]
};

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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
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
