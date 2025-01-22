import express from "express";
import cors from "cors";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post("/analyze", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
    const options = {
      logLevel: "info",
      output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(url, options);
    const reportJson = runnerResult.report;
    await chrome.kill();

    const results = JSON.parse(reportJson);
    const scores = {
      performance: results.categories.performance.score * 100,
      accessibility: results.categories.accessibility.score * 100,
      bestPractices: results.categories["best-practices"].score * 100,
      seo: results.categories.seo.score * 100,
    };

    res.json(scores);
  } catch (error) {
    console.error("Lighthouse analysis failed:", error);
    res.status(500).json({ error: "Failed to analyze website" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
