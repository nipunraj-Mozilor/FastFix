const API_URL = 'http://localhost:3000/api'; // Update with your backend URL

export const runLighthouseAnalysis = async (url) => {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error('Analysis failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Failed to analyze website: ' + error.message);
  }
};
