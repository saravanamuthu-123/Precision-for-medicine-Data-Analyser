# 🏥 Intelligent Data Analyzer

[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-purple.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Intelligent clinical trial data analysis powered by Google Gemini AI**

A modern web-based tool designed to intelligently compare clinical trial patient data against standard reference ranges. Streamline the process of identifying discrepancies in lab results with AI-powered analysis.

## ✨ Key Features

- 🔄 **Smart Data Comparison** - AI-powered analysis using Google Gemini API
- 📊 **Intuitive File Upload** - Drag-and-drop support for Excel files
- 👥 **Gender-Specific Analysis** - Accurate reference range application
- 📈 **Instant Summary Reports** - Categorized results for quick review
- 🔒 **Privacy-First Design** - Client-side processing, no data storage
- 📥 **Export Capabilities** - Download annotated Excel reports
- 🎨 **Modern UI** - Clean, responsive interface with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd intelligent-data-analyzer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Key**
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Set the environment variable: `API_KEY=your_api_key_here`

4. **Run the application**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Navigate to `http://localhost:5173`
   - Or simply open `index.html` in your browser

## 📋 Usage Guide

### 1. Prepare Your Data

#### Patient Data File (`.xlsx`)
Required columns:
- `LBTEST` - Lab test name (e.g., "Hemoglobin")
- `LBORRES` - Patient result (e.g., "14.5" or "Negative")
- `Gender` - Patient gender (e.g., "Male", "Female")

#### Reference Data File (`.xlsx`)
Required columns:
- `Parameter` - Lab test name
- `Normal Range` - Reference range (e.g., "13.8-17.2", "<100", "Negative")
- `Gender/Notes` - Applicable gender (e.g., "Male", "Female", "Both")

### 2. Upload and Analyze

1. **Upload Patient Data** - Drag and drop or select your patient data file
2. **Upload Reference Data** - Upload your reference ranges file
3. **Run Analysis** - Click "Compare Data" to start AI-powered analysis
4. **Review Results** - Check the summary for matched, discrepancies, and errors
5. **Download Report** - Export annotated Excel file with results

## 🏗️ Technical Architecture

### Tech Stack

- **Frontend Framework** - React 19.1.1 with TypeScript
- **Build Tool** - Vite 6.2.0
- **Styling** - Tailwind CSS
- **AI Engine** - Google Gemini API (@google/genai)
- **Excel Processing** - SheetJS (xlsx)
- **Architecture** - Single Page Application (SPA)

### Project Structure

```
intelligent-data-analyzer/
├── 📁 components/           # React UI components
│   ├── FileUpload.tsx      # File upload interface
│   └── Header.tsx          # Application header
├── 📁 services/            # External API services
│   └── geminiService.ts    # Google Gemini integration
├── 📁 utils/               # Helper utilities
│   ├── excelGenerator.ts   # Excel report generation
│   └── excelParser.ts      # Excel file parsing
├── 🎯 App.tsx              # Main application component
├── 📄 index.html           # HTML entry point
├── ⚡ index.tsx            # React root renderer
├── 📊 metadata.json        # Application metadata
├── 🔧 types.ts             # TypeScript definitions
└── 📖 README.md            # This file
```

## 🔐 Security & Privacy

- **Client-Side Processing** - All data processing happens in the browser
- **No Data Storage** - Patient data is never stored on servers
- **Privacy-First** - Only non-identifiable clinical values are sent for AI analysis
- **Secure API** - API keys are handled securely via environment variables

## 📊 Analysis Categories

The tool categorizes results into four main groups:

- ✅ **Matched** - Results within normal range
- ⚠️ **Discrepancies** - Results outside normal range
- 🔍 **Not Found** - Patient tests without corresponding reference ranges
- ❌ **Errors** - Processing issues or invalid data

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

```bash
# Required for AI functionality (choose one or more)
VITE_API_KEY=your_google_gemini_api_key_here
VITE_GROQ_API_KEY=your_groq_api_key_here
```

### LLM Provider Options

The application supports multiple LLM providers to handle different use cases and rate limits:

#### 1. **Google Gemini** (Default)
- **Free Tier**: 50 requests/day
- **Batch Size**: 15 comparisons per API call
- **Setup**: Requires `VITE_API_KEY` environment variable
- **Best for**: High accuracy, structured responses

#### 2. **Groq** (Recommended for Free Tier)
- **Free Tier**: 1000 requests/day
- **Batch Size**: 20 comparisons per API call
- **Setup**: Requires `VITE_GROQ_API_KEY` environment variable
- **Best for**: High volume processing, no rate limits



### Switching LLM Providers

To switch providers, modify the `provider` variable in `App.tsx`:

```typescript
const provider: LLMProvider = 'groq'; // Change to 'gemini' or 'groq'
```

### Rate Limiting Configuration

Each provider has its own configuration in their respective service files:

**Gemini** (`services/geminiService.ts`):
```typescript
const CONFIG = {
  BATCH_SIZE: 15, // Number of comparisons per API call
  DELAY_BETWEEN_BATCHES: 4000, // Milliseconds between batches
  MAX_RETRIES: 5, // Maximum retry attempts for failed batches
  RETRY_DELAY_MULTIPLIER: 2 // Multiply delay by this factor on retries
};
```

**Groq** (`services/groqService.ts`):
```typescript
const GROQ_CONFIG = {
  BATCH_SIZE: 20, // Larger batches possible
  DELAY_BETWEEN_BATCHES: 1000, // Faster processing
  MAX_RETRIES: 3,
  RETRY_DELAY_MULTIPLIER: 1.5
};
```



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- 📧 Create an issue on GitHub
- 📚 Check the documentation above
- 🔍 Review the code comments for implementation details

---

<div align="center">

**Made with ❤️ for intelligent data analysis**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/intelligent-data-analyzer?style=social)](https://github.com/yourusername/intelligent-data-analyzer)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/intelligent-data-analyzer?style=social)](https://github.com/yourusername/intelligent-data-analyzer)

</div>