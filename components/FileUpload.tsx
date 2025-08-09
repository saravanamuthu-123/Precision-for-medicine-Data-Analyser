
import React, { useState, useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  title: string;
  id: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, title, id }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        setFileName(file.name);
        onFileSelect(file);
    }
  };

  return (
    <div className="w-full">
      <label id={`${id}-label`} className="text-lg font-medium text-gray-800 mb-2 block">{title}</label>
      <div
        className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors bg-white"
        onClick={handleBoxClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        aria-labelledby={`${id}-label`}
        role="button"
        tabIndex={0}
      >
        <input
          type="file"
          id={id}
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
        />
        <div className="flex flex-col items-center">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          {fileName ? (
            <p className="mt-2 text-sm font-medium text-gray-600 break-all">{fileName}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">XLSX or XLS files</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
