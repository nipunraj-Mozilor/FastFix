import { Octokit } from "@octokit/rest";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import path from 'path';
import { promises as fs } from 'fs';

const getGitConfig = async () => {
    try {
        const configPath = path.join(process.cwd(), 'config.json');
        const config = await fs.readFile(configPath, 'utf8');
        return JSON.parse(config);
    } catch (error) {
        throw new Error('Configuration not found. Please ensure config.json is set up');
    }
};

const analyzeWebsitePerformance = async (content, fileType) => {
    const config = await getGitConfig();
    const llm = new ChatOpenAI({
        temperature: 0.7,
        modelName: "gpt-4",
        openAIApiKey: config.openAIApiKey
    });

    const promptTemplate = `
You are a website optimization expert. Analyze this {fileType} code and suggest improvements:

CODE:
{content}

Focus on these areas:
1. Loading Speed:
   - Resource optimization
   - Code minification
   - Lazy loading opportunities
   - Caching strategies

2. SEO Optimization:
   - Meta tags
   - Semantic HTML
   - Content structure
   - Accessibility

3. User Experience:
   - Mobile responsiveness
   - Core Web Vitals
   - Interactive elements
   - Loading indicators

4. Best Practices:
   - Browser compatibility
   - Performance patterns
   - Error handling
   - Security considerations

Return a JSON array of changes. Each object in the array must have these properties:
- findText (string): the exact code to replace
- replaceText (string): the optimized code
- reason (string): explanation of the improvement
- category (string): must be one of: speed, seo, ux, security
- impact (string): must be one of: high, medium, low

For example, to add lazy loading to images, you would return:
A JSON array containing an object with findText as the original img tag, replaceText as the img tag with lazy loading, reason explaining the performance benefit, category as "speed", and impact as "high".

Remember to escape any special characters in the code snippets and ensure the response is valid JSON.`;

    const prompt = PromptTemplate.fromTemplate(promptTemplate);

    try {
        const formattedPrompt = await prompt.format({
            fileType: fileType || 'code',
            content: content || ''
        });

        const response = await llm.invoke(formattedPrompt);
        
        try {
            const parsedResponse = JSON.parse(response.content);
            console.log('Parsed AI suggestions:', JSON.stringify(parsedResponse, null, 2));
            return parsedResponse;
        } catch (parseError) {
            console.error('Failed to parse AI response:', response.content);
            return [];
        }
    } catch (error) {
        console.error('Error in performance analysis:', error);
        return [];
    }
};

const optimizeWebsite = async (req, res) => {
    try {
        const config = await getGitConfig();
        const { githubToken, owner, repo } = config;
        
        const octokit = new Octokit({
            auth: githubToken
        });

        // Create optimization branch
        const branchName = `ai-optimize-${Date.now()}`;
        const { data: ref } = await octokit.git.getRef({
            owner,
            repo,
            ref: 'heads/main'
        });

        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: ref.object.sha
        });

        // Get repository files
        const { data: tree } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: ref.object.sha,
            recursive: 'true'
        });

        // Create a simplified results object
        const optimizationResults = {
            changes: [],
            pullRequest: {
                url: '',
                diffUrl: ''
            }
        };

        // Process files
        for (const file of tree.tree) {
            if (file.type === 'blob') {
                const ext = path.extname(file.path).toLowerCase();
                if (['.html', '.css', '.js'].includes(ext)) {
                    try {
                        console.log(`Analyzing ${file.path}...`);
                        const { data: content } = await octokit.repos.getContent({
                            owner,
                            repo,
                            path: file.path
                        });

                        const fileContent = Buffer.from(content.content, 'base64').toString();
                        const optimizations = await analyzeWebsitePerformance(fileContent, ext.substring(1));
                        
                        if (optimizations && optimizations.length > 0) {
                            let newContent = fileContent;
                            const lines = fileContent.split('\n');
                            
                            // Apply optimizations
                            for (const opt of optimizations) {
                                if (opt.findText && opt.replaceText && newContent.includes(opt.findText)) {
                                    // Find the line number for this change
                                    let startLine = 1;
                                    let endLine = 1;
                                    
                                    // Find the line numbers by searching through the file content
                                    for (let i = 0; i < lines.length; i++) {
                                        if (lines[i].includes(opt.findText)) {
                                            startLine = i + 1;
                                            // Calculate endLine based on number of newlines in the original text
                                            const newLines = opt.findText.split('\n').length;
                                            endLine = startLine + newLines - 1;
                                            break;
                                        }
                                    }

                                    newContent = newContent.replace(opt.findText, opt.replaceText);
                                    
                                    // Add change details to results with line numbers
                                    optimizationResults.changes.push({
                                        file: file.path,
                                        startLine,
                                        endLine,
                                        category: opt.category,
                                        impact: opt.impact,
                                        reason: opt.reason,
                                        originalCode: opt.findText,
                                        newCode: opt.replaceText
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
                                    content: Buffer.from(newContent).toString('base64'),
                                    branch: branchName,
                                    sha: content.sha
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

${optimizationResults.changes.map(change => 
    `- **${change.file}** (lines ${change.startLine}-${change.endLine}):
    - Category: ${change.category}
    - Impact: ${change.impact}
    - Reason: ${change.reason}`
).join('\n\n')}`;

            const { data: pullRequest } = await octokit.pulls.create({
                owner,
                repo,
                title: 'AI-Powered Website Optimization',
                body: prBody,
                head: branchName,
                base: 'main'
            });

            // Add PR URLs to results
            optimizationResults.pullRequest = {
                url: pullRequest.html_url,
                diffUrl: `${pullRequest.html_url}/files`
            };

            res.json({
                success: true,
                data: optimizationResults
            });
        } else {
            throw new Error('No optimization opportunities found');
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

export { optimizeWebsite }; 