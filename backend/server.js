import express from "express";
import cors from "cors";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import puppeteer from "puppeteer";

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

async function discoverPages(url, maxPages = 100) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(15000);
  await page.setRequestInterception(true);

  // Optimize performance by blocking unnecessary resources
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (
      ["image", "stylesheet", "font", "media", "other"].includes(resourceType)
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });

  // Handle console messages from the page
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Ignore common browser errors
      const text = msg.text();
      if (
        !text.includes("favicon.ico") &&
        !text.includes("Failed to load resource")
      ) {
        console.log(`Page Error: ${text}`);
      }
    }
  });

  const visited = new Set();
  const toVisit = [new URL(url).toString()];
  const discovered = [];

  try {
    while (toVisit.length > 0 && discovered.length < maxPages) {
      const currentUrl = toVisit.shift();
      if (visited.has(currentUrl)) continue;

      try {
        const response = await page.goto(currentUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });

        if (response && response.ok()) {
          visited.add(currentUrl);
          discovered.push(currentUrl);

          // Find all links on the page
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a[href]"))
              .map((link) => {
                try {
                  const href = link.href;
                  // Filter out common non-page URLs
                  if (
                    href.startsWith("tel:") ||
                    href.startsWith("mailto:") ||
                    href.includes("javascript:") ||
                    href.endsWith(".pdf") ||
                    href.endsWith(".jpg") ||
                    href.endsWith(".png")
                  ) {
                    return null;
                  }
                  return new URL(href, window.location.href).toString();
                } catch {
                  return null;
                }
              })
              .filter((href) => href && href.startsWith("http"));
          });

          // Add new links to toVisit if they're from the same domain
          const baseUrl = new URL(url).origin;
          for (const link of links) {
            try {
              const normalizedLink = new URL(link).toString();
              if (
                normalizedLink.startsWith(baseUrl) &&
                !visited.has(normalizedLink) &&
                !toVisit.includes(normalizedLink) &&
                !normalizedLink.includes("#")
              ) {
                toVisit.push(normalizedLink);
              }
            } catch (error) {
              // Silently ignore invalid URLs
            }
          }
        }
      } catch (error) {
        // Only log non-timeout errors
        if (error.name !== "TimeoutError") {
          console.error(`Failed to visit ${currentUrl}:`, error.message);
        }
      }
    }
  } finally {
    await browser.close();
  }

  return discovered;
}

