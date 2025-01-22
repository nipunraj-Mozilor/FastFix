import { useState } from "react";
import { runLighthouseAnalysis } from "./services/lighthouse";

function App() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const analysisResults = await runLighthouseAnalysis(websiteUrl);
      setResults(analysisResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ScoreCard = ({ label, score }) => (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{label}</h3>
      <div className="text-3xl font-bold" style={{ color: score >= 90 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444' }}>
        {Math.round(score)}%
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
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

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {results && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Analysis Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ScoreCard label="Performance" score={results.performance} />
              <ScoreCard label="Accessibility" score={results.accessibility} />
              <ScoreCard label="Best Practices" score={results.bestPractices} />
              <ScoreCard label="SEO" score={results.seo} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
