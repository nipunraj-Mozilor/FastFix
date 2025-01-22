import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Helper function for score colors
const getScoreColor = (score) => {
  if (score >= 90) return { bg: 'bg-green-100', text: 'text-green-800', color: '#22c55e' };
  if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-800', color: '#f59e0b' };
  return { bg: 'bg-red-100', text: 'text-red-800', color: '#ef4444' };
};

function MoreResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const storedResults = localStorage.getItem('analysisResult');
      if (!storedResults) {
        throw new Error('No analysis results found');
      }

      const parsedResults = JSON.parse(storedResults);
      if (parsedResults.id !== id) {
        throw new Error('Results not found for this ID');
      }

      console.log('Loaded results:', parsedResults);
      setResults(parsedResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Render each audit item
  const renderAuditItem = (audit, index) => {
    const { bg, text } = getScoreColor(audit.score || 0);
    
    console.log('Rendering audit item:', audit); // Debug log

    return (
      <div key={index} className="border rounded-lg p-4 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{audit.title}</h3>
            {audit.key && (
              <div className="text-sm text-gray-500 mt-1">
                ID: {audit.key}
              </div>
            )}
          </div>
          {typeof audit.score === 'number' && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${bg} ${text}`}>
              {Math.round(audit.score)}%
            </span>
          )}
        </div>
        
        <p className="mt-2 text-sm text-gray-600">{audit.description}</p>
        
        {audit.details > 0 && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {audit.details} {audit.details === 1 ? 'issue' : 'issues'} found
            </span>
          </div>
        )}

        {audit.items && audit.items.length > 0 && (
          <div className="mt-3 pl-4 border-l-2 border-gray-200">
            <p className="text-sm font-medium text-gray-700">Details:</p>
            <ul className="mt-1 space-y-1">
              {audit.items.map((item, i) => (
                <li key={i} className="text-sm text-gray-600">
                  {item.explanation || item.description || JSON.stringify(item)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render each category section
  const renderCategorySection = (category, data) => {
    const title = category === 'bestPractices' ? 'Best Practices' : 
                 category.charAt(0).toUpperCase() + category.slice(1);

    console.log(`Rendering ${category} section:`, data); // Debug log

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{title} Audits</h2>
          {data.summary && (
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">✓ {data.summary.passed} passed</span>
              <span className="text-red-600">✕ {data.summary.failed} failed</span>
              <span className="text-gray-600">Total: {data.summary.total}</span>
            </div>
          )}
        </div>

        {Array.isArray(data.audits) && data.audits.length > 0 ? (
          <div className="space-y-4">
            {data.audits.map((audit, index) => renderAuditItem(audit, index))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">
            No audit data available
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen bg-gray-100 flex items-center justify-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Analyzer
          </button>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Analysis Results</h1>
          <div className="text-sm text-gray-600">URL: {results.url}</div>
          <div className="text-sm text-gray-600">Analysis ID: {results.id}</div>
        </div>

        {/* Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {['performance', 'accessibility', 'bestPractices', 'seo'].map(category => {
            if (!results[category]) return null;
            const { color } = getScoreColor(results[category].score);
            
            return (
              <div key={category} className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  {category === 'bestPractices' ? 'Best Practices' : 
                   category.charAt(0).toUpperCase() + category.slice(1)}
                </h2>
                <div className="text-4xl font-bold" style={{ color }}>
                  {Math.round(results[category].score)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Performance Metrics */}
        {results.performance?.metrics && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Performance Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(results.performance.metrics).map(([key, metric]) => {
                const { color } = getScoreColor(metric.score || 0);
                return (
                  <div key={key} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-600">{key.toUpperCase()}</div>
                    <div className="text-lg font-semibold mt-1">
                      {metric.displayValue || `${metric.value}ms`}
                    </div>
                    {typeof metric.score === 'number' && (
                      <div className="text-sm font-medium mt-1" style={{ color }}>
                        Score: {Math.round(metric.score)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Sections */}
        {['performance', 'accessibility', 'bestPractices', 'seo'].map(category => (
          results[category] && (
            <div key={category}>
              {renderCategorySection(category, results[category])}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default MoreResults; 