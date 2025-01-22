const API_URL = 'http://localhost:3000/api';

const fetchFileContent = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
};

export const minifyCode = async (jsUrls, cssUrls) => {
  try {
    const response = await fetch(`${API_URL}/minify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsUrls, cssUrls }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || 'Minification failed');
    }

    return await response.json();
  } catch (error) {
    throw new Error('Failed to minify code: ' + error.message);
  }
}; 