import React, { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { minifyCode } from './services/minification';

function ReportPage() {
  const location = useLocation();
  const { results, url } = location.state || {};
  const [minifying, setMinifying] = useState(false);
  const [minificationResult, setMinificationResult] = useState(null);

  if (!results) {
    return <Navigate to="/analyzer" replace />;
  }

  // Add error handling for missing data
  if (!results.categories || !results.audits) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Analysis Error</h1>
          <p className="text-gray-600">Unable to load analysis results. Please try again.</p>
        </div>
      </div>
    );
  }

  const ProgressBar = ({ percentage }) => (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="bg-black rounded-full h-2" 
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );

  const MetricRow = ({ label, value, unit = '%' }) => (
    <div className="flex items-center justify-between mb-4">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-4">
        <ProgressBar percentage={typeof value === 'string' ? parseFloat(value) : value} />
        <span className="text-gray-800 font-medium w-16">
          {value}{unit}
        </span>
      </div>
    </div>
  );

  // Convert lighthouse score (0-1) to percentage (0-100)
  const toPercentage = (score) => Math.round(score * 100);

  // Get recommendations based on scores
  const getRecommendations = () => {
    const recommendations = [];
    
    if (results.audits['uses-optimized-images']?.score < 1) {
      recommendations.push({
        title: 'Image Optimization',
        description: `Optimize images to potentially reduce their size by ${results.audits['uses-optimized-images']?.details?.overallSavingsBytes || '45%'}`,
        action: 'Optimize Now',
        icon: '🖼️'
      });
    }

    if (results.audits['uses-long-cache-ttl']?.score < 1) {
      recommendations.push({
        title: 'Browser Caching',
        description: 'Implement browser caching to improve page load times for returning visitors',
        action: 'Enable Caching',
        icon: '⚡'
      });
    }

    const hasUnminifiedJs = results.audits['unminified-javascript']?.score < 1;
    const hasUnminifiedCss = results.audits['unminified-css']?.score < 1;
    
    if (hasUnminifiedJs || hasUnminifiedCss) {
      recommendations.push({
        title: 'Code Minification',
        description: `Minify ${[
          hasUnminifiedJs && 'JavaScript',
          hasUnminifiedCss && 'CSS'
        ].filter(Boolean).join(' and ')} files to reduce file sizes and improve loading speed`,
        action: 'Minify Code',
        icon: '📝',
        onClick: handleMinifyCode,
        savings: {
          js: results.audits['unminified-javascript']?.details?.overallSavingsBytes,
          css: results.audits['unminified-css']?.details?.overallSavingsBytes
        }
      });
    }

    return recommendations;
  };

  const handleMinifyCode = async (recommendation) => {
    try {
      setMinifying(true);
      
      // Get all unminified file URLs from the audit results
      const jsUrls = results.audits['unminified-javascript']?.details?.items?.map(item => item.url) || [];
      const cssUrls = results.audits['unminified-css']?.details?.items?.map(item => item.url) || [];

      const result = await minifyCode(jsUrls, cssUrls);
      setMinificationResult(result);

      // Show success message or download minified files
      if (result.js) {
        downloadFile(result.js, 'minified.js');
      }
      if (result.css) {
        downloadFile(result.css, 'minified.css');
      }
    } catch (error) {
      console.error('Minification failed:', error);
      // Show error message to user
      alert('Failed to minify code: ' + error.message);
    } finally {
      setMinifying(false);
    }
  };

  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <img src="/logo.svg" alt="Logo" className="h-8" />
            <nav className="flex gap-6">
              <a href="#" className="font-medium text-gray-900">Dashboard</a>
              <a href="#" className="text-gray-500">Analysis</a>
              <a href="#" className="text-gray-500">Reports</a>
              <a href="#" className="text-gray-500">Settings</a>
            </nav>
          </div>
          <button className="px-4 py-2 bg-black text-white rounded-lg">
            Get Started
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4">
            Website Performance Analysis Results
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Analysis results for {url}
          </p>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Performance Score</h3>
              <span className="text-2xl font-bold">
                {toPercentage(results.categories.performance.score)}/100
              </span>
            </div>
            <div className="space-y-4">
              <MetricRow 
                label="First Contentful Paint" 
                value={results.audits['first-contentful-paint'].displayValue} 
                unit=""
              />
              <MetricRow 
                label="Speed Index" 
                value={results.audits['speed-index'].displayValue}
                unit=""
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">SEO Score</h3>
              <span className="text-2xl font-bold">
                {toPercentage(results.categories.seo.score)}/100
              </span>
            </div>
            <div className="space-y-4">
              <MetricRow 
                label="Meta Description" 
                value={toPercentage(results.audits['meta-description']?.score || 0)} 
              />
              <MetricRow 
                label="Crawlable Links" 
                value={toPercentage(results.audits['link-text']?.score || 0)}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">User Experience</h3>
              <span className="text-2xl font-bold">
                {toPercentage(results.categories.accessibility.score)}/100
              </span>
            </div>
            <div className="space-y-4">
              <MetricRow 
                label="Mobile Friendly" 
                value={toPercentage(results.audits['mobile-friendly']?.score || 0)}
              />
              <MetricRow 
                label="Accessibility" 
                value={toPercentage(results.categories.accessibility.score)}
              />
            </div>
          </div>
        </div>

        {/* Optimization Recommendations */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Optimization Recommendations</h2>
          <div className="space-y-4">
            {getRecommendations().map((recommendation, index) => (
              <div key={index} className="bg-white p-6 rounded-xl flex items-start gap-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <span className="text-2xl">{recommendation.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{recommendation.title}</h3>
                  <p className="text-gray-600">{recommendation.description}</p>
                  {recommendation.savings && (
                    <p className="text-sm text-gray-500 mt-1">
                      Potential savings: {(recommendation.savings.js + recommendation.savings.css) / 1024} KB
                    </p>
                  )}
                  <button
                    onClick={() => recommendation.onClick(recommendation)}
                    disabled={minifying}
                    className="mt-3 px-4 py-2 bg-black text-white text-sm rounded-lg disabled:bg-gray-400"
                  >
                    {minifying ? 'Minifying...' : recommendation.action}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Minification Result Modal */}
          {minificationResult && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-xl max-w-md">
                <h3 className="text-xl font-bold mb-4">Minification Complete</h3>
                {minificationResult.savings.js > 0 && (
                  <p>JavaScript reduced by {minificationResult.savings.js}%</p>
                )}
                {minificationResult.savings.css > 0 && (
                  <p>CSS reduced by {minificationResult.savings.css}%</p>
                )}
                <button
                  onClick={() => setMinificationResult(null)}
                  className="mt-4 px-4 py-2 bg-black text-white rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ReportPage;
