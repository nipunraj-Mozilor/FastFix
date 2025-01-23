const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function runLighthouseAnalysis(url, onProgress) {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error("Failed to analyze website");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ""; // Buffer to handle incomplete chunks

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double newlines and process complete messages
      const lines = buffer.split("\n\n");
      // Keep the last potentially incomplete chunk in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() && line.startsWith("data: ")) {
          try {
            const jsonStr = line.slice(6).trim();

            // Debug logging
            console.log("Received SSE data length:", jsonStr.length);
            if (jsonStr.length > 1000) {
              console.log("Start of data:", jsonStr.substring(0, 100));
              console.log(
                "End of data:",
                jsonStr.substring(jsonStr.length - 100)
              );
            }

            // Validate JSON structure
            if (!jsonStr.startsWith("{") || !jsonStr.endsWith("}")) {
              console.error("Malformed JSON structure:", {
                starts_with: jsonStr.substring(0, 1),
                ends_with: jsonStr.substring(jsonStr.length - 1),
                length: jsonStr.length,
              });
              continue; // Skip this malformed chunk
            }

            const data = JSON.parse(jsonStr);

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.done) {
              return {
                performance: {
                  score: data.performance.score,
                  issues: data.performance.issues,
                  metrics: data.performance.metrics,
                },
                accessibility: {
                  score: data.accessibility.score,
                  issues: data.accessibility.issues,
                },
                bestPractices: {
                  score: data.bestPractices.score,
                  issues: data.bestPractices.issues,
                },
                seo: {
                  score: data.seo.score,
                  issues: data.seo.issues,
                },
                scanStats: {
                  pagesScanned: data.scanStats?.pagesScanned || 0,
                  totalPages: data.scanStats?.totalPages || 0,
                  scannedUrls: data.scanStats?.scannedUrls || [],
                },
              };
            }

            // Handle progress updates
            if (onProgress && data.pagesScanned !== undefined) {
              onProgress(data);
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", e);
            if (e instanceof SyntaxError) {
              const jsonStr = line.slice(6);
              const errorPos = e.message.match(/position (\d+)/)?.[1];
              const pos = parseInt(errorPos) || 0;

              console.error("Error details:", {
                message: e.message,
                position: pos,
                totalLength: jsonStr.length,
                nearError: jsonStr.substring(
                  Math.max(0, pos - 100),
                  Math.min(jsonStr.length, pos + 100)
                ),
              });

              // Continue instead of throwing to handle partial updates
              continue;
            }
            throw e;
          }
        }
      }
    }
  } catch (error) {
    console.error("Lighthouse analysis failed:", error);
    throw new Error(`Failed to analyze website: ${error.message}`);
  }
}
