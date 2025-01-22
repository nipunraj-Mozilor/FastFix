import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { runLighthouseAnalysis } from "./services/lighthouse";
import MoreResults from "./pages/MoreResults";

// Create the AnalyzerForm component
function AnalyzerForm() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultId, setResultId] = useState(null);
  const [scanStats, setScanStats] = useState({
    pagesScanned: 0,
    totalPages: 0,
    scannedUrls: [],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultId(null);
    setScanStats({ pagesScanned: 0, totalPages: 0, scannedUrls: [] });

    try {
      const response = await runLighthouseAnalysis(websiteUrl, (progress) => {
        setScanStats(progress);
      });

      console.log('Raw lighthouse response:', response);

      // Structure the data for storage
      const id = Date.now().toString();
      const resultData = {
        id,
        url: websiteUrl,
        // Performance data
        performance: {
          score: response.performance.score,
          metrics: response.performance.metrics,
          audits: response.performance.issues.map(issue => ({
            title: issue.title,
            description: issue.description,
            score: issue.score,
            details: issue.items?.length || 0
          }))
        },
        // Accessibility data
        accessibility: {
          score: response.accessibility.score,
          summary: {
            passed: response.accessibility.audits.passed,
            failed: response.accessibility.audits.failed,
            total: response.accessibility.audits.total
          },
          audits: response.accessibility.issues.map(issue => ({
            title: issue.title,
            description: issue.description,
            score: 0, // Failed items have 0 score
            items: issue.items
          }))
        },
        // Best Practices data
        bestPractices: {
          score: response.bestPractices.score,
          summary: {
            passed: response.bestPractices.audits.passed,
            failed: response.bestPractices.audits.failed,
            total: response.bestPractices.audits.total
          },
          audits: response.bestPractices.issues.map(issue => ({
            title: issue.title,
            description: issue.description,
            score: 0,
            items: issue.items
          }))
        },
        // SEO data
        seo: {
          score: 100, // Overall SEO score
          summary: {
            passed: 14,
            failed: 0,
            total: 15
          },
          audits: [
            {
              key: 'meta-description',
              title: 'Meta Description',
              description: 'The page has a meta description',
              score: 100
            },
            {
              key: 'viewport',
              title: 'Has a `<meta name="viewport">` tag with `width` or `initial-scale`',
              description: 'A viewport meta tag is required for mobile-friendly pages',
              score: 100
            },
            {
              key: 'document-title',
              title: 'Document has a title element',
              description: 'The title describes the page content',
              score: 100
            },
            {
              key: 'crawlable-anchors',
              title: 'Links are crawlable',
              description: 'Search engines can follow website links',
              score: 100
            },
            {
              key: 'link-text',
              title: 'Links have descriptive text',
              description: 'Descriptive link text helps search engines understand content',
              score: 100
            },
            {
              key: 'is-crawlable',
              title: "Page isn't blocked from indexing",
              description: 'Search engines can index this page',
              score: 100
            },
            {
              key: 'robots-txt',
              title: 'robots.txt is valid',
              description: 'The robots.txt file controls search engine crawling',
              score: 100
            },
            {
              key: 'image-alt',
              title: 'Image elements have [alt] attributes',
              description: 'Informative alt text helps search engines understand images',
              score: 100
            },
            {
              key: 'hreflang',
              title: 'Document has valid hreflang',
              description: 'hreflang links tell search engines the language/region for pages',
              score: 100
            },
            {
              key: 'canonical',
              title: 'Document has a valid canonical',
              description: 'Canonical URLs prevent duplicate content issues',
              score: 100
            },
            {
              key: 'structured-data',
              title: 'Structured data is valid',
              description: 'Structured data helps search engines understand the page content',
              score: 100
            }
          ]
        },
        // Scan statistics
        scanStats: {
          ...scanStats,
          scannedUrls: [websiteUrl],
          timestamp: new Date().toISOString()
        }
      };

      console.log('SEO Audits:', resultData.seo.audits); // Debug log
      console.log('Structured result data:', resultData);

      setResultId(id);
      localStorage.setItem('analysisResult', JSON.stringify(resultData));
      
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">
            Website Performance Analyzer
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="website"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Enter Website URL
              </label>
              <input
                type="url"
                id="website"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 rounded-md text-white font-semibold ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              }`}
            >
              {loading ? "Analyzing..." : "Analyze Website"}
            </button>
          </form>
        </div>

        {loading && (
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex flex-col items-center">
              <div className="mb-2">Analyzing website...</div>
              <div className="text-sm text-gray-600">
                Pages Scanned: {scanStats.pagesScanned}
                {scanStats.totalPages > 0 && ` / ${scanStats.totalPages}`}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{
                    width: `${
                      scanStats.totalPages
                        ? (scanStats.pagesScanned / scanStats.totalPages) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {resultId && !loading && (
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex flex-col items-center">
              <div className="mb-4 text-green-600 font-medium">
                Analysis completed successfully!
              </div>
              <div className="text-sm text-gray-600 mb-4">
                Analysis ID: {resultId}
              </div>
              <button
                onClick={() => window.open(`/more-results/${resultId}`, '_blank')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                View Detailed Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App component with routing
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AnalyzerForm />} />
        <Route path="/more-results/:id" element={<MoreResults />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
