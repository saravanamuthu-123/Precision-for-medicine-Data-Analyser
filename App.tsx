
import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import { PatientDataRow, ReferenceDataRow, ResultRow, ComparisonStatus } from './types';
import { parseExcelFile } from './utils/excelParser';
import { processWithLLM, LLMProvider } from './services/llmServiceSelector';
import { downloadResultsAsExcel } from './utils/excelGenerator';

const App: React.FC = () => {
  const [patientFile, setPatientFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [patientDataHeaders, setPatientDataHeaders] = useState<string[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [resetKey, setResetKey] = useState(0);


  const handleCompare = async () => {
    if (!patientFile || !referenceFile) {
      setError("Please upload both patient and reference data files.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setProgress(0);
    setTotalRows(0);

    try {
      const { data: patientData, headers } = await parseExcelFile<PatientDataRow>(patientFile);
      setPatientDataHeaders(headers);
      setTotalRows(patientData.length);
      const { data: referenceData } = await parseExcelFile<ReferenceDataRow>(referenceFile);

      const referenceMap = new Map<string, ReferenceDataRow[]>();
      referenceData.forEach(row => {
        const key = row.Parameter?.toString().trim().toLowerCase();
        if (!key) return;
        if (!referenceMap.has(key)) {
          referenceMap.set(key, []);
        }
        referenceMap.get(key)!.push(row);
      });
      
      // Use LLM service with provider selection (default to Gemini)
      const provider: LLMProvider = 'groq'; // Can be changed to 'groq' or 'ollama'
      const bulkResults = await processWithLLM(
        provider,
        patientData, 
        referenceMap,
        (processed, total) => {
          setProgress(processed);
          setTotalRows(total);
        }
      );
      
      // Convert bulk results to ResultRow format
      const settledResults: ResultRow[] = bulkResults.map(result => ({
        ...result.row,
        status: result.status,
        requiredValue: result.requiredValue
      }));
      
      setResults(settledResults);

    } catch (e) {
      console.error(e);
      setError("Failed to process files. Please check file formats and content.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setPatientFile(null);
    setReferenceFile(null);
    setResults([]);
    setError(null);
    setIsLoading(false);
    setProgress(0);
    setTotalRows(0);
    setPatientDataHeaders([]);
    setResetKey(prev => prev + 1);
  };

  const filesReady = useMemo(() => patientFile && referenceFile, [patientFile, referenceFile]);

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    return {
        matched: results.filter(r => r.status === 'Matched').length,
        unmatched: results.filter(r => r.status === 'Unmatched').length,
        notFound: results.filter(r => r.status === 'Not Found').length,
        errors: results.filter(r => r.status === 'Error').length,
    };
  }, [results]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Compare Clinical Data</h2>
            <p className="text-gray-600 mt-2">Upload patient and reference data files (.xlsx) to identify out-of-range values.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <FileUpload 
              key={`patient-${resetKey}`}
              title="1. Upload Patient Data" 
              id="patient-file"
              onFileSelect={setPatientFile}
            />
            <FileUpload 
              key={`reference-${resetKey}`}
              title="2. Upload Reference Data" 
              id="reference-file"
              onFileSelect={setReferenceFile}
            />
          </div>

          <div className="mt-8 flex flex-col md:flex-row justify-center items-center gap-4">
            <button
              onClick={handleCompare}
              disabled={!filesReady || isLoading}
              className="w-full md:w-auto bg-blue-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? 'Analyzing...' : 'Compare Data'}
            </button>
            {(filesReady || results.length > 0 || error) && !isLoading && (
               <button
                onClick={handleReset}
                className="w-full md:w-auto bg-gray-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-gray-700 transition-all duration-300"
              >
                Reset
              </button>
            )}
          </div>

          {isLoading && (
            <div className="mt-8" aria-live="polite">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${totalRows > 0 ? (progress / totalRows) * 100 : 0}%`}}
                ></div>
              </div>
              {totalRows > 0 && <p className="text-center text-sm text-gray-600 mt-2">Processing row {progress} of {totalRows}...</p>}
            </div>
          )}

          {error && <p className="mt-6 text-center text-red-600 bg-red-100 p-3 rounded-lg">{error}</p>}

          {summary && !isLoading && (
            <div className="mt-10">
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-center text-xl font-semibold text-gray-800 mb-4">Analysis Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="p-4 bg-green-100 rounded-lg">
                            <p className="text-2xl font-bold text-green-800">{summary.matched}</p>
                            <p className="text-sm font-medium text-green-700">Matched</p>
                        </div>
                        <div className="p-4 bg-red-100 rounded-lg">
                            <p className="text-2xl font-bold text-red-800">{summary.unmatched}</p>
                            <p className="text-sm font-medium text-red-700">Discrepancies</p>
                        </div>
                        <div className="p-4 bg-yellow-100 rounded-lg">
                            <p className="text-2xl font-bold text-yellow-800">{summary.notFound}</p>
                            <p className="text-sm font-medium text-yellow-700">Not Found</p>
                        </div>
                        <div className="p-4 bg-gray-200 rounded-lg">
                            <p className="text-2xl font-bold text-gray-800">{summary.errors}</p>
                            <p className="text-sm font-medium text-gray-700">Errors</p>
                        </div>
                    </div>
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => downloadResultsAsExcel(results, patientDataHeaders)}
                            className="bg-green-600 text-white font-bold py-2 px-8 rounded-lg hover:bg-green-700 transition-all duration-300"
                        >
                            Download Results
                        </button>
                    </div>
                </div>
            </div>
          )}
        </div>
      </main>
      <footer className="text-center py-6 text-sm text-gray-500 bg-gray-100 mt-8">
        <p className="max-w-3xl mx-auto px-4 text-xs text-gray-600">
          <strong>Privacy Assurance:</strong> This tool is designed with patient confidentiality as a priority. Personal identifying information is not required, processed, or exposed to any AI model. Only the non-identifiable clinical values you provide are used for the comparison analysis.
        </p>
      </footer>
    </div>
  );
};

export default App;