import { useState } from "react";
import { useNavigate } from "react-router-dom";

function GitHubConfig() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    githubToken: "",
    owner: "",
    repo: "",
    defaultBranch: "main",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [repositories, setRepositories] = useState([]);

  const getImpactColor = (impact) => {
    switch (impact) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "speed":
        return "text-blue-600";
      case "seo":
        return "text-purple-600";
      case "ux":
        return "text-green-600";
      case "security":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessData(null);

    try {
      const response = await fetch("/api/github/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: formData.githubToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to connect to GitHub");
      }

      setIsConnected(true);
      setRepositories(data.repositories || []);
      setSuccessData(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (successData) {
    return (
      <div className='min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-4xl mx-auto'>
          <div className='bg-white rounded-lg shadow-lg p-8'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-2xl font-bold text-gray-900'>
                Repository Changes
              </h2>
              <div className='flex gap-4'>
                <a
                  href={successData.pullRequest.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors'
                >
                  View Pull Request
                </a>
                <a
                  href={successData.pullRequest.diffUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors'
                >
                  View Changes
                </a>
              </div>
            </div>

            <div className='space-y-6'>
              {successData.changes.map((change, index) => (
                <div
                  key={index}
                  className='border border-gray-200 rounded-lg p-6'
                >
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center gap-3'>
                      <span
                        className={`font-medium ${getCategoryColor(
                          change.category
                        )}`}
                      >
                        {change.category.charAt(0).toUpperCase() +
                          change.category.slice(1)}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getImpactColor(
                          change.impact
                        )}`}
                      >
                        {change.impact.charAt(0).toUpperCase() +
                          change.impact.slice(1)}{" "}
                        Impact
                      </span>
                    </div>
                    <span className='text-sm text-gray-500'>
                      {change.file}:{change.startLine}
                    </span>
                  </div>

                  <p className='text-gray-600 mb-4'>{change.reason}</p>

                  <div className='space-y-3'>
                    <div className='bg-red-50 p-4 rounded-lg'>
                      <div className='text-sm text-red-700 font-medium mb-2'>
                        Original Code:
                      </div>
                      <pre className='text-sm text-red-800 overflow-x-auto'>
                        {change.originalCode}
                      </pre>
                    </div>
                    <div className='bg-green-50 p-4 rounded-lg'>
                      <div className='text-sm text-green-700 font-medium mb-2'>
                        New Code:
                      </div>
                      <pre className='text-sm text-green-800 overflow-x-auto'>
                        {change.newCode}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='absolute top-8 left-8'>
        <img src='/logo.svg' alt='Logo' className='h-12 w-auto' />
      </div>
      <div className='max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 mt-16'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-2xl font-bold text-gray-900'>
            GitHub Configuration
          </h2>
          <button
            onClick={() => navigate(-1)}
            className='p-2 bg-transparent border border-black hover:bg-gray-100 rounded-full'
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
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <label
              htmlFor='githubToken'
              className='block text-sm font-medium text-gray-700'
            >
              GitHub Token
            </label>
            <input
              type='password'
              name='githubToken'
              id='githubToken'
              value={formData.githubToken}
              onChange={handleChange}
              required
              className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              placeholder='Enter your GitHub token'
            />
          </div>

          <div>
            <label
              htmlFor='owner'
              className='block text-sm font-medium text-gray-700'
            >
              Repository Owner
            </label>
            <input
              type='text'
              name='owner'
              id='owner'
              value={formData.owner}
              onChange={handleChange}
              required
              className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              placeholder='e.g., username or organization'
            />
          </div>

          <div>
            <label
              htmlFor='repo'
              className='block text-sm font-medium text-gray-700'
            >
              Repository Name
            </label>
            <input
              type='text'
              name='repo'
              id='repo'
              value={formData.repo}
              onChange={handleChange}
              required
              className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              placeholder='e.g., my-project'
            />
          </div>

          <div className='flex justify-end'>
            <button
              type='submit'
              disabled={loading}
              className='px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
            >
              {loading ? (
                <>
                  <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-white'></div>
                  Connecting...
                </>
              ) : (
                "Connect Repository"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GitHubConfig;
