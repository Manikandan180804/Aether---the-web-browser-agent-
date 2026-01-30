import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

export interface PageState {
    url: string;
    title: string;
    elements: ElementSnapshot[];
    screenshot?: string;
}

export interface ElementSnapshot {
    id: string;
    tagName: string;
    text: string;
    role: string;
    bounds: { x: number; y: number; width: number; height: number };
    attributes: Record<string, string>;
}

export class BrowserManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async initialize() {
        this.browser = await chromium.launch({ headless: false }); // Set to false so you can see the agent work
        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        });
        this.page = await this.context.newPage();

        this.page.setDefaultTimeout(20000);
        this.page.setDefaultNavigationTimeout(20000);
    }

    async navigate(url: string) {
        if (!this.page) throw new Error('Browser not initialized');
        await this.page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });
    }

    async getPageState(): Promise<PageState> {
        if (!this.page) throw new Error('Browser not initialized');

        // Fast check for content stability
        try {
            await this.page.waitForLoadState('domcontentloaded', { timeout: 1000 });
        } catch (e) { }

        const screenshotBuffer = await this.page.screenshot({
            type: 'jpeg',
            quality: 50,
            scale: 'css'
        });
        const screenshot = screenshotBuffer.toString('base64');
        const url = this.page.url();
        const title = await this.page.title();

        // Extract interactable elements and inject stable IDs
        const elements = await this.page.evaluate(() => {
            const interactableSelectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [onclick]';
            const items = Array.from(document.querySelectorAll(interactableSelectors));

            return items.map((el, index) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);

                if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
                    return null;
                }

                // Inject a stable ID for Playwright to target later
                const stableId = `aether-${index}`;
                el.setAttribute('data-aether-id', stableId);

                const attributes: Record<string, string> = {};
                for (const attr of el.attributes) {
                    attributes[attr.name] = attr.value;
                }

                return {
                    id: `el-${index}`,
                    tagName: el.tagName.toLowerCase(),
                    text: (el as HTMLElement).innerText?.trim() ||
                        el.getAttribute('placeholder') ||
                        el.getAttribute('title') ||
                        el.getAttribute('aria-label') ||
                        (el as HTMLInputElement).value || '',
                    role: el.getAttribute('role') || el.tagName.toLowerCase(),
                    bounds: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height
                    },
                    attributes
                };
            }).filter((el): el is ElementSnapshot => el !== null && el.id !== undefined && (el.text !== '' || el.tagName === 'input' || el.tagName === 'button' || el.tagName === 'a'));
        });

        return { url, title, elements, screenshot };
    }

    async click(id: string) {
        if (!this.page) throw new Error('Browser not initialized');

        const stableId = id.replace('el-', 'aether-');
        const element = this.page.locator(`[data-aether-id="${stableId}"]`);

        if (await element.isVisible()) {
            await element.scrollIntoViewIfNeeded();
            try {
                await element.click({ timeout: 5000 });
            } catch (e) {
                await element.evaluate((el: HTMLElement) => el.click());
            }
        } else {
            throw new Error(`Element ${id} is not visible and cannot be clicked.`);
        }
    }

    async type(id: string, text: string) {
        if (!this.page) throw new Error('Browser not initialized');

        const stableId = id.replace('el-', 'aether-');
        const element = this.page.locator(`[data-aether-id="${stableId}"]`);

        if (await element.isVisible()) {
            await element.scrollIntoViewIfNeeded();
            await element.fill(''); // Clear first
            await element.type(text, { delay: 50 });
            await element.press('Enter');
        } else {
            throw new Error(`Element ${id} is not visible and cannot be typed into.`);
        }
    }

    async scroll(direction: 'up' | 'down') {
        if (!this.page) throw new Error('Browser not initialized');
        const amount = direction === 'down' ? 500 : -500;
        await this.page.evaluate((y) => window.scrollBy(0, y), amount);
        await new Promise(r => setTimeout(r, 500)); // Wait for scroll to settle
    }

    async close() {
        if (this.browser) await this.browser.close();
    }

    getCurrentUrl(): string {
        return this.page?.url() || 'about:blank';
    }
}
