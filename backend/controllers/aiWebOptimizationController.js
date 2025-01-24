import { Octokit } from "@octokit/rest";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import path from "path";
import { promises as fs } from "fs";

const DEBUG = process.env.DEBUG === "true";

const getGitConfig = async () => {
  try {
    const configPath = path.join(process.cwd(), "config.json");
    const config = await fs.readFile(configPath, "utf8");
    return JSON.parse(config);
  } catch (error) {
    throw new Error(
      "Configuration not found. Please ensure config.json is set up"
    );
  }
};

const analyzeWebsitePerformance = async (content, fileType) => {
  try {
    const llm = new ChatOpenAI({
      temperature: 0.7,
      modelName: "gpt-4",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const promptTemplate = `
You are a website optimization expert. Analyze this {fileType} code and suggest improvements:

CODE:
{content}

Focus on these areas:
1. Loading Speed:
   - Resource optimization through code improvements
   - Lazy loading for images and heavy content
   - Async/defer script loading
   - Remove unused code
   - Optimize resource delivery
   IMPORTANT: DO NOT suggest minified files (.min.js, .min.css) or CDN changes

2. SEO Optimization:
   - Meta tags and descriptions
   - Semantic HTML structure
   - Header hierarchy
   - Alt text for images
   - Schema markup
   - Content organization

3. User Experience:
   - Mobile responsiveness
   - Core Web Vitals
   - Interactive elements
   - Loading indicators
   - Form validation
   - Error handling
   - Accessibility improvements

4. Best Practices:
   - Browser compatibility
   - Performance patterns
   - Error handling
   - Security considerations
   - HTML5 standards
   - ARIA attributes

STRICT REQUIREMENTS:
1. DO NOT suggest any .min.js or .min.css files
2. DO NOT suggest CDN changes
3. DO NOT modify existing file paths
4. Keep all resource paths relative
5. Focus on code-level improvements only
6. Maintain existing file structure

Return a JSON array of changes. Each object must have:
- findText (string): exact code to replace
- replaceText (string): optimized code
- reason (string): explanation of improvement
- category (string): speed|seo|ux|security
- impact (string): high|medium|low`;

    const prompt = PromptTemplate.fromTemplate(promptTemplate);

    const formattedPrompt = await prompt.format({
      fileType: fileType || "code",
      content: content || "",
    });

    const response = await llm.invoke(formattedPrompt);

    try {
      // Extract JSON array from the response if it's wrapped in markdown code blocks
      let jsonContent = response.content;
      const jsonMatch = jsonContent.match(
        /```(?:json)?\s*(\[[\s\S]*?\])\s*```/
      );

      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      // Parse the JSON content
      const parsedResponse = JSON.parse(jsonContent);

      if (!Array.isArray(parsedResponse)) {
        console.error("AI response is not an array:", parsedResponse);
        return [];
      }

      // Filter out any suggestions that include minified files or CDN changes
      const filteredResponse = parsedResponse.filter((suggestion) => {
        if (
          !suggestion.findText ||
          !suggestion.replaceText ||
          !suggestion.reason ||
          !suggestion.category ||
          !suggestion.impact
        ) {
          console.error("Invalid suggestion format:", suggestion);
          return false;
        }

        const hasMinFile =
          suggestion.replaceText.includes(".min.js") ||
          suggestion.replaceText.includes(".min.css");
        const hasCDN =
          suggestion.replaceText.includes("cdn.") ||
          suggestion.replaceText.includes("//unpkg.com") ||
          suggestion.replaceText.includes("//cdnjs.") ||
          suggestion.replaceText.includes("//jsdelivr.");

        // Check if the suggestion modifies existing file paths
        const modifiesPath = (originalPath, newPath) => {
          const pathRegex = /(?:src|href)=["'](.*?)["']/g;
          const originalPaths = [...originalPath.matchAll(pathRegex)].map(
            (m) => m[1]
          );
          const newPaths = [...newPath.matchAll(pathRegex)].map((m) => m[1]);

          return originalPaths.some((path, index) => {
            // Allow changes to add attributes but not modify paths
            return newPaths[index] && !newPaths[index].includes(path);
          });
        };

        const changesPath = modifiesPath(
          suggestion.findText,
          suggestion.replaceText
        );

        return !hasMinFile && !hasCDN && !changesPath;
      });

      if (DEBUG) {
        console.log(
          "Filtered AI suggestions:",
          JSON.stringify(filteredResponse, null, 2)
        );
      }
      return filteredResponse;
    } catch (parseError) {
      console.error("Failed to parse AI response:", response.content);
      console.error("Parse error:", parseError);
      return [];
    }
  } catch (error) {
    console.error("Error in performance analysis:", error);
    return [];
  }
};

export const optimizeWebsite = async (req, res) => {
  try {
    const { githubToken, owner, repo } = req.body;

    if (!githubToken || !owner || !repo) {
      throw new Error(
        "Missing required parameters: githubToken, owner, and repo are required"
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    // Get repository info to find the default branch
    const { data: repoInfo } = await octokit.repos.get({
      owner,
      repo,
    });

    const defaultBranch = repoInfo.default_branch;

    // Create optimization branch
    const branchName = `ai-optimize-${Date.now()}`;
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });

    // Get repository files
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref.object.sha,
      recursive: "true",
    });

    // Create a simplified results object
    const optimizationResults = {
      changes: [],
      pullRequest: {
        url: "",
        diffUrl: "",
      },
    };

    // Process files
    for (const file of tree.tree) {
      if (file.type === "blob") {
        const ext = path.extname(file.path).toLowerCase();
        if ([".html", ".css", ".js"].includes(ext)) {
          try {
            if (DEBUG) {
              console.log(`Analyzing ${file.path}...`);
            }
            const { data: content } = await octokit.repos.getContent({
              owner,
              repo,
              path: file.path,
            });

            const fileContent = Buffer.from(
              content.content,
              "base64"
            ).toString();
            const optimizations = await analyzeWebsitePerformance(
              fileContent,
              ext.substring(1)
            );

            if (optimizations && optimizations.length > 0) {
              let newContent = fileContent;
              const lines = fileContent.split("\n");

              // Apply optimizations
              for (const opt of optimizations) {
                if (
                  opt.findText &&
                  opt.replaceText &&
                  newContent.includes(opt.findText)
                ) {
                  // Find the line number for this change
                  let startLine = 1;
                  let endLine = 1;

                  // Find the line numbers by searching through the file content
                  for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(opt.findText)) {
                      startLine = i + 1;
                      // Calculate endLine based on number of newlines in the original text
                      const newLines = opt.findText.split("\n").length;
                      endLine = startLine + newLines - 1;
                      break;
                    }
                  }

                  newContent = newContent.replace(
                    opt.findText,
                    opt.replaceText
                  );

                  // Add change details to results with line numbers
                  optimizationResults.changes.push({
                    file: file.path,
                    startLine,
                    endLine,
                    category: opt.category,
                    impact: opt.impact,
                    reason: opt.reason,
                    originalCode: opt.findText,
                    newCode: opt.replaceText,
                  });
                }
              }

              // Commit changes if content was modified
              if (newContent !== fileContent) {
                await octokit.repos.createOrUpdateFileContents({
                  owner,
                  repo,
                  path: file.path,
                  message: `AI Optimization: ${file.path}`,
                  content: Buffer.from(newContent).toString("base64"),
                  branch: branchName,
                  sha: content.sha,
                });
              }
            }
          } catch (error) {
            console.error(`Error processing ${file.path}:`, error);
          }
        }
      }
    }

    if (optimizationResults.changes.length > 0) {
      // Create pull request with minimal description
      const prBody = `
# AI-Powered Website Optimization

${optimizationResults.changes
  .map(
    (change) =>
      `- **${change.file}** (lines ${change.startLine}-${change.endLine}):
    - Category: ${change.category}
    - Impact: ${change.impact}
    - Reason: ${change.reason}`
  )
  .join("\n\n")}`;

      const { data: pullRequest } = await octokit.pulls.create({
        owner,
        repo,
        title: "AI-Powered Website Optimization",
        body: prBody,
        head: branchName,
        base: defaultBranch,
      });

      // Add PR URLs to results
      optimizationResults.pullRequest = {
        url: pullRequest.html_url,
        diffUrl: `${pullRequest.html_url}/files`,
      };

      res.json({
        success: true,
        data: optimizationResults,
      });
    } else {
      throw new Error("No optimization opportunities found");
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const applySpecificOptimization = async (req, res) => {
  try {
    const { suggestion, githubToken, owner, repo } = req.body;

    if (!suggestion || !githubToken || !owner || !repo) {
      throw new Error(
        "Missing required parameters: suggestion, githubToken, owner, and repo are required"
      );
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    // Get repository info to find the default branch
    const { data: repoInfo } = await octokit.repos.get({
      owner,
      repo,
    });

    const defaultBranch = repoInfo.default_branch;

    // Create optimization branch
    const branchName = `ai-optimize-specific-${Date.now()}`;
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });

    const optimizationResults = {
      changes: [],
      pullRequest: {
        url: "",
        diffUrl: "",
      },
    };

    // Get all files in the repository
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref.object.sha,
      recursive: "true",
    });

    // Process files to find optimization opportunities
    for (const file of tree.tree) {
      if (file.type === "blob") {
        const ext = path.extname(file.path).toLowerCase();
        if ([".html", ".css", ".js"].includes(ext)) {
          try {
            const { data: content } = await octokit.repos.getContent({
              owner,
              repo,
              path: file.path,
            });

            const fileContent = Buffer.from(
              content.content,
              "base64"
            ).toString();

            // Create a prompt that asks the AI to find and apply the suggestion
            const promptContent = `
Analyze this ${ext} file and find opportunities to apply this suggestion: "${suggestion}"

CODE TO ANALYZE:
${fileContent}

Find code in the file that needs this optimization and apply it appropriately.

If you find any code that needs this optimization, return them as a JSON array. Each object must have:
- findText: the exact code to replace (must exist in the file)
- replaceText: the optimized code that implements the suggestion
- reason: detailed explanation of why this code needs the suggested optimization
- category: speed|seo|ux|security
- impact: high|medium|low

IMPORTANT:
1. Only find code that genuinely needs this optimization
2. Make sure the optimization addresses the suggestion
3. Verify that findText exists exactly in the file
4. Keep the same style and formatting as the surrounding code
5. Don't suggest changes that would break functionality
6. Focus on the specific suggestion, don't make unrelated changes

Return an empty array if no opportunities are found.`;

            const optimizations = await analyzeWebsitePerformance(
              promptContent,
              ext.substring(1)
            );

            if (optimizations && optimizations.length > 0) {
              let newContent = fileContent;
              const lines = fileContent.split("\n");

              for (const opt of optimizations) {
                if (
                  opt.findText &&
                  opt.replaceText &&
                  newContent.includes(opt.findText)
                ) {
                  // Find line numbers
                  let startLine = 1;
                  let endLine = 1;
                  for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(opt.findText)) {
                      startLine = i + 1;
                      endLine = startLine + opt.findText.split("\n").length - 1;
                      break;
                    }
                  }

                  newContent = newContent.replace(
                    opt.findText,
                    opt.replaceText
                  );
                  optimizationResults.changes.push({
                    file: file.path,
                    startLine,
                    endLine,
                    category: opt.category,
                    impact: opt.impact,
                    reason: opt.reason,
                    originalCode: opt.findText,
                    newCode: opt.replaceText,
                  });
                }
              }

              // Commit changes if content was modified
              if (newContent !== fileContent) {
                await octokit.repos.createOrUpdateFileContents({
                  owner,
                  repo,
                  path: file.path,
                  message: `AI Optimization: Applied "${suggestion}" to ${file.path}`,
                  content: Buffer.from(newContent).toString("base64"),
                  branch: branchName,
                  sha: content.sha,
                });
              }
            }
          } catch (error) {
            console.error(`Error processing ${file.path}:`, error);
          }
        }
      }
    }

    if (optimizationResults.changes.length > 0) {
      // Create pull request with detailed description
      const prBody = `
# AI-Powered Optimization: ${suggestion}

## Applied Changes
${optimizationResults.changes
  .map(
    (change) =>
      `### File: ${change.file} (lines ${change.startLine}-${change.endLine})
- Category: ${change.category}
- Impact: ${change.impact}
- Reason: ${change.reason}

\`\`\`diff
- ${change.originalCode}
+ ${change.newCode}
\`\`\``
  )
  .join("\n\n")}`;

      const { data: pullRequest } = await octokit.pulls.create({
        owner,
        repo,
        title: `AI Optimization: ${suggestion}`,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      });

      optimizationResults.pullRequest = {
        url: pullRequest.html_url,
        diffUrl: `${pullRequest.html_url}/files`,
      };

      res.json({
        success: true,
        data: optimizationResults,
      });
    } else {
      throw new Error("No opportunities found to apply this optimization");
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
