import { ResultRow } from "../types";
declare const XLSX: any;

export const downloadResultsAsExcel = (results: ResultRow[], originalHeaders: string[]) => {
  const headersWithStatus = [...originalHeaders, 'Status', 'Required Value'];

  const worksheetData = results.map(row => {
    const newRow: any = {};
    originalHeaders.forEach(header => {
      newRow[header] = row[header] !== undefined ? row[header] : "";
    });
    newRow['Status'] = row.status;
    newRow['Required Value'] = row.requiredValue || "";
    return newRow;
  });
  
  const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: headersWithStatus });

  // Switched from cell fill to colored text for better compatibility.
  const statusStyles: { [key: string]: any } = {
    Unmatched: { font: { color: { rgb: "FF9C0006" }, bold: true } },
    Matched: { font: { color: { rgb: "FF006100" }, bold: true } },
    'Not Found': { font: { color: { rgb: "FF9C5700" }, bold: true } },
    Error: { font: { color: { rgb: "FF595959" }, bold: true } }
  };
  
  const statusColIndex = originalHeaders.length;

  // Add a placeholder style for the header to make it bold
  const headerStyle = { font: { bold: true } };
  headersWithStatus.forEach((header, index) => {
    const cell_ref = XLSX.utils.encode_cell({ c: index, r: 0 });
    if (worksheet[cell_ref]) {
      worksheet[cell_ref].s = headerStyle;
    }
  });


  results.forEach((row, index) => {
    const style = statusStyles[row.status];
    if (style) {
      const rowIndex = index + 1; // XLSX data rows start at 1 (after header at 0)
      const cell_address = { c: statusColIndex, r: rowIndex };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      if(worksheet[cell_ref]) {
        worksheet[cell_ref].s = style;
      }
    }
  });

  // Auto-fit columns for better readability
  const cols = headersWithStatus.map((header) => ({
      wch: Math.max(header.length, ...worksheetData.map(row => row[header]?.toString().length || 0)) + 2
  }));
  worksheet['!cols'] = cols;


  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison Results");
  XLSX.writeFile(workbook, "Precision_for_Medicine_Comparison_Results.xlsx");
};