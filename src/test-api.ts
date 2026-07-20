import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testGeminiAPI() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in .env file');
        return;
    }

    console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
    console.log('📝 Testing Gemini API connection...\n');

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const result = await model.generateContent('Say "Hello, API is working!"');
        const response = result.response.text();

        console.log('✅ SUCCESS! API is working!');
        console.log('📤 Response:', response);
        console.log('\n✨ Your Gemini API key is valid and working correctly!');
    } catch (error: any) {
        console.error('❌ ERROR:', error.message);
        console.error('\n🔍 Troubleshooting steps:');
        console.error('1. Go to: https://aistudio.google.com/app/apikey');
        console.error('2. Create a NEW API key (click "Create API key")');
        console.error('3. Make sure to select "Create API key in new project"');
        console.error('4. Copy the ENTIRE key (starts with AIzaSy...)');
        console.error('5. Update your .env file with the new key');
        console.error('6. Run this test again: npm run test-api');
    }
}

testGeminiAPI();
