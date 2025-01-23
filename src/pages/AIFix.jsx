import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getFixSuggestions, applyFix, validateFix } from "../services/aiFix";

function AIFix() {
  const location = useLocation();
  const navigate = useNavigate();
  const { issues, websiteUrl, scanStats } = location.state || {
    issues: [],
    websiteUrl: "",
    scanStats: { pagesScanned: 0, scannedUrls: [] },
  };

  const [fixingStatus, setFixingStatus] = useState({});
  const [fixedIssues, setFixedIssues] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [fixSuggestions, setFixSuggestions] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [validationResults, setValidationResults] = useState({});
  const [error, setError] = useState(null);

  // Step 1: Trigger Fix Suggestions
  useEffect(() => {
    const fetchFixSuggestions = async () => {
      try {
        setError(null);
        setLoadingStates((prev) => ({ ...prev, suggestions: true }));
        const suggestions = await getFixSuggestions(issues);
        setFixSuggestions(suggestions);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingStates((prev) => ({ ...prev, suggestions: false }));
      }
    };

    if (issues.length > 0) {
      fetchFixSuggestions();
    }
  }, [issues]);

  // Step 4 & 5: Apply and Validate Fix
  const handleApplyFix = async (issue, suggestion) => {
    const issueKey = issue.title;
    try {
      // Start fixing
      setFixingStatus((prev) => ({ ...prev, [issueKey]: true }));
      setError(null);

      // Apply the fix
      const appliedFix = await applyFix(issue, suggestion);

      // Validate the fix
      const validationResult = await validateFix(issue, appliedFix);

      // Update states based on validation
      if (validationResult.success) {
        setFixedIssues((prev) => ({ ...prev, [issueKey]: true }));
        setValidationResults((prev) => ({
          ...prev,
          [issueKey]: { status: "success", message: validationResult.message },
        }));
      } else {
        setValidationResults((prev) => ({
          ...prev,
          [issueKey]: { status: "error", message: validationResult.message },
        }));
      }
    } catch (err) {
      setError(err.message);
      setValidationResults((prev) => ({
        ...prev,
        [issueKey]: { status: "error", message: err.message },
      }));
    } finally {
      setFixingStatus((prev) => ({ ...prev, [issueKey]: false }));
    }
  };

  // Group issues by DOM element
  const groupedIssues = issues.reduce((acc, issue) => {
    const selectors = [];
    if (issue.selector) selectors.push(issue.selector);
    if (issue.recommendations) {
      issue.recommendations.forEach((rec) => {
        if (rec.selector && !selectors.includes(rec.selector)) {
          selectors.push(rec.selector);
        }
      });
    }

    selectors.forEach((selector) => {
      if (!acc[selector]) {
        acc[selector] = [];
      }
      acc[selector].push(issue);
    });
    return acc;
  }, {});

  // Filter issues based on category
  const filteredElements =
    selectedCategory === "all"
      ? Object.keys(groupedIssues)
      : Object.keys(groupedIssues).filter((selector) =>
          groupedIssues[selector].some(
            (issue) => issue.type === selectedCategory
          )
        );

  const getTypeColor = (type) => {
    switch (type) {
      case "performance":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "accessibility":
        return "bg-green-100 text-green-800 border-green-200";
      case "best-practices":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "seo":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className='min-h-screen bg-gray-100 p-8'>
      <div className='max-w-6xl mx-auto'>
        {/* Header with back button */}
        <div className='flex items-center gap-4 mb-6'>
          <button
            onClick={() => navigate("/")}
            className='p-2 hover:bg-gray-200 rounded-lg transition-colors'
          >
            <svg
              className='w-6 h-6 text-gray-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M10 19l-7-7m0 0l7-7m-7 7h18'
              />
            </svg>
          </button>
          <div>
            <h1 className='text-2xl font-bold text-gray-800'>
              DOM Element Analysis
            </h1>
            <p className='text-gray-600'>Analyzing {websiteUrl || "website"}</p>
          </div>
        </div>

        {error && (
          <div className='mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded'>
            <p className='text-red-700'>{error}</p>
          </div>
        )}

        {loadingStates.suggestions && (
          <div className='mb-6 bg-blue-50 p-4 rounded-lg flex items-center gap-3'>
            <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600'></div>
            <p className='text-blue-600'>
              Analyzing issues and generating fix suggestions...
            </p>
          </div>
        )}

        <div className='grid grid-cols-12 gap-6'>
          {/* Sidebar */}
          <div className='col-span-12 lg:col-span-3 space-y-6'>
            {/* Scan Stats */}
            <div className='bg-white rounded-xl shadow-lg p-6'>
              <h2 className='text-lg font-semibold text-gray-800 mb-4'>
                Scan Statistics
              </h2>
              <div className='space-y-3'>
                <div>
                  <span className='text-gray-600'>Pages Scanned:</span>
                  <span className='text-black font-medium ml-2'>
                    {scanStats?.pagesScanned || 0}
                  </span>
                </div>
                <div>
                  <span className='text-gray-600'>Elements with Issues:</span>
                  <span className='text-black font-medium ml-2'>
                    {Object.keys(groupedIssues).length}
                  </span>
                </div>
                <div>
                  <span className='text-gray-600'>Total Issues:</span>
                  <span className='text-black font-medium ml-2'>
                    {issues.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className='bg-white rounded-xl shadow-lg p-6'>
              <h2 className='text-lg font-semibold text-gray-800 mb-4'>
                Filter by Category
              </h2>
              <div className='space-y-2'>
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    selectedCategory === "all"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All Categories
                </button>
                {["performance", "accessibility", "seo"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedCategory(type)}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      selectedCategory === type
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Summary */}
            <div className='bg-white rounded-xl shadow-lg p-6'>
              <h2 className='text-lg font-semibold text-gray-800 mb-4'>
                Issue Summary
              </h2>
              <div className='space-y-3'>
                {["performance", "accessibility", "seo"].map((category) => {
                  const count = issues.filter(
                    (issue) => issue.type === category
                  ).length;
                  return (
                    <div
                      key={category}
                      className={`p-3 rounded-lg ${getTypeColor(category)}`}
                    >
                      <div className='text-lg font-bold'>{count}</div>
                      <div className='text-sm'>
                        {category.charAt(0).toUpperCase() + category.slice(1)}{" "}
                        Issues
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className='col-span-12 lg:col-span-9'>
            <div className='bg-white rounded-xl shadow-lg p-6'>
              <h2 className='text-xl font-bold text-gray-800 mb-6'>
                DOM Elements with Issues
              </h2>

              {/* Elements List */}
              <div className='space-y-6'>
                {filteredElements.map((selector, index) => {
                  const elementIssues = groupedIssues[selector].filter(
                    (issue) =>
                      selectedCategory === "all" ||
                      issue.type === selectedCategory
                  );

                  return (
                    <div
                      key={index}
                      className='border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow'
                    >
                      {/* Element Header */}
                      <div className='mb-4'>
                        <div className='flex items-center justify-between mb-2'>
                          <code className='text-black bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-mono'>
                            {selector}
                          </code>
                          <div className='flex gap-2'>
                            {Array.from(
                              new Set(elementIssues.map((issue) => issue.type))
                            ).map((type) => (
                              <span
                                key={type}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(
                                  type
                                )}`}
                              >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Issues for this element */}
                      <div className='space-y-4'>
                        {elementIssues.map((issue, issueIndex) => {
                          const suggestions = fixSuggestions[issue.title] || [];
                          const validation = validationResults[issue.title];

                          return (
                            <div
                              key={issueIndex}
                              className='border-t border-gray-100 pt-4'
                            >
                              <div className='flex items-center justify-between mb-2'>
                                <h3 className='text-lg font-semibold text-gray-800'>
                                  {issue.title}
                                </h3>
                                <div className='flex items-center gap-2'>
                                  {issue.impact && (
                                    <span className='bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium'>
                                      Impact: {Math.round(issue.impact)}%
                                    </span>
                                  )}
                                  {fixedIssues[issue.title] ? (
                                    <span className='bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium'>
                                      Fixed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleApplyFix(issue, suggestions[0])
                                      }
                                      disabled={fixingStatus[issue.title]}
                                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        fixingStatus[issue.title]
                                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                          : "bg-blue-500 text-white hover:bg-blue-600"
                                      }`}
                                    >
                                      {fixingStatus[issue.title] ? (
                                        <div className='flex items-center gap-2'>
                                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                                          Applying...
                                        </div>
                                      ) : (
                                        "Apply This Fix"
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className='text-gray-600 mb-3'>
                                {issue.description}
                              </p>

                              {/* Fix Suggestions */}
                              {suggestions.length > 0 && (
                                <div className='bg-gray-50 rounded-lg p-4 space-y-3 mt-4'>
                                  <h4 className='font-medium text-gray-800'>
                                    AI Fix Suggestions:
                                  </h4>
                                  {suggestions.map((suggestion, sugIndex) => (
                                    <div
                                      key={sugIndex}
                                      className='bg-white rounded-lg p-4 border border-gray-200'
                                    >
                                      <div className='flex items-center justify-between mb-3'>
                                        <p className='text-gray-700 font-medium'>
                                          {suggestion.description}
                                        </p>
                                        <button
                                          onClick={() =>
                                            handleApplyFix(issue, suggestion)
                                          }
                                          disabled={fixingStatus[issue.title]}
                                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            fixingStatus[issue.title]
                                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                              : "bg-blue-500 text-white hover:bg-blue-600"
                                          }`}
                                        >
                                          {fixingStatus[issue.title] ? (
                                            <div className='flex items-center gap-2'>
                                              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                                              Applying...
                                            </div>
                                          ) : (
                                            "Apply This Fix"
                                          )}
                                        </button>
                                      </div>

                                      {suggestion.code && (
                                        <div className='bg-gray-50 p-3 rounded-lg mt-2'>
                                          <span className='block text-sm text-gray-600 mb-1'>
                                            Proposed Changes:
                                          </span>
                                          <pre className='text-black text-sm bg-gray-100 p-2 rounded overflow-x-auto'>
                                            <code>{suggestion.code}</code>
                                          </pre>
                                        </div>
                                      )}

                                      {suggestion.impact && (
                                        <div className='mt-2 text-sm text-gray-600'>
                                          Expected Impact: {suggestion.impact}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Validation Results */}
                              {validation && (
                                <div
                                  className={`mt-3 p-3 rounded-lg ${
                                    validation.status === "success"
                                      ? "bg-green-50 text-green-700"
                                      : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {validation.message}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {filteredElements.length === 0 && (
                  <div className='text-center py-8'>
                    <p className='text-gray-600'>
                      No DOM elements found with issues in the selected
                      category.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIFix;
