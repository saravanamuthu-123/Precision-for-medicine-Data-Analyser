
export interface PatientDataRow {
  [key: string]: string | number;
  LBTEST: string;
  LBORRES: string | number;
  Gender: string;
}

export interface ReferenceDataRow {
  [key: string]: string | number;
  Parameter: string;
  'Normal Range': string;
  'Gender/Notes': string;
}

export type ComparisonStatus = 'Matched' | 'Unmatched' | 'Not Found' | 'Error' | 'Pending';

export interface ResultRow extends PatientDataRow {
  status: ComparisonStatus;
  requiredValue?: string;
}
