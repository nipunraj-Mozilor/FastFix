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
        throw new Error('GitHub configuration not found. Please ensure config.json is set up in the backend folder');
    }
};

const suggestChanges = async (content, context) => {
    const config = await getGitConfig();
    const llm = new ChatOpenAI({
        temperature: 0.7,
        modelName: "gpt-4",
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create a simpler prompt template
    const promptTemplate = `
Analyze this code and suggest improvements:

CODE:
{content}

CONTEXT:
{context}

Provide suggestions for:
1. Better variable names
2. Code style consistency
3. Performance optimizations
4. Best practices
5. Potential bugs

Format your response as a JSON array with this structure:
[
  {
    "findText": "text to find",
    "replaceText": "text to replace with",
    "reason": "explanation"
  }
]`;

    const prompt = PromptTemplate.fromTemplate(promptTemplate);

    try {
        const formattedPrompt = await prompt.format({
            content: content || '',
            context: typeof context === 'object' ? JSON.stringify(context) : context || ''
        });

        const response = await llm.invoke(formattedPrompt);
        
        try {
            return JSON.parse(response.content);
        } catch (error) {
            console.error('Failed to parse AI suggestions:', response.content);
            return [];
        }
    } catch (error) {
        console.error('Error in AI suggestion generation:', error);
        return [];
    }
};

const generatePRDescription = async (changes, results) => {
    const config = await getGitConfig();
    const llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    const response = await llm.invoke(
        `Generate a clear PR description for these changes:
        ${JSON.stringify(changes)}

        Results:
        ${JSON.stringify(results)}

        Include:
        1. Summary of changes
        2. Impact analysis
        3. Testing recommendations`
    );

    return response.content;
};

const searchAndModifyWithAI = async (changes) => {
    try {
        const config = await getGitConfig();
        const { githubToken, owner, repo } = config;
        
        const octokit = new Octokit({
            auth: githubToken
        });

        // Create a new branch
        const branchName = `ai-fix-${Date.now()}`;
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

        // Get all files in the repository
        const { data: tree } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: ref.object.sha,
            recursive: 'true'
        });

        const results = [];
        const aiSuggestions = {};
        
        // Process each file
        for (const file of tree.tree) {
            if (file.type === 'blob') {
                try {
                    const { data: content } = await octokit.repos.getContent({
                        owner,
                        repo,
                        path: file.path
                    });

                    const fileContent = Buffer.from(content.content, 'base64').toString();

                    // Check if file contains any of the search texts
                    let needsModification = false;
                    for (const change of changes) {
                        if (fileContent.includes(change.findText)) {
                            needsModification = true;
                            break;
                        }
                    }

                    if (needsModification) {
                        // Get AI suggestions for this file
                        const suggestions = await suggestChanges(fileContent, {
                            fileType: path.extname(file.path),
                            fileName: file.path
                        });
                        aiSuggestions[file.path] = suggestions;

                        // Apply user changes and AI suggestions
                        let newContent = fileContent;
                        const allChanges = [...changes, ...suggestions];

                        for (const change of allChanges) {
                            const findRegex = new RegExp(change.findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                            newContent = newContent.replace(findRegex, change.replaceText);
                        }

                        // Commit changes
                        await octokit.repos.createOrUpdateFileContents({
                            owner,
                            repo,
                            path: file.path,
                            message: 'AI-assisted automatic fix',
                            content: Buffer.from(newContent).toString('base64'),
                            branch: branchName,
                            sha: content.sha
                        });

                        results.push({
                            filePath: file.path,
                            status: 'success',
                            newContent,
                            aiSuggestions: suggestions
                        });
                    }
                } catch (error) {
                    console.error(`Error processing file ${file.path}:`, error);
                    results.push({
                        filePath: file.path,
                        status: 'error',
                        error: error.message
                    });
                }
            }
        }

        // Check if any changes were made
        if (results.length === 0) {
            throw new Error('No matching content found to modify');
        }

        // Check if any successful changes were made
        const successfulChanges = results.filter(r => r.status === 'success');
        if (successfulChanges.length === 0) {
            throw new Error('No successful modifications were made');
        }

        // Generate AI-powered PR description
        const prDescription = await generatePRDescription(changes, successfulChanges);

        // Create pull request
        const { data: pullRequest } = await octokit.pulls.create({
            owner,
            repo,
            title: 'AI-Assisted: Automatic fixes',
            body: prDescription,
            head: branchName,
            base: 'main'
        });

        return { 
            results, 
            pullRequest,
            aiSuggestions
        };
    } catch (error) {
        // Clean up the branch if there was an error
        if (error.message.includes('No commits between')) {
            try {
                await octokit.git.deleteRef({
                    owner,
                    repo,
                    ref: `heads/${branchName}`
                });
            } catch (deleteError) {
                console.error('Failed to delete branch:', deleteError);
            }
        }
        throw new Error(`Failed to modify files: ${error.message}`);
    }
};

export const aiModifyRepo = async (req, res) => {
    try {
        const { changes } = req.body;
        
        if (!Array.isArray(changes) || changes.length === 0) {
            return res.status(400).json({ 
                error: 'Required field missing: changes array with modifications' 
            });
        }

        // Validate each change object
        for (const change of changes) {
            if (!change.findText || !change.replaceText) {
                return res.status(400).json({ 
                    error: 'Each change must include findText and replaceText' 
                });
            }
        }

        // Process changes with AI assistance
        const { results, pullRequest, aiSuggestions } = await searchAndModifyWithAI(changes);

        res.json({
            results,
            pullRequest,
            aiSuggestions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}; 