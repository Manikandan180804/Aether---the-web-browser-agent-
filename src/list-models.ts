import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in .env file');
        return;
    }

    console.log('🔍 Fetching available models for your API key...\n');

    try {
        // List all available models
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        const data = await response.json();

        if (data.models) {
            console.log('✅ Available models:\n');
            data.models.forEach((model: any) => {
                const name = model.name.replace('models/', '');
                const methods = model.supportedGenerationMethods || [];
                console.log(`📦 ${name}`);
                console.log(`   Methods: ${methods.join(', ')}`);
                console.log('');
            });
        } else {
            console.error('❌ No models found:', data);
        }
    } catch (error: any) {
        console.error('❌ ERROR:', error.message);
    }
}

listModels();
