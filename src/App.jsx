import { useState, useEffect } from "react";
import { runLighthouseAnalysis } from "./services/lighthouse";

function App() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [scanStats, setScanStats] = useState({
    pagesScanned: 0,
    totalPages: 0,
    scannedUrls: [],
  });

  // Shared utility function for score colors
  const getScoreColor = (score) => {
    if (typeof score !== "number" || isNaN(score)) return "#ef4444";
    return score >= 90 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setScanStats({ pagesScanned: 0, totalPages: 0, scannedUrls: [] });

    try {
      const response = await runLighthouseAnalysis(websiteUrl, (progress) => {
        // Update scan stats with progress
        setScanStats(progress);
      });

      setResults({
        performance: response.performance,
        accessibility: response.accessibility,
        bestPractices: response.bestPractices,
        seo: response.seo,
      });

      // Final scan stats update
      if (response.scanStats) {
        setScanStats(response.scanStats);
      }
    } catch (err) {
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
              <div className='w-full bg-gray-200 rounded-full h-2.5 mt-2 mb-4'>
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
              {scanStats.scannedUrls.length > 0 && (
                <div className='w-full mt-4'>
                  <h3 className='text-sm font-medium text-gray-700 mb-2'>
                    Scanned URLs:
                  </h3>
                  <div className='max-h-40 overflow-y-auto bg-gray-50 rounded p-2'>
                    {scanStats.scannedUrls.map((url, index) => (
                      <div
                        key={index}
                        className='text-xs text-gray-600 py-1 border-b border-gray-200 last:border-0'
                      >
                        {url}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className='bg-red-50 border-l-4 border-red-400 p-4 rounded'>
            <p className='text-red-700'>{error}</p>
          </div>
        )}

        {results && (
          <>
            <div className='bg-white p-6 rounded-lg shadow-lg'>
              <h2 className='text-xl font-bold text-gray-800 mb-4'>
                Analysis Results
              </h2>
              <div className='text-sm text-gray-600 mb-4'>
                <div>Total Pages Scanned: {scanStats.pagesScanned}</div>
                {scanStats.scannedUrls.length > 0 && (
                  <div className='mt-4'>
                    <h3 className='font-medium mb-2'>Scanned URLs:</h3>
                    <div className='max-h-40 overflow-y-auto bg-gray-50 rounded p-2'>
                      {scanStats.scannedUrls.map((url, index) => (
                        <div
                          key={index}
                          className='text-xs text-gray-600 py-1 border-b border-gray-200 last:border-0'
                        >
                          {url}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <ScoreCard label='Performance' data={results.performance} />
                <ScoreCard label='Accessibility' data={results.accessibility} />
                <ScoreCard
                  label='Best Practices'
                  data={results.bestPractices}
                />
                <ScoreCard label='SEO' data={results.seo} />
              </div>
            </div>
            <IssueReport results={results} />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
