import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("OpenAI API key is not set. Please check your .env file.");
}

// Initialize the OpenAI model
const model = new OpenAI({
  openAIApiKey: OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

// Create a prompt template for analysis
const analysisPrompt = PromptTemplate.fromTemplate(`
You are a web performance expert. Analyze these website metrics and provide insights:

Performance Score: {performance}%
Accessibility Score: {accessibility}%
Best Practices Score: {bestPractices}%
SEO Score: {seo}%

Performance Metrics:
- First Contentful Paint: {fcp}
- Largest Contentful Paint: {lcp}
- Total Blocking Time: {tbt}
- Cumulative Layout Shift: {cls}
- Speed Index: {si}
- Time to Interactive: {tti}

Please provide a concise analysis in the following format:

1. Overall Assessment (2-3 sentences about the website's performance)
2. Critical Issues (list the top 2-3 most important issues)
3. Key Recommendations (3 specific, actionable steps to improve the scores)

Keep the response clear and actionable, focusing on the most impactful improvements.
`);

// Create the analysis chain
const analysisChain = RunnableSequence.from([analysisPrompt, model]);

// Create a prompt template for issue-specific recommendations
const issueRecommendationPrompt = PromptTemplate.fromTemplate(`
You are a web performance and accessibility expert. Generate specific recommendations for the following issue:

Issue Type: {issueType}
Issue Title: {title}
Description: {description}
Impact Score: {impact}

For Accessibility Issues, provide recommendations based on the specific violation:
- For missing alt attributes: Suggest appropriate alt text based on image context and purpose
- For color contrast: Provide specific color values that meet WCAG guidelines
- For keyboard navigation: Suggest proper tabindex and focus management
- For ARIA labels: Recommend appropriate ARIA attributes and roles
- For form controls: Suggest proper label associations and form structure
- For heading hierarchy: Recommend proper heading structure
- For link text: Suggest descriptive link text improvements
- For multimedia: Recommend proper captions and transcripts
- For dynamic content: Suggest proper live regions and updates
- For touch targets: Recommend proper sizing and spacing

Please provide 3 specific, actionable recommendations in this format:
1. [Title of Recommendation]
   - Issue Detection: [How to identify affected elements]
   - Implementation: [Step-by-step technical implementation]
   - Code Example: [If applicable, provide a code snippet]
   - Validation: [How to verify the fix]
   - Expected Impact: [Specific improvement in accessibility]

For code examples, include:
- Proper HTML structure
- Required ARIA attributes
- Event handlers if needed
- CSS modifications if required
- JavaScript snippets if dynamic functionality is needed

Keep recommendations technical, specific, and focused on WCAG 2.1 compliance.
`);

// Create the recommendation chain
const recommendationChain = RunnableSequence.from([
  issueRecommendationPrompt,
  model,
]);

export async function getAIAnalysis(results) {
  try {
    const input = {
      performance: Math.round(results.performance.score),
      accessibility: Math.round(results.accessibility.score),
      bestPractices: Math.round(results.bestPractices.score),
      seo: Math.round(results.seo.score),
      fcp: results.performance.metrics?.fcp?.displayValue || "N/A",
      lcp: results.performance.metrics?.lcp?.displayValue || "N/A",
      tbt: results.performance.metrics?.tbt?.displayValue || "N/A",
      cls: results.performance.metrics?.cls?.displayValue || "N/A",
      si: results.performance.metrics?.si?.displayValue || "N/A",
      tti: results.performance.metrics?.tti?.displayValue || "N/A",
    };

    const response = await analysisChain.invoke(input);
    return (
      response?.choices?.[0]?.message?.content || response?.content || response
    );
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw new Error("Failed to generate AI analysis");
  }
}

export async function getIssueRecommendations(issue) {
  try {
    const input = {
      issueType: issue.type,
      title: issue.title,
      description: issue.description,
      impact: issue.impact,
    };

    const response = await recommendationChain.invoke(input);
    const content =
      response?.choices?.[0]?.message?.content || response?.content || response;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the recommendations
    const recommendations = [];
    const sections = content.split(/\d+\.\s+/).filter(Boolean);

    for (const section of sections) {
      const lines = section
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const title = lines[0];
      let implementation = "";
      let codeExample = "";
      let expectedImpact = "";

      // Process each line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("Implementation:")) {
          implementation = line.replace("- Implementation:", "").trim();
        } else if (line.includes("Code Example:")) {
          // Find the code block
          let codeBlock = "";
          i++; // Move to next line
          if (i < lines.length && lines[i].includes("```")) {
            i++; // Skip the opening ```
            while (i < lines.length && !lines[i].includes("```")) {
              codeBlock += lines[i] + "\n";
              i++;
            }
          }
          codeExample = codeBlock.trim();
        } else if (line.includes("Expected Impact:")) {
          expectedImpact = line.replace("- Expected Impact:", "").trim();
        }
      }

      recommendations.push({
        suggestion: title,
        implementation,
        codeExample,
        expectedImpact,
        selector: null,
        snippet: codeExample || null,
      });
    }

    return recommendations;
  } catch (error) {
    console.error("AI Recommendations failed:", error);
    console.error("Error details:", error.message);
    throw new Error("Failed to generate recommendations");
  }
}
