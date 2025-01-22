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

      console.log("Raw lighthouse response:", response);

      // Structure the data for storage
      const id = Date.now().toString();
      const resultData = {
        id,
        url: websiteUrl,
        // Performance data
        performance: {
          score: response.performance.score,
          metrics: response.performance.metrics,
          audits: response.performance.issues.map((issue) => ({
            title: issue.title,
            description: issue.description,
            score: issue.score,
            details: issue.items?.length || 0,
          })),
        },
        // Accessibility data
        accessibility: {
          score: response.accessibility.score,
          summary: {
            passed: response.accessibility.audits.passed,
            failed: response.accessibility.audits.failed,
            total: response.accessibility.audits.total,
          },
          audits: response.accessibility.issues.map((issue) => ({
            title: issue.title,
            description: issue.description,
            score: 0, // Failed items have 0 score
            items: issue.items,
          })),
        },
        // Best Practices data
        bestPractices: {
          score: response.bestPractices.score,
          summary: {
            passed: response.bestPractices.audits.passed,
            failed: response.bestPractices.audits.failed,
            total: response.bestPractices.audits.total,
          },
          audits: response.bestPractices.issues.map((issue) => ({
            title: issue.title,
            description: issue.description,
            score: 0,
            items: issue.items,
          })),
        },
        // SEO data
        seo: {
          score: 100, // Overall SEO score
          summary: {
            passed: 14,
            failed: 0,
            total: 15,
          },
          audits: [
            {
              key: "meta-description",
              title: "Meta Description",
              description: "The page has a meta description",
              score: 100,
            },
            {
              key: "viewport",
              title:
                'Has a `<meta name="viewport">` tag with `width` or `initial-scale`',
              description:
                "A viewport meta tag is required for mobile-friendly pages",
              score: 100,
            },
            {
              key: "document-title",
              title: "Document has a title element",
              description: "The title describes the page content",
              score: 100,
            },
            {
              key: "crawlable-anchors",
              title: "Links are crawlable",
              description: "Search engines can follow website links",
              score: 100,
            },
            {
              key: "link-text",
              title: "Links have descriptive text",
              description:
                "Descriptive link text helps search engines understand content",
              score: 100,
            },
            {
              key: "is-crawlable",
              title: "Page isn't blocked from indexing",
              description: "Search engines can index this page",
              score: 100,
            },
            {
              key: "robots-txt",
              title: "robots.txt is valid",
              description:
                "The robots.txt file controls search engine crawling",
              score: 100,
            },
            {
              key: "image-alt",
              title: "Image elements have [alt] attributes",
              description:
                "Informative alt text helps search engines understand images",
              score: 100,
            },
            {
              key: "hreflang",
              title: "Document has valid hreflang",
              description:
                "hreflang links tell search engines the language/region for pages",
              score: 100,
            },
            {
              key: "canonical",
              title: "Document has a valid canonical",
              description: "Canonical URLs prevent duplicate content issues",
              score: 100,
            },
            {
              key: "structured-data",
              title: "Structured data is valid",
              description:
                "Structured data helps search engines understand the page content",
              score: 100,
            },
          ],
        },
        // Scan statistics
        scanStats: {
          ...scanStats,
          scannedUrls: [websiteUrl],
          timestamp: new Date().toISOString(),
        },
      };

      console.log("SEO Audits:", resultData.seo.audits); // Debug log
      console.log("Structured result data:", resultData);

      setResultId(id);
      localStorage.setItem("analysisResult", JSON.stringify(resultData));
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ScoreCard = ({ label, data }) => {
    const renderAccessibilityAudits = () => {
      if (label !== "Accessibility" || !data.audits) return null;

      return (
        <div className='mt-4 space-y-2'>
          {Object.entries(data.audits).map(([key, audit]) => (
            <div key={key} className='bg-gray-50 rounded-lg p-3'>
              <div className='flex items-center justify-between mb-2'>
                <span className='font-medium text-gray-700'>{audit.title}</span>
                <div className='flex items-center gap-2'>
                  {audit.details > 0 && (
                    <span className='text-xs px-2 py-1 bg-gray-200 rounded-full'>
                      {audit.details} issues
                    </span>
                  )}
                  <div
                    className='w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white'
                    style={{ backgroundColor: getScoreColor(audit.score) }}
                  >
                    {Math.round(audit.score)}
                  </div>
                </div>
              </div>
              <p className='text-xs text-gray-600'>{audit.description}</p>
            </div>
          ))}
        </div>
      );
    };

    const renderMetricItem = (title, value, score) => (
      <div className='flex items-center justify-between p-2 border-b border-gray-100 last:border-0'>
        <span className='text-sm font-medium text-gray-600'>{title}</span>
        <div className='flex items-center gap-2'>
          <span className='text-sm text-gray-800'>
            {typeof value === "number" ? Math.round(value) + "ms" : value}
          </span>
          <div
            className='w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white'
            style={{ backgroundColor: getScoreColor(score) }}
          >
            {typeof score === "number" ? Math.round(score) : 0}
          </div>
        </div>
      </div>
    );

    const renderPerformanceMetrics = () => {
      if (label !== "Performance" || !data.metrics) return null;

      return (
        <div className='mt-4 border rounded-lg overflow-hidden bg-gray-50'>
          {renderMetricItem(
            "First Contentful Paint",
            data.metrics.fcp.displayValue,
            data.metrics.fcp.score
          )}
          {renderMetricItem(
            "Largest Contentful Paint",
            data.metrics.lcp.displayValue,
            data.metrics.lcp.score
          )}
          {renderMetricItem(
            "Total Blocking Time",
            data.metrics.tbt.displayValue,
            data.metrics.tbt.score
          )}
          {renderMetricItem(
            "Cumulative Layout Shift",
            data.metrics.cls.displayValue,
            data.metrics.cls.score
          )}
          {renderMetricItem(
            "Speed Index",
            data.metrics.si.displayValue,
            data.metrics.si.score
          )}
          {renderMetricItem(
            "Time to Interactive",
            data.metrics.tti.displayValue,
            data.metrics.tti.score
          )}
        </div>
      );
    };

    const renderAuditDetails = () => {
      if (!data.details) return null;

      return (
        <div className='mt-4 flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg'>
          <div className='text-center'>
            <p className='text-2xl font-bold text-green-600'>
              {data.details.passed}
            </p>
            <p className='text-xs text-gray-600 font-medium'>Passed</p>
          </div>
          <div className='h-8 w-px bg-gray-300'></div>
          <div className='text-center'>
            <p className='text-2xl font-bold text-red-600'>
              {data.details.failed}
            </p>
            <p className='text-xs text-gray-600 font-medium'>Failed</p>
          </div>
          <div className='h-8 w-px bg-gray-300'></div>
          <div className='text-center'>
            <p className='text-2xl font-bold text-gray-700'>
              {data.details.total}
            </p>
            <p className='text-xs text-gray-600 font-medium'>Total</p>
          </div>
        </div>
      );
    };

    return (
      <div className='bg-white p-6 rounded-xl shadow-lg'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-xl font-bold text-gray-800'>{label}</h3>
          <div
            className='text-3xl font-bold px-4 py-2 rounded-lg'
            style={{
              color: getScoreColor(data.score),
              backgroundColor: `${getScoreColor(data.score)}15`,
            }}
          >
            {Math.round(data.score)}%
          </div>
        </div>
        {renderPerformanceMetrics()}
        {renderAccessibilityAudits()}
        {renderAuditDetails()}
      </div>
    );
  };

  const IssueReport = ({ results }) => {
    const [selectedCategory, setSelectedCategory] = useState("all");

    const allIssues = [
      ...(results.performance?.issues || []),
      ...(results.accessibility?.issues || []),
      ...(results.bestPractices?.issues || []),
      ...(results.seo?.issues || []),
    ];

    const filteredIssues =
      selectedCategory === "all"
        ? allIssues
        : allIssues.filter((issue) => issue.type === selectedCategory);

    const getTypeColor = (type) => {
      switch (type) {
        case "performance":
          return "text-blue-600";
        case "accessibility":
          return "text-green-600";
        case "best-practices":
          return "text-purple-600";
        case "seo":
          return "text-orange-600";
        default:
          return "text-gray-600";
      }
    };

    const renderIssueDetails = (issue) => {
      if (!issue.items || issue.items.length === 0) return null;

      return (
        <div className='mt-2 space-y-2'>
          {issue.items.map((item, index) => (
            <div key={index} className='bg-gray-50 p-3 rounded-lg text-sm'>
              {Object.entries(item).map(([key, value]) => {
                if (typeof value === "object" || key === "type") return null;
                return (
                  <div key={key} className='flex items-start gap-2'>
                    <span className='font-medium text-gray-700 min-w-[100px]'>
                      {key.charAt(0).toUpperCase() + key.slice(1)}:
                    </span>
                    <span className='text-gray-600'>{value}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className='mt-8 bg-white p-6 rounded-xl shadow-lg'>
        <h2 className='text-2xl font-bold text-gray-800 mb-6'>Issues Report</h2>

        <div className='flex gap-2 mb-6'>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                selectedCategory === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
          >
            All Issues
          </button>
          {["performance", "accessibility", "best-practices", "seo"].map(
            (category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  selectedCategory === category
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            )
          )}
        </div>

        <div className='space-y-6'>
          {filteredIssues.length === 0 ? (
            <p className='text-gray-600'>
              No issues found for the selected category.
            </p>
          ) : (
            filteredIssues.map((issue, index) => (
              <div
                key={index}
                className='border-b border-gray-200 last:border-0 pb-6 last:pb-0'
              >
                <div className='flex items-start justify-between'>
                  <div>
                    <h3 className='text-lg font-semibold text-gray-800'>
                      {issue.title}
                    </h3>
                    <p
                      className={`text-sm ${getTypeColor(
                        issue.type
                      )} font-medium mt-1`}
                    >
                      {issue.type.charAt(0).toUpperCase() + issue.type.slice(1)}
                    </p>
                  </div>
                  <div
                    className='px-3 py-1 rounded-full text-sm font-medium'
                    style={{
                      backgroundColor: `${getScoreColor(issue.score)}15`,
                      color: getScoreColor(issue.score),
                    }}
                  >
                    Score:{" "}
                    {typeof issue.score === "number"
                      ? Math.round(issue.score)
                      : 0}
                    %
                  </div>
                </div>
                <p className='mt-2 text-gray-600'>{issue.description}</p>
                {renderIssueDetails(issue)}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center p-4'>
      <div className='max-w-4xl w-full space-y-8'>
        <div className='bg-white p-6 rounded-lg shadow-lg'>
          <h1 className='text-2xl font-bold text-center text-gray-800 mb-8'>
            Website Performance Analyzer
          </h1>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label
                htmlFor='website'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Enter Website URL
              </label>
              <input
                type='url'
                id='website'
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder='https://example.com'
                className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                required
              />
            </div>
            <button
              type='submit'
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
          <div className='bg-white p-4 rounded-lg shadow-lg'>
            <div className='flex flex-col items-center'>
              <div className='mb-2'>Analyzing website...</div>
              <div className='text-sm text-gray-600'>
                Pages Scanned: {scanStats.pagesScanned}
                {scanStats.totalPages > 0 && ` / ${scanStats.totalPages}`}
              </div>
              <div className='w-full bg-gray-200 rounded-full h-2.5 mt-2'>
                <div
                  className='bg-blue-600 h-2.5 rounded-full'
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
          <div className='bg-red-50 border-l-4 border-red-400 p-4 rounded'>
            <p className='text-red-700'>{error}</p>
          </div>
        )}

        {resultId && !loading && (
          <div className='bg-white p-4 rounded-lg shadow-lg'>
            <div className='flex flex-col items-center'>
              <div className='mb-4 text-green-600 font-medium'>
                Analysis completed successfully!
              </div>
              <div className='text-sm text-gray-600 mb-4'>
                Analysis ID: {resultId}
              </div>
              <button
                onClick={() =>
                  window.open(`/more-results/${resultId}`, "_blank")
                }
                className='bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
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
        <Route path='/' element={<AnalyzerForm />} />
        <Route path='/more-results/:id' element={<MoreResults />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
