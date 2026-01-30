import { BrowserManager } from './browser.js';
import type { PageState } from './browser.js';
import { SYSTEM_PROMPT } from './prompts.js';

export class AetherAgent {
    private browser: BrowserManager;
    private modelName: string;
    private ollamaUrl: string;
    private ollamaApiKey?: string;
    private history: string[] = [];
    private maxSteps = 100; // Super Persistence: 100 steps

    constructor(config: {
        model: string,
        ollamaUrl: string,
        ollamaApiKey?: string
    }) {
        this.modelName = config.model;
        this.ollamaUrl = config.ollamaUrl.replace(/\/$/, '');
        this.ollamaApiKey = config.ollamaApiKey;
        this.browser = new BrowserManager();
    }

    async run(goal: string, onStep?: (step: any) => void) {
        await this.browser.initialize();

        try {
            for (let step = 0; step < this.maxSteps; step++) {
                const state = await this.browser.getPageState();

                // AUTOMATIC KICKSTART: If we are on about:blank, navigate to a starting point
                if (state.url === 'about:blank') {
                    console.log(`[Step ${step}] 🚀 Kickstarting mission from about:blank...`);
                    // Using Bing instead of Google to avoid SecurityCompromiseError / Bot Detection
                    let startUrl = 'https://www.bing.com';
                    if (goal.toLowerCase().includes('youtube')) startUrl = 'https://www.youtube.com';

                    await this.browser.navigate(startUrl);
                    if (onStep) {
                        onStep({
                            step,
                            thought: `Starting the mission! Navigating to ${startUrl} to begin search.`,
                            action: { type: 'navigate', params: { url: startUrl } },
                            screenshot: state.screenshot
                        });
                    }
                    continue;
                }

                const userPrompt = this.constructPrompt(goal, state, step);
                const responseText = await this.callAI(userPrompt);

                if (!responseText) {
                    const errMsg = "Empty response from AI - check API key/balance.";
                    console.error(`[Step ${step}] ❌ ${errMsg}`);
                    if (onStep) onStep({ type: 'error', message: errMsg });
                    // Wait 3 seconds on error to prevent infinite fast loop
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }

                console.log(`\n[STEP ${step}] ------------------------------------------------`);
                console.log(`URL: ${state.url}`);
                console.log(`THOUGHT: ${responseText.substring(0, 300)}...`);

                const actionObj = this.parseResponse(responseText);

                if (onStep) {
                    onStep({
                        step,
                        thought: actionObj?.thought || responseText.substring(0, 200),
                        action: actionObj?.action || { type: 'parsing_error', params: { raw: responseText } },
                        screenshot: state.screenshot
                    });
                }

                if (!actionObj) {
                    console.error("Failed to parse agent response. Retrying...");
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                // Loop detection
                const currentActionStr = JSON.stringify(actionObj.action);
                const actionOccurrences = this.history.filter(a => a === currentActionStr).length;
                if (actionOccurrences >= 5) {
                    console.warn("⚠️ Loop detected! Forcing model to reconsider strategy.");
                    // We don't stop, but the history in the prompt will show the repetition
                }

                if (actionObj.action.type === 'finish') {
                    console.log("✅ Mission complete! Browser will remain open.");
                    return actionObj.action.params.answer;
                }

                try {
                    await this.executeAction(actionObj.action);
                } catch (actionError: any) {
                    console.error("Action execution failed:", actionError.message);
                    if (onStep) onStep({ type: 'error', message: actionError.message });
                }

                // Increased delay for better stability
                await new Promise(r => setTimeout(r, 800));
            }

            console.log(`⚠️ Max steps (${this.maxSteps}) reached. Browser will remain open.`);
            return `Mission Timed Out: Max steps (${this.maxSteps}) reached. Please check the browser window to see if the goal was partially achieved.`;
        } catch (error) {
            console.error("Agent error:", error);
            throw error;
        }
    }

    async cleanup() {
        await this.browser.close();
    }

    getFinalUrl(): string {
        return this.browser.getCurrentUrl();
    }

    private async callAI(prompt: string): Promise<string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.ollamaApiKey) {
            headers['Authorization'] = `Bearer ${this.ollamaApiKey}`;
        }

