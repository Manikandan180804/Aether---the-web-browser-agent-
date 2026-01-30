import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AetherAgent } from '../agent/agent.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Ollama configurations
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

app.get('/', (_req, res) => {
    res.json({
        status: 'OK',
        message: 'Aether Agent Backend is running',
        config: {
            provider: 'ollama',
            activeModel: OLLAMA_MODEL
        }
    });
});

app.post('/api/run', async (req, res) => {
    const { goal } = req.body;

    if (!goal) {
        return res.status(400).json({ error: 'Goal is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const agentConfig = {
        model: OLLAMA_MODEL,
        ollamaUrl: OLLAMA_URL,
        ollamaApiKey: OLLAMA_API_KEY
    };

    const agent = new AetherAgent(agentConfig);

    try {
        const result = await agent.run(goal, (step) => {
            res.write(`data: ${JSON.stringify(step)}\n\n`);
        });

        const finalUrl = agent.getFinalUrl();

        res.write(`data: ${JSON.stringify({ type: 'finish', answer: result, finalUrl })}\n\n`);
        res.end();
    } catch (error: any) {
        console.error('Agent error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`AI Provider: ollama`);
});
