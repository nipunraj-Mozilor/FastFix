import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { runLighthouseAnalysis } from "./services/lighthouse";
import { getAIAnalysis, getIssueRecommendations } from "./services/langchain";
import AIFix from "./pages/AIFix";

function App() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [scanStats, setScanStats] = useState({
    pagesScanned: 0,
    totalPages: 0,
    scannedUrls: [],
  });

  const navigate = useNavigate();

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
    setAiAnalysis(null);
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

      // Get AI Analysis
      setAiLoading(true);
      const analysis = await getAIAnalysis(response);
      setAiAnalysis(analysis);

      // Final scan stats update
      if (response.scanStats) {
        setScanStats(response.scanStats);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setAiLoading(false);
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
    const [expandedRecommendations, setExpandedRecommendations] = useState({});
    const [aiRecommendations, setAiRecommendations] = useState({});
    const [loadingRecommendations, setLoadingRecommendations] = useState({});

    const toggleRecommendations = async (issueIndex, issue) => {
      setExpandedRecommendations((prev) => ({
        ...prev,
        [issueIndex]: !prev[issueIndex],
      }));

      // If expanding and no recommendations exist, get AI recommendations
      if (
        !expandedRecommendations[issueIndex] &&
        (!issue.recommendations || issue.recommendations.length === 0) &&
        !aiRecommendations[issueIndex]
      ) {
        try {
          console.log("Getting AI recommendations for issue:", issue);
          setLoadingRecommendations((prev) => ({
            ...prev,
            [issueIndex]: true,
          }));
          const recommendations = await getIssueRecommendations(issue);
          console.log("AI recommendations:", recommendations);
          setAiRecommendations((prev) => ({
            ...prev,
            [issueIndex]: recommendations,
          }));
        } catch (error) {
          console.error("Failed to get AI recommendations:", error);
        } finally {
          setLoadingRecommendations((prev) => ({
            ...prev,
            [issueIndex]: false,
          }));
        }
      }
    };

    const allIssues = [
      ...(results.performance?.issues || []),
      ...(results.accessibility?.issues || []),
      ...(results.bestPractices?.issues || []),
      ...(results.seo?.issues || []),
    ].sort((a, b) => parseFloat(b.impact) - parseFloat(a.impact));

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

    const getImpactLabel = (impact, type) => {
      const impactNum = parseFloat(impact);

      // Different thresholds based on category
      const thresholds = {
        performance: {
          critical: 25, // Performance issues have higher impact thresholds
          high: 15,
          medium: 8,
        },
        accessibility: {
          critical: 15, // Accessibility issues often have medium-range impacts
          high: 10,
          medium: 5,
        },
        "best-practices": {
          critical: 20, // Best practices can significantly affect overall quality
          high: 12,
          medium: 6,
        },
        seo: {
          critical: 18, // SEO issues can have varying levels of impact
          high: 10,
          medium: 5,
        },
      };

      const categoryThresholds = thresholds[type] || thresholds.performance;

      if (impactNum >= categoryThresholds.critical) return "Critical";
      if (impactNum >= categoryThresholds.high) return "High";
      if (impactNum >= categoryThresholds.medium) return "Medium";
      return "Low";
    };

    const getImpactColor = (impact, type) => {
      const label = getImpactLabel(impact, type);
      switch (label) {
        case "Critical":
          return "bg-red-100 text-red-800";
        case "High":
          return "bg-orange-100 text-orange-800";
        case "Medium":
          return "bg-yellow-100 text-yellow-800";
        default:
          return "bg-green-100 text-green-800";
      }
    };

    return (
      <div className='mt-8 bg-white p-6 rounded-xl shadow-lg'>
        <h2 className='text-2xl font-bold text-gray-800 mb-6'>Issues Report</h2>

        <div className='flex gap-2 mb-6'>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All Issues
          </button>
          {["performance", "accessibility", "best-practices", "seo"].map(
            (type) => (
              <button
                key={type}
                onClick={() => setSelectedCategory(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === type
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            )
          )}
        </div>

        <div className='flex justify-end mb-6'>
          <button
            onClick={() => {
              const allIssues = [
                ...(results.performance?.issues || []),
                ...(results.accessibility?.issues || []),
                ...(results.bestPractices?.issues || []),
                ...(results.seo?.issues || []),
              ];
              navigate("/ai-fix", {
                state: {
                  issues: allIssues,
                  websiteUrl,
                  scanStats,
                },
              });
            }}
            className='px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-colors flex items-center gap-2'
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 10V3L4 14h7v7l9-11h-7z'
              />
            </svg>
            Get AI Fix
          </button>
        </div>

        <div className='space-y-6'>
          {filteredIssues.map((issue, index) => (
            <div
              key={index}
              className='border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow'
            >
              <div className='flex items-start justify-between mb-3'>
                <div>
                  <div className='flex items-center gap-2 mb-1'>
                    <span className={`font-medium ${getTypeColor(issue.type)}`}>
                      {issue.type.charAt(0).toUpperCase() + issue.type.slice(1)}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getImpactColor(
                        issue.impact,
                        issue.type
                      )}`}
                    >
                      {getImpactLabel(issue.impact, issue.type)} Impact (
                      {issue.impact}%)
                    </span>
                  </div>
                  <h3 className='text-lg font-semibold text-gray-800'>
                    {issue.title}
                  </h3>
                </div>
                <div
                  className='w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium text-white'
                  style={{ backgroundColor: getScoreColor(issue.score / 100) }}
                >
                  {Math.round(issue.score)}
                </div>
              </div>

              <p className='text-gray-600 mb-4'>{issue.description}</p>

              {(issue.recommendations?.length > 0 ||
                !expandedRecommendations[index]) && (
                <div className='mt-4'>
                  <div
                    onClick={() => toggleRecommendations(index, issue)}
                    className='flex items-center gap-2 cursor-pointer group'
                  >
                    <h4 className='font-medium text-gray-800 group-hover:text-gray-600 transition-colors'>
                      {issue.recommendations?.length > 0
                        ? "Recommendations:"
                        : "Get AI Recommendations"}
                    </h4>
                    <svg
                      className={`w-4 h-4 text-gray-600 transition-transform group-hover:text-gray-500 ${
                        expandedRecommendations[index] ? "rotate-180" : ""
                      }`}
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </div>

                  {expandedRecommendations[index] && (
                    <div className='space-y-3 mt-2'>
                      {loadingRecommendations[index] ? (
                        <div className='flex items-center justify-center p-4'>
                          <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
                        </div>
                      ) : (
                        <>
                          {(
                            issue.recommendations ||
                            aiRecommendations ||
                            []
                          ).map((rec, idx) => (
                            <div
                              key={idx}
                              className='bg-gray-50 rounded-lg p-4 space-y-3'
                            >
                              {!issue.recommendations && (
                                <div className='flex justify-end mb-2'>
                                  <span className='bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded'>
                                    AI Generated
                                  </span>
                                </div>
                              )}

                              <h4 className='font-medium text-gray-800'>
                                {rec.suggestion}
                              </h4>

                              {rec.implementation && (
                                <div className='bg-green-50 p-3 rounded-lg border border-green-100'>
                                  <span className='font-medium text-green-700'>
                                    Implementation:
                                  </span>
                                  <p className='mt-1 text-green-800'>
                                    {rec.implementation}
                                  </p>
                                </div>
                              )}

                              {rec.codeExample && (
                                <div className='bg-purple-50 p-3 rounded-lg border border-purple-100'>
                                  <span className='font-medium text-purple-700'>
                                    Code Example:
                                  </span>
                                  <pre className='mt-2 p-3 bg-purple-100 rounded overflow-x-auto'>
                                    <code className='text-purple-800'>
                                      {rec.codeExample}
                                    </code>
                                  </pre>
                                </div>
                              )}

                              {rec.expectedImpact && (
                                <div className='bg-blue-50 p-3 rounded-lg border border-blue-100'>
                                  <span className='font-medium text-blue-700'>
                                    Expected Impact:
                                  </span>
                                  <p className='mt-1 text-blue-800'>
                                    {rec.expectedImpact}
                                  </p>
                                </div>
                              )}

                              {rec.selector && (
                                <div className='flex items-center gap-2 text-sm mb-2 bg-blue-50 p-2 rounded-lg border border-blue-100'>
                                  <span className='font-medium text-blue-700 whitespace-nowrap'>
                                    Element:
                                  </span>
                                  <code className='bg-blue-100 px-2 py-1 rounded text-blue-800 flex-1 overflow-x-auto'>
                                    {rec.selector}
                                  </code>
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Routes>
      <Route
        path='/'
        element={
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
                    <div className='text-sm text-grey-600'>
                      Pages Scanned:{" "}
                      <span className='text-black-600 font-bold'>
                        {scanStats.pagesScanned}
                        {scanStats.totalPages > 0 &&
                          ` / ${scanStats.totalPages}`}
                      </span>
                    </div>
                    <div className='w-full bg-gray-200 rounded-full h-2.5 mt-2 mb-4'>
                      <div
                        className='bg-blue-600 h-2.5 rounded-full'
                        style={{
                          width: `${
                            scanStats.totalPages
                              ? (scanStats.pagesScanned /
                                  scanStats.totalPages) *
                                100
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

                    {/* AI Analysis Section */}
                    {aiAnalysis && (
                      <div className='mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100'>
                        <div className='flex items-center gap-2 mb-3'>
                          <svg
                            className='w-6 h-6 text-blue-600'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M13 10V3L4 14h7v7l9-11h-7z'
                            />
                          </svg>
                          <h3 className='text-lg font-semibold text-gray-800'>
                            AI Insights
                          </h3>
                        </div>
                        {aiLoading ? (
                          <div className='flex items-center justify-center p-4'>
                            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                          </div>
                        ) : (
                          <div className='prose prose-blue max-w-none'>
                            {aiAnalysis.split("\n").map((line, index) => (
                              <p key={index} className='text-gray-700 mb-2'>
                                {line}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
                      <ScoreCard
                        label='Performance'
                        data={results.performance}
                      />
                      <ScoreCard
                        label='Accessibility'
                        data={results.accessibility}
                      />
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
        }
      />
      <Route path='/ai-fix' element={<AIFix />} />
    </Routes>
  );
}

export default App;