        const isCloud = (this.ollamaUrl.includes('siliconflow') || this.ollamaUrl.includes('api.')) && !this.ollamaUrl.includes('ollama.com');
        const endpoint = isCloud ? `${this.ollamaUrl}/chat/completions` : `${this.ollamaUrl}/api/generate`;

        const body: any = isCloud ? {
            model: this.modelName,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1
        } : {
            model: this.modelName,
            prompt: `${SYSTEM_PROMPT}\n\n${prompt}`,
            stream: false,
            options: { temperature: 0.1 }
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`🚨 SiliconFlow/AI API Error: ${response.status} - ${errText}`);
                return "";
            }

            const data = await response.json();

            // Handle both formats
            if (isCloud && data.choices?.[0]?.message?.content) {
                return data.choices[0].message.content;
            } else if (data.response) {
                return data.response;
            }

            console.error("🔍 Unknown AI response format:", JSON.stringify(data));
            return "";
        } catch (err: any) {
            console.error("🔥 🔥 Unexpected Fetch error in callAI:", err.message);
            return "";
        }
    }

    private parseResponse(text: string) {
        let start = text.indexOf('{');
        if (start === -1) return null;

        let end = -1;
        let bracketCount = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const char = text[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') bracketCount++;
                if (char === '}') {
                    bracketCount--;
                    if (bracketCount === 0) {
                        end = i;
                        break;
                    }
                }
            }
        }

        if (end === -1) return null;

        const jsonStr = text.substring(start, end + 1);

        try {
            return JSON.parse(jsonStr);
        } catch (firstError: any) {
            try {
                let cleaned = jsonStr
                    .replace(/\/\/.*$/gm, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/,(\s*[}\]])/g, '$1');

                return JSON.parse(cleaned);
            } catch (secondError: any) {
                console.error("Agent JSON Parse Error:", secondError.message);
                return null;
            }
        }
    }

    private constructPrompt(goal: string, state: PageState, currentStep: number): string {
        const elementsStr = state.elements
            .map(el => {
                const desc = [
                    el.tagName ? `<${el.tagName}>` : '',
                    el.text ? `"${el.text}"` : '',
                    el.attributes?.placeholder ? `(placeholder: ${el.attributes.placeholder})` : '',
                    el.role ? `(role: ${el.role})` : ''
                ].filter(s => s).join(' ');
                return `${el.id}: ${desc}`;
            })
            .slice(0, 80) // Reduced to 80 for better token stability
            .join('\n');

        const warning = currentStep > this.maxSteps * 0.7
            ? `\n⚠️ WARNING: You are at step ${currentStep}/${this.maxSteps}. You MUST finish the goal soon or you will time out.`
            : '';

        const loopWarning = this.history.slice(-3).every(a => a === this.history[this.history.length - 1]) && this.history.length >= 3
            ? `\n⚠️ LOOP DETECTED: You have performed the same action 3 times. TRY SOMETHING DIFFERENT (e.g., click a different link, scroll, or navigate).`
            : '';

        return `
GOAL: ${goal}
CURRENT STEP: ${currentStep}/${this.maxSteps}${warning}${loopWarning}
URL: ${state.url}
TITLE: ${state.title}

ELEMENTS:
${elementsStr}

HISTORY (Last 10 actions):
${this.history.slice(-10).join('\n') || 'None'}
`;
    }

    private async executeAction(action: any) {
        const { type, params } = action;
        this.history.push(JSON.stringify(action));

        switch (type) {
            case 'navigate':
                await this.browser.navigate(params.url);
                break;
            case 'click':
                await this.browser.click(params.id);
                break;
            case 'type':
                await this.browser.type(params.id, params.text);
                await new Promise(r => setTimeout(r, 2000));
                break;
            case 'scroll':
                await this.browser.scroll(params.direction);
                break;
            case 'wait':
                await new Promise(r => setTimeout(r, params.ms || 2000));
                break;
        }
    }
}