async function analyzePage(url, chrome) {
  try {
    const options = {
      logLevel: "silent",
      output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      port: chrome.port,
      maxWaitForLoad: 15000,
      throttling: {
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
      settings: {
        formFactor: "desktop",
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
        skipAudits: ["uses-http2", "uses-long-cache-ttl", "canonical"],
        emulatedUserAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    };

    const runnerResult = await lighthouse(url, options);
    if (!runnerResult || !runnerResult.report) {
      console.log(`Skipping ${url} due to empty result`);
      return null;
    }

    const results = JSON.parse(runnerResult.report);
    if (!results.categories) {
      console.log(`Skipping ${url} due to invalid results format`);
      return null;
    }

    // Extract performance metrics
    const performanceMetrics = {
      score: (results.categories.performance?.score || 0) * 100,
      metrics: {
        fcp: {
          score: results.audits["first-contentful-paint"]?.score * 100 || 0,
          value: results.audits["first-contentful-paint"]?.numericValue || 0,
          displayValue:
            results.audits["first-contentful-paint"]?.displayValue || "N/A",
        },
        lcp: {
          score: results.audits["largest-contentful-paint"]?.score * 100 || 0,
          value: results.audits["largest-contentful-paint"]?.numericValue || 0,
          displayValue:
            results.audits["largest-contentful-paint"]?.displayValue || "N/A",
        },
        tbt: {
          score: results.audits["total-blocking-time"]?.score * 100 || 0,
          value: results.audits["total-blocking-time"]?.numericValue || 0,
          displayValue:
            results.audits["total-blocking-time"]?.displayValue || "N/A",
        },
        cls: {
          score: results.audits["cumulative-layout-shift"]?.score * 100 || 0,
          value: results.audits["cumulative-layout-shift"]?.numericValue || 0,
          displayValue:
            results.audits["cumulative-layout-shift"]?.displayValue || "N/A",
        },
        si: {
          score: results.audits["speed-index"]?.score * 100 || 0,
          value: results.audits["speed-index"]?.numericValue || 0,
          displayValue: results.audits["speed-index"]?.displayValue || "N/A",
        },
        tti: {
          score: results.audits["interactive"]?.score * 100 || 0,
          value: results.audits["interactive"]?.numericValue || 0,
          displayValue: results.audits["interactive"]?.displayValue || "N/A",
        },
      },
    };

    // Extract accessibility metrics
    const accessibilityMetrics = {
      score: (results.categories.accessibility?.score || 0) * 100,
      details: {
        passed:
          results.categories.accessibility?.auditRefs?.filter(
            (audit) => results.audits[audit.id]?.score === 1
          ).length || 0,
        failed:
          results.categories.accessibility?.auditRefs?.filter(
            (audit) => results.audits[audit.id]?.score === 0
          ).length || 0,
        total: results.categories.accessibility?.auditRefs?.length || 0,
      },
      audits: {
        contrast: {
          score: results.audits["color-contrast"]?.score * 100 || 0,
          details:
            results.audits["color-contrast"]?.details?.items?.length || 0,
          title: "Color Contrast",
          description: results.audits["color-contrast"]?.description || "",
        },
        headings: {
          score: results.audits["heading-order"]?.score * 100 || 0,
          details: results.audits["heading-order"]?.details?.items?.length || 0,
          title: "Headings",
          description: results.audits["heading-order"]?.description || "",
        },
        aria: {
          score:
            (results.audits["aria-required-attr"]?.score * 100 +
              results.audits["aria-roles"]?.score * 100) /
              2 || 0,
          details:
            (results.audits["aria-required-attr"]?.details?.items?.length ||
              0) + (results.audits["aria-roles"]?.details?.items?.length || 0),
          title: "ARIA Labels",
          description: "ARIA attributes and roles usage",
        },
        images: {
          score: results.audits["image-alt"]?.score * 100 || 0,
          details: results.audits["image-alt"]?.details?.items?.length || 0,
          title: "Image Alts",
          description: results.audits["image-alt"]?.description || "",
        },
        links: {
          score: results.audits["link-name"]?.score * 100 || 0,
          details: results.audits["link-name"]?.details?.items?.length || 0,
          title: "Link Names",
          description: results.audits["link-name"]?.description || "",
        },
        actions: {
          score:
            (results.audits["custom-controls-labels"]?.score * 100 +
              results.audits["custom-controls-roles"]?.score * 100) /
              2 || 0,
          details:
            (results.audits["custom-controls-labels"]?.details?.items?.length ||
              0) +
            (results.audits["custom-controls-roles"]?.details?.items?.length ||
              0),
          title: "Actions",
          description: "Interactive elements accessibility",
        },
      },
    };

    // Extract best practices metrics
    const bestPracticesMetrics = {
      score: (results.categories["best-practices"]?.score || 0) * 100,
      details: {
        passed:
          results.categories["best-practices"]?.auditRefs?.filter(
            (audit) => results.audits[audit.id]?.score === 1
          ).length || 0,
        failed:
          results.categories["best-practices"]?.auditRefs?.filter(
            (audit) => results.audits[audit.id]?.score === 0
          ).length || 0,
        total: results.categories["best-practices"]?.auditRefs?.length || 0,
      },
    };

    // Extract SEO metrics
    const seoMetrics = {
      score: (results.categories.seo?.score || 0) * 100,
      details: {
        passed:
          results.categories.seo?.auditRefs?.filter(
            (audit) => results.audits[audit.id]?.score === 1
          ).length || 0,
        failed:
          results.categories.seo?.auditRefs?.filter(
            (audit) => results.audits[audit.id]?.score === 0
          ).length || 0,
        total: results.categories.seo?.auditRefs?.length || 0,
      },
    };

    return {
      url,
      scores: {
        performance: performanceMetrics,
        accessibility: accessibilityMetrics,
        bestPractices: bestPracticesMetrics,
        seo: seoMetrics,
      },
    };
  } catch (error) {
    if (
      !error.message.includes("LanternError") &&
      !error.message.includes("PROTOCOL_TIMEOUT")
    ) {
      console.error(`Failed to analyze ${url}:`, error.message);
    }
    return null;
  }
}

async function scanWebsite(url, sendProgress) {
  // Discover all pages
  const routes = await discoverPages(url);
  const scannedUrls = [];
  const totalPages = routes.length;
  let pagesScanned = 0;

  if (totalPages === 0) {
    sendProgress({
      pagesScanned: 0,
      totalPages: 1,
      scannedUrls: [url],
    });

    // If no pages were discovered, at least analyze the main URL
    routes.push(url);
  }

  // Launch a single Chrome instance for all analyses
  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    for (const route of routes) {
      const result = await analyzePage(route, chrome);
      if (result) {
        scannedUrls.push(result);
        pagesScanned++;

        sendProgress({
          pagesScanned,
          totalPages: totalPages || 1,
          scannedUrls: scannedUrls.map((u) => u.url),
        });
      }
    }
  } finally {
    await chrome.kill();
  }

  return {
    urls: scannedUrls,
    stats: {
      pagesScanned,
      totalPages: totalPages || 1,
    },
  };
}

app.post("/analyze", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    const sendProgress = (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    const scanResults = await scanWebsite(url, sendProgress);

    // Return the final results
    const mainScores = scanResults.urls[0]?.scores || {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
    };

    res.write(
      `data: ${JSON.stringify({
        ...mainScores,
        scanStats: {
          pagesScanned: scanResults.stats.pagesScanned,
          totalPages: scanResults.stats.totalPages,
          scannedUrls: scanResults.urls.map((u) => u.url),
        },
        done: true,
      })}\n\n`
    );
  } catch (error) {
    console.error("Analysis failed:", error);
    res.write(
      `data: ${JSON.stringify({ error: "Failed to analyze website" })}\n\n`
    );
  }

  res.end();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
