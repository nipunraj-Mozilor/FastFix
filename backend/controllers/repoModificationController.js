import { Octokit } from "@octokit/rest";
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

const getGitConfig = async () => {
    try {
        const configPath = path.join(process.cwd(), 'config.json');

        const config = await fs.readFile(configPath, 'utf8');
        
        return JSON.parse(config);
    } catch (error) {
        throw new Error('GitHub configuration not found. Please ensure config.json is set up in the backend folder');
    }
};

const modifyMultipleFiles = async (changes) => {
    try {
        const config = await getGitConfig();
        const { githubToken, owner, repo } = config;
        
        const octokit = new Octokit({
            auth: githubToken
        });

        // Create a new branch
        const branchName = `fix-${Date.now()}`;
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

        // Group changes by file path
        const changesByFile = changes.reduce((acc, change) => {
            if (!acc[change.filePath]) {
                acc[change.filePath] = [];
            }
            acc[change.filePath].push(change);
            return acc;
        }, {});

        const results = [];
        
        // Process each file
        for (const [filePath, fileChanges] of Object.entries(changesByFile)) {
            try {
                // Get the file content
                const { data: fileData } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: filePath,
                });

                // Apply all changes to the file content
                let newContent = Buffer.from(fileData.content, 'base64').toString();
                
                // Apply each change sequentially
                for (const change of fileChanges) {
                    const findRegex = new RegExp(change.findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    newContent = newContent.replace(findRegex, change.replaceText);
                }

                // Commit the changes
                await octokit.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path: filePath,
                    message: 'Automatic fix',
                    content: Buffer.from(newContent).toString('base64'),
                    branch: branchName,
                    sha: fileData.sha
                });

                results.push({
                    filePath,
                    status: 'success',
                    newContent
                });
            } catch (error) {
                results.push({
                    filePath,
                    status: 'error',
                    error: error.message
                });
            }
        }

        // Create pull request
        const { data: pullRequest } = await octokit.pulls.create({
            owner,
            repo,
            title: 'Automatic fixes',
            body: 'Multiple file updates',
            head: branchName,
            base: 'main'
        });

        return { results, pullRequest };
    } catch (error) {
        throw new Error(`Failed to modify files: ${error.message}`);
    }
};

export const modifyRepo = async (req, res) => {
    try {
        const { changes } = req.body;
        
        if (!Array.isArray(changes) || changes.length === 0) {
            return res.status(400).json({ 
                error: 'Required field missing: changes array with file modifications' 
            });
        }

        // Validate each change object
        for (const change of changes) {
            if (!change.filePath || !change.findText || !change.replaceText) {
                return res.status(400).json({ 
                    error: 'Each change must include filePath, findText, and replaceText' 
                });
            }
        }

        // Process all changes in a single PR
        const { results, pullRequest } = await modifyMultipleFiles(changes);

        res.json({
            results,
            pullRequest
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};