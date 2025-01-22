const express = require('express');
const cors = require('cors');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const UglifyJS = require('uglify-js');
const CleanCSS = require('clean-css');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    // Launch Chrome
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless']
    });

    // Run Lighthouse
    const options = {
      logLevel: 'info',
      output: 'json',
      port: chrome.port,
    };

    const runnerResult = await lighthouse(url, options);
    await chrome.kill();

    // Send the results
    res.json(runnerResult.lhr);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze website' });
  }
});

async function fetchFileContent(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

app.post('/api/minify', async (req, res) => {
  try {
    const { jsUrls, cssUrls } = req.body;
    
    // Fetch contents
    const jsContents = await Promise.all(
      (jsUrls || []).map(url => fetchFileContent(url))
    );
    const cssContents = await Promise.all(
      (cssUrls || []).map(url => fetchFileContent(url))
    );

    let result = {
      js: null,
      css: null,
      savings: {
        js: 0,
        css: 0
      }
    };

    // Minify JavaScript
    const jsContent = jsContents.filter(Boolean).join('\n');
    if (jsContent) {
      try {
        const minifiedJs = UglifyJS.minify(jsContent);
        if (minifiedJs.error) throw minifiedJs.error;
        
        result.js = minifiedJs.code;
        result.savings.js = ((jsContent.length - minifiedJs.code.length) / jsContent.length * 100).toFixed(2);
      } catch (jsError) {
        console.error('JavaScript minification error:', jsError);
        result.js = jsContent;
        result.savings.js = 0;
      }
    }

    // Minify CSS
    const cssContent = cssContents.filter(Boolean).join('\n');
    if (cssContent) {
      try {
        const minifiedCss = new CleanCSS({
          level: 2,
          compatibility: '*'
        }).minify(cssContent);
        
        if (minifiedCss.errors.length) throw new Error(minifiedCss.errors.join(', '));
        
        result.css = minifiedCss.styles;
        result.savings.css = ((cssContent.length - minifiedCss.styles.length) / cssContent.length * 100).toFixed(2);
      } catch (cssError) {
        console.error('CSS minification error:', cssError);
        result.css = cssContent;
        result.savings.css = 0;
      }
    }

    if (!result.js && !result.css) {
      throw new Error('No content to minify');
    }

    res.json(result);
  } catch (error) {
    console.error('Minification error:', error);
    res.status(500).json({ 
      error: 'Failed to minify code',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
