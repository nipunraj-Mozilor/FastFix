import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { runLighthouseAnalysis } from "../services/lighthouse";
import { getAIAnalysis, getIssueRecommendations } from "../services/langchain";
import { supabase } from "../lib/supabase";

function Analyzer() {
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
  const [analysisId, setAnalysisId] = useState(null);

  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      loadAnalysis(id);
    }
  }, [id]);

  const loadAnalysis = async (id) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("website_analyses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setWebsiteUrl(data.website_url);
        setResults({
          performance: data.lighthouse_results.performance,
          accessibility: data.lighthouse_results.accessibility,
          bestPractices: data.lighthouse_results.bestPractices,
          seo: data.lighthouse_results.seo,
        });
        setAiAnalysis(data.ai_analysis);
        setScanStats(data.scan_stats);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getImpactLabel = (impact, type) => {
    const impactNum = parseFloat(impact);
    const thresholds = {
      performance: {
        critical: 25,
        high: 15,
        medium: 8,
      },
      accessibility: {
        critical: 15,
        high: 10,
        medium: 5,
      },
      "best-practices": {
        critical: 20,
        high: 12,
        medium: 6,
      },
      seo: {
        critical: 18,
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
      const { data: analysis, error: dbError } = await supabase
        .from("website_analyses")
        .insert([
          {
            website_url: websiteUrl,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      setAnalysisId(analysis.id);

      const response = await runLighthouseAnalysis(websiteUrl, (progress) => {
        setScanStats(progress);
      });

      setResults({
        performance: response.performance,
        accessibility: response.accessibility,
        bestPractices: response.bestPractices,
        seo: response.seo,
      });

      setAiLoading(true);
      const aiAnalysisResult = await getAIAnalysis(response);
      setAiAnalysis(aiAnalysisResult);

      const finalScanStats = {
        pagesScanned:
          response.scanStats?.pagesScanned || scanStats.pagesScanned,
        totalPages: response.scanStats?.totalPages || scanStats.totalPages,
        scannedUrls: response.scanStats?.scannedUrls || scanStats.scannedUrls,
      };

      const { error: updateError } = await supabase
        .from("website_analyses")
        .update({
          status: "completed",
          performance_score: response.performance.score,
          accessibility_score: response.accessibility.score,
          best_practices_score: response.bestPractices.score,
          seo_score: response.seo.score,
          scan_stats: finalScanStats,
          lighthouse_results: {
            performance: response.performance,
            accessibility: response.accessibility,
            bestPractices: response.bestPractices,
            seo: response.seo,
          },
          ai_analysis: aiAnalysisResult,
        })
        .eq("id", analysis.id);

      if (updateError) throw updateError;

      setScanStats(finalScanStats);

      navigate(`/analyze/${analysis.id}`);
    } catch (err) {
      setError(err.message);
      if (analysisId) {
        await supabase
          .from("website_analyses")
          .update({
            status: "failed",
            scan_stats: scanStats,
          })
          .eq("id", analysisId);
      }
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  };

  const ScoreCard = ({ label, data }) => {
    if (!data) return null;

    const renderMetricItem = (title, value, score) => {
      const displayValue =
        typeof value === "object" ? value.displayValue || value.value : value;
      const displayScore = typeof value === "object" ? value.score || 0 : score;

      return (
        <div
          key={title}
          className='flex items-center justify-between p-2 border-b border-gray-100 last:border-0'
        >
          <span className='text-sm font-medium text-gray-600'>{title}</span>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-gray-800'>
              {typeof displayValue === "number"
                ? Math.round(displayValue) + "ms"
                : displayValue}
            </span>
            <div
              className='w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white'
              style={{ backgroundColor: getScoreColor(displayScore) }}
            >
              {typeof displayScore === "number" ? Math.round(displayScore) : 0}
            </div>
          </div>
        </div>
      );
    };

    const renderPerformanceMetrics = () => {
      if (label !== "Performance" || !data.metrics) return null;

      return (
        <div className='mt-4 border rounded-lg overflow-hidden bg-gray-50'>
          {data.metrics.fcp &&
            renderMetricItem("First Contentful Paint", data.metrics.fcp)}
          {data.metrics.lcp &&
            renderMetricItem("Largest Contentful Paint", data.metrics.lcp)}
          {data.metrics.tbt &&
            renderMetricItem("Total Blocking Time", data.metrics.tbt)}
          {data.metrics.cls &&
            renderMetricItem("Cumulative Layout Shift", data.metrics.cls)}
          {data.metrics.si && renderMetricItem("Speed Index", data.metrics.si)}
          {data.metrics.tti &&
            renderMetricItem("Time to Interactive", data.metrics.tti)}
        </div>
      );
    };

    const renderAccessibilityMetrics = () => {
      if (label !== "Accessibility" || !data.issues) return null;

      const findIssue = (keywords) => {
        return data.issues.find((i) =>
          keywords.some((keyword) => i.title.toLowerCase().includes(keyword))
        );
      };

      const metrics = {
        colorContrast: findIssue(["contrast", "color"]),
        headings: findIssue(["heading", "h1", "h2", "h3", "header"]),
        aria: findIssue(["aria", "accessible name", "role"]),
        imageAlts: findIssue(["image", "alt", "img"]),
        linkNames: findIssue(["link", "anchor", "href"]),
      };

      return (
        <div className='mt-4 border rounded-lg overflow-hidden bg-gray-50'>
          {Object.entries(metrics).map(([key, issue]) => {
            const title = {
              colorContrast: "Color Contrast",
              headings: "Headings",
              aria: "ARIA",
              imageAlts: "Image Alts",
              linkNames: "Link Names",
            }[key];

            return renderMetricItem(
              title,
              issue ? `${issue.items?.length || 0} issues` : "Pass",
              issue ? issue.score : 100
            );
          })}
        </div>
      );
    };

    const renderSEOMetrics = () => {
      if (label !== "SEO" || !data.issues) return null;

      const findIssue = (keywords) => {
        return data.issues.find((i) =>
          keywords.some((keyword) => i.title.toLowerCase().includes(keyword))
        );
      };

      const metrics = {
        metaDescription: findIssue(["meta description", "meta"]),
        titleTags: findIssue(["title tag", "title element"]),
        headingStructure: findIssue([
          "heading",
          "h1",
          "h2",
          "h3",
          "header structure",
        ]),
        mobileOptimization: findIssue(["mobile", "viewport", "responsive"]),
        urlStructure: findIssue(["url", "slug", "permalink"]),
      };

      return (
        <div className='mt-4 border rounded-lg overflow-hidden bg-gray-50'>
          {Object.entries(metrics).map(([key, issue]) => {
            const title = {
              metaDescription: "Meta Description",
              titleTags: "Title Tags",
              headingStructure: "Heading Structure",
              mobileOptimization: "Mobile Optimization",
              urlStructure: "URL Structure",
            }[key];

            return renderMetricItem(
              title,
              issue ? `${issue.items?.length || 0} issues` : "Pass",
              issue ? issue.score : 100
            );
          })}
        </div>
      );
    };

    const renderBestPracticesMetrics = () => {
      if (label !== "Best Practices" || !data.issues) return null;

      const findIssue = (keywords) => {
        return data.issues.find((i) =>
          keywords.some((keyword) => i.title.toLowerCase().includes(keyword))
        );
      };

      const metrics = {
        https: findIssue(["https", "ssl", "secure"]),
        doctype: findIssue(["doctype", "html5", "document type"]),
        javascriptErrors: findIssue(["javascript", "error", "console"]),
        mobileFriendly: findIssue(["mobile", "viewport", "responsive"]),
        browserCompatibility: findIssue([
          "browser",
          "compatibility",
          "support",
        ]),
      };

      return (
        <div className='mt-4 border rounded-lg overflow-hidden bg-gray-50'>
          {Object.entries(metrics).map(([key, issue]) => {
            const title = {
              https: "HTTPS Usage",
              doctype: "Valid Doctype",
              javascriptErrors: "No JavaScript Errors",
              mobileFriendly: "Mobile Friendly",
              browserCompatibility: "Browser Compatibility",
            }[key];

            const symbol = !issue ? "✓" : "✗";
            const symbolColor = !issue ? "text-green-600" : "text-red-600";

            return (
              <div
                key={key}
                className='flex items-center justify-between p-2 border-b border-gray-100 last:border-0'
              >
                <span className='text-sm font-medium text-gray-600'>
                  {title}
                </span>
                <div className='flex items-center'>
                  <span className={`text-2xl font-bold ${symbolColor}`}>
                    {symbol}
                  </span>
                </div>
              </div>
            );
          })}
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
        {label === "Performance" && renderPerformanceMetrics()}
        {label === "Accessibility" && renderAccessibilityMetrics()}
        {label === "SEO" && renderSEOMetrics()}
        {label === "Best Practices" && renderBestPracticesMetrics()}
        {renderAuditDetails()}
      </div>
    );
  };

  const IssueReport = ({ results }) => {
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [expandedRecommendations, setExpandedRecommendations] = useState({});
    const [aiRecommendations, setAiRecommendations] = useState({});
    const [loadingStates, setLoadingStates] = useState({});
    const [validationResults, setValidationResults] = useState({});

    const toggleRecommendations = async (issueIndex, issue) => {
      const newExpandedState = !expandedRecommendations[issueIndex];
      setExpandedRecommendations((prev) => ({
        ...prev,
        [issueIndex]: newExpandedState,
      }));

      if (newExpandedState && !aiRecommendations[issueIndex]) {
        try {
          setLoadingStates((prev) => ({
            ...prev,
            [issueIndex]: true,
          }));

          const recommendations = await getIssueRecommendations(issue);
          setAiRecommendations((prev) => ({
            ...prev,
            [issueIndex]: recommendations,
          }));
        } catch (error) {
          console.error("Failed to get AI recommendations:", error);
        } finally {
          setLoadingStates((prev) => ({
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
      <div className='mt-8 bg-white p-6 rounded-xl shadow-lg max-w-4xl w-full'>
        <h2 className='text-2xl font-bold text-gray-800 mb-6'>Issues Report</h2>

        <div className='flex gap-2 mb-6'>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ${
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ${
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

        <div className='flex justify-end gap-4 mb-6'>
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
            className='px-6 py-3 bg-black text-white rounded-lg font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors'
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

              <button
                onClick={() => toggleRecommendations(index, issue)}
                className='mt-4 text-white hover:text-blue-800 flex items-center gap-2'
              >
                {expandedRecommendations[index] ? "Hide" : "Show"} AI
                Recommendations
                <svg
                  className={`w-4 h-4 transition-transform ${
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
              </button>

              {expandedRecommendations[index] && (
                <div className='mt-4'>
                  {loadingStates[index] ? (
                    <div className='flex justify-center'>
                      <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
                    </div>
                  ) : (
                    <div className='space-y-4'>
                      {aiRecommendations[index]?.map((rec, recIndex) => (
                        <div
                          key={recIndex}
                          className='bg-gray-50 rounded-lg p-4'
                        >
                          <div className='flex justify-end mb-2'>
                            <span className='bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded'>
                              AI Generated
                            </span>
                          </div>

                          <h4 className='font-medium text-gray-800 mb-2'>
                            {rec.suggestion}
                          </h4>

                          {rec.implementation && (
                            <div className='bg-green-50 p-3 rounded-lg mt-2'>
                              <span className='font-medium text-green-700'>
                                Implementation:
                              </span>
                              <p className='mt-1 text-green-800'>
                                {rec.implementation}
                              </p>
                            </div>
                          )}

                          {rec.expectedImpact && (
                            <div className='bg-blue-50 p-3 rounded-lg mt-2'>
                              <span className='font-medium text-blue-700'>
                                Expected Impact:
                              </span>
                              <p className='mt-1 text-blue-800'>
                                {rec.expectedImpact}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {validationResults[issue.title] && (
                <div
                  className={`mt-3 p-3 rounded-lg ${
                    validationResults[issue.title].status === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {validationResults[issue.title].message}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className='w-full min-h-screen bg-gray-100 text-black'>
      <div className='fixed top-4 left-4'>
        <img src='/logo.svg' alt='Logo' className='w-28 h-12' />
      </div>

      <div className='flex flex-col items-center min-h-screen px-8 py-16'>
        <div className='max-w-2xl'>
          <h4 className='text-3xl font-bold mb-4 text-center'>
            AI-Powered Website Performance Optimization
          </h4>
          <p className='text-gray-600 text-center text-md mb-8'>
            Automatically analyze and optimize your website's performance with
            our advanced AI tools. Improve load times, SEO rankings, and user
            experience.
          </p>
          <form onSubmit={handleSubmit} className='w-full flex gap-4'>
            <input
              type='url'
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder='Enter your website URL'
              required
              className='flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'
            />
            <div className='flex gap-4'>
              <button
                type='submit'
                disabled={loading}
                className='px-6 py-3 bg-black text-white rounded-lg font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? (
                  <>
                    <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-white'></div>
                    Analyzing...
                  </>
                ) : (
                  <>
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
                        d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                      />
                    </svg>
                    Analyze Now
                  </>
                )}
              </button>
              <button
                type='button'
                onClick={() => navigate("/github-config")}
                className='px-6 py-3 bg-black text-white rounded-lg font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors'
              >
                <svg
                  className='w-5 h-5'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z' />
                </svg>
                GitHub
              </button>
            </div>
          </form>
        </div>

        {loading && (
          <div className='max-w-2xl w-full mt-4 bg-white p-4 rounded-lg shadow-lg'>
            <div className='flex flex-col items-center'>
              <div className='mb-2'>Assessing website performance...</div>
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
                  <div className='max-h-40 overflow-y-auto bg-gray-50 rounded pt-2 px-4 pb-2'>
                    {scanStats.scannedUrls.map((url, index) => (
                      <div
                        key={index}
                        className='text-xs text-gray-600 border-b border-gray-200 last:border-0 first:pt-0 py-3'
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
            <div className='bg-white p-8 rounded-lg shadow-lg mt-4 max-w-4xl w-full'>
              <h2 className='text-xl font-bold text-gray-800 mb-6'>
                Analysis Results
              </h2>

              {aiLoading ? (
                <div className='flex items-center justify-center p-4'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                </div>
              ) : (
                <div className='bg-[#F8FAFC] p-8 rounded-lg'>
                  <div className='flex items-center gap-2 mb-6'>
                    <svg
                      className='w-6 h-6'
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
                    <h3 className='text-xl font-semibold'>AI Insights</h3>
                  </div>

                  <div className='space-y-6'>
                    {/* Overall Assessment */}
                    <div>
                      <h4 className='text-lg font-medium mb-4'>
                        1. Overall Assessment:
                      </h4>
                      <div className='bg-white p-4 rounded-lg'>
                        <div className='mb-2'>
                          <div className='flex justify-between mb-2 font-medium'>
                            <span>Performance Score</span>
                            <span>
                              {Math.round(results.performance.score)}%
                            </span>
                          </div>
                          <div className='w-full bg-gray-200 rounded-full h-2'>
                            <div
                              className='bg-black rounded-full h-2'
                              style={{
                                width: `${results.performance.score}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <p className='text-gray-600'>
                          {aiAnalysis
                            ?.split("2. Critical Issues:")[0]
                            ?.replace("1. Overall Assessment:", "")
                            ?.trim()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className='text-lg font-medium mb-4'>
                        2. Critical Issues:
                      </h4>
                      <div className='bg-white p-4 rounded-lg mb-2'>
                        <p className='text-gray-600'>
                          {aiAnalysis
                            ?.split("2. Critical Issues:")[1]
                            ?.split("3. Key Recommendations:")[0]
                            ?.trim()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className='text-lg font-medium mb-4'>
                        3. Key Recommendations:
                      </h4>
                      <div className='bg-white p-4 rounded-lg mb-2'>
                        <p className='text-gray-600'>
                          {aiAnalysis
                            ?.split("3. Key Recommendations:")[1]
                            ?.trim()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className='text-lg font-semibold text-gray-600 my-6'>
                <div>Total Pages Scanned: {scanStats.pagesScanned}</div>
                {scanStats.scannedUrls.length > 0 && (
                  <div className='mt-4 p-4 bg-gray-50 rounded-lg'>
                    <h3 className='font-medium mb-2'>Scanned URLs:</h3>
                    <div className='max-h-40 overflow-y-auto bg-gray-50 rounded p-2'>
                      {scanStats.scannedUrls.map((url, index) => (
                        <div
                          key={index}
                          className='text-xs text-gray-600 border-b border-gray-200 last:border-0 first:pt-0 py-3'
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

export default Analyzer;
