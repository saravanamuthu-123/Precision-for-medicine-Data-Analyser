
declare const XLSX: any;

export const parseExcelFile = <T>(file: File): Promise<{ data: T[], headers: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (!event.target?.result) {
            return reject(new Error("FileReader event target is null"));
        }
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: T[] = XLSX.utils.sheet_to_json(worksheet);
        const headerRow: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const headers: string[] = headerRow.map(h => h.toString());
        resolve({ data: jsonData, headers });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
