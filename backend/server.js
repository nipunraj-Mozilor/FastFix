import express from "express";
import cors from "cors";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const DEBUG = process.env.DEBUG === "true";

// Configure CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Import routes
import repoModificationRoutes from "./routes/repoModificationRoutes.js";

// Use routes
app.use("/api/repo", repoModificationRoutes);

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

async function analyzePage(page, url) {
  try {
    const result = await lighthouse(url, {
      port: new URL(page.browser().wsEndpoint()).port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });

    const report = JSON.parse(result.report);
    const audits = report.audits;
    const categories = report.categories;

    // Add debug logging
    console.log("Raw Lighthouse Categories:", {
      performance: categories.performance.score,
      accessibility: categories.accessibility.score,
      bestPractices: categories["best-practices"].score,
      seo: categories.seo.score,
    });

    console.log("Sample Performance Metrics:", {
      cls: audits["cumulative-layout-shift"].score,
      lcp: audits["largest-contentful-paint"].score,
      fcp: audits["first-contentful-paint"].score,
      si: audits["speed-index"].score,
    });

    // Log a few critical issues for verification
    const criticalIssues = Object.values(audits)
      .filter((audit) => audit.score !== null && audit.score < 0.5)
      .map((audit) => ({
        title: audit.title,
        score: audit.score,
        description: audit.description,
      }));

    console.log("Critical Issues Found:", criticalIssues);

    const extractIssues = (categoryName, categoryData) => {
      const issues = [];
      const auditRefs = categoryData.auditRefs || [];

      // Sort audit refs by weight and score to prioritize most impactful issues
      const sortedRefs = auditRefs.sort((a, b) => {
        const scoreA = audits[a.id].score || 0;
        const scoreB = audits[b.id].score || 0;
        const weightA = a.weight || 0;
        const weightB = b.weight || 0;

        // Calculate impact (lower score + higher weight = higher impact)
        const impactA = (1 - scoreA) * weightA;
        const impactB = (1 - scoreB) * weightB;

        return impactB - impactA;
      });

      for (const ref of sortedRefs) {
        const audit = audits[ref.id];
        if (audit.score !== 1 && audit.score !== null) {
          // Get raw values
          const rawScore = audit.score || 0; // Score is 0-1
          const weight = ref.weight || 1; // Weight is typically 0-1
          const maxWeight = Math.max(...auditRefs.map((r) => r.weight || 0));

          // Calculate relative impact (0-100 scale)
          // Consider both the score and the relative weight of the audit
          const normalizedImpact = (
            (1 - rawScore) *
            (weight / maxWeight) *
            100
          ).toFixed(1);

          console.log("Impact calculation:", {
            auditTitle: audit.title,
            rawScore,
            weight,
            maxWeight,
            normalizedImpact,
            type: categoryName.toLowerCase(),
          });

          const issue = {
            type: categoryName.toLowerCase(),
            title: audit.title,
            description: audit.description,
            score: audit.score * 100,
            impact: normalizedImpact,
            weight: ref.weight,
            items: audit.details?.items || [],
            recommendations:
              audit.details?.items
                ?.map((item) => ({
                  snippet: item.node?.snippet || item.source || "",
                  selector: item.node?.selector || "",
                  suggestion: item.suggestion || audit.description,
                }))
                .filter((rec) => rec.snippet || rec.selector)
                .slice(0, 3) || [],
          };
          issues.push(issue);
        }
      }

      // Only return top issues that contribute to 80% of the score drop
      const totalImpact = issues.reduce(
        (sum, issue) => sum + parseFloat(issue.impact),
        0
      );
      let cumulativeImpact = 0;
      return issues.filter((issue) => {
        cumulativeImpact += parseFloat(issue.impact);
        return cumulativeImpact <= totalImpact * 0.8;
      });
    };

    const performance = {
      score: categories.performance.score * 100,
      metrics: {
        fcp: {
          score: audits["first-contentful-paint"].score * 100,
          value: audits["first-contentful-paint"].numericValue,
        },
        lcp: {
          score: audits["largest-contentful-paint"].score * 100,
          value: audits["largest-contentful-paint"].numericValue,
        },
        tbt: {
          score: audits["total-blocking-time"].score * 100,
          value: audits["total-blocking-time"].numericValue,
        },
        cls: {
          score: audits["cumulative-layout-shift"].score * 100,
          value: audits["cumulative-layout-shift"].numericValue,
        },
        si: {
          score: audits["speed-index"].score * 100,
          value: audits["speed-index"].numericValue,
        },
        tti: {
          score: audits["interactive"].score * 100,
          value: audits["interactive"].numericValue,
        },
      },
      issues: extractIssues("performance", categories.performance),
    };

    const accessibility = {
      score: categories.accessibility.score * 100,
      audits: {
        passed: categories.accessibility.auditRefs.filter(
          (ref) => audits[ref.id].score === 1
        ).length,
        failed: categories.accessibility.auditRefs.filter(
          (ref) => audits[ref.id].score !== 1 && audits[ref.id].score !== null
        ).length,
        total: categories.accessibility.auditRefs.length,
      },
      issues: extractIssues("accessibility", categories.accessibility),
    };

    const bestPractices = {
      score: categories["best-practices"].score * 100,
      audits: {
        passed: categories["best-practices"].auditRefs.filter(
          (ref) => audits[ref.id].score === 1
        ).length,
        failed: categories["best-practices"].auditRefs.filter(
          (ref) => audits[ref.id].score !== 1 && audits[ref.id].score !== null
        ).length,
        total: categories["best-practices"].auditRefs.length,
      },
      issues: extractIssues("best-practices", categories["best-practices"]),
    };

    const seo = {
      score: categories.seo.score * 100,
      audits: {
        passed: categories.seo.auditRefs.filter(
          (ref) => audits[ref.id].score === 1
        ).length,
        failed: categories.seo.auditRefs.filter(
          (ref) => audits[ref.id].score !== 1 && audits[ref.id].score !== null
        ).length,
        total: categories.seo.auditRefs.length,
      },
      issues: extractIssues("seo", categories.seo),
    };

    return {
      performance,
      accessibility,
      bestPractices,
      seo,
    };
  } catch (error) {
    console.error("Error analyzing page:", error);
    throw error;
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

  // Launch browser for analysis
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);

    for (const route of routes) {
      try {
        const result = await analyzePage(page, route);
        if (result) {
          scannedUrls.push({ url: route, scores: result });
          pagesScanned++;

          sendProgress({
            pagesScanned,
            totalPages: totalPages || 1,
            scannedUrls: scannedUrls.map((u) => u.url),
          });
        }
      } catch (error) {
        console.error(`Error analyzing ${route}:`, error);
        // Continue with next route even if current one fails
      }
    }
  } finally {
    await browser.close();
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
    const mainResults = scanResults.urls[0]?.scores || {
      performance: { score: 0 },
      accessibility: { score: 0 },
      bestPractices: { score: 0 },
      seo: { score: 0 },
    };

    res.write(
      `data: ${JSON.stringify({
        ...mainResults,
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

app.post("/api/scan-elements", async (req, res) => {
  try {
    const { url } = req.body;

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });

    // Get all elements and their details
    const elements = await page.evaluate(() => {
      const getAllElements = (root) => {
        const elements = [];
        const walk = (node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            elements.push({
              tag: node.tagName.toLowerCase(),
              id: node.id || null,
              classes: Array.from(node.classList || []),
              textContent: node.textContent?.trim() || null,
              attributes: Array.from(node.attributes || []).map((attr) => ({
                name: attr.name,
                value: attr.value,
              })),
              path: getXPath(node),
              children: node.children.length,
            });

            // Convert HTMLCollection to Array before using forEach
            Array.from(node.children).forEach(walk);
          }
        };

        const getXPath = (node) => {
          const parts = [];
          while (node && node.nodeType === Node.ELEMENT_NODE) {
            let idx = 0;
            let sibling = node;
            while (sibling) {
              if (
                sibling.nodeType === Node.ELEMENT_NODE &&
                sibling.tagName === node.tagName
              )
                idx++;
              sibling = sibling.previousSibling;
            }
            const tag = node.tagName.toLowerCase();
            parts.unshift(`${tag}[${idx}]`);
            node = node.parentNode;
          }
          return parts.length ? "/" + parts.join("/") : "";
        };

        walk(root);
        return elements;
      };

      // Changed from document.body to document.documentElement to scan all elements
      return getAllElements(document.documentElement);
    });

    await browser.close();
    res.json({ elements });
  } catch (error) {
    console.error("Error scanning elements:", error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
