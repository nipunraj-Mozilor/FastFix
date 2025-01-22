const API_URL = "http://localhost:3001";

export async function runLighthouseAnalysis(url) {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to analyze website");
    }

    return await response.json();
  } catch (error) {
    console.error("Lighthouse analysis failed:", error);
    throw new Error("Failed to analyze website");
  }
}
