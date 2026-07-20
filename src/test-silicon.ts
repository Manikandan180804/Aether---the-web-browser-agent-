import dotenv from 'dotenv';
dotenv.config();

async function testSiliconFlow() {
    const apiKey = process.env.OLLAMA_API_KEY;
    const url = "https://api.siliconflow.cn/v1/chat/completions";

    console.log("Testing SiliconFlow API...");
    console.log("URL:", url);
    console.log("Key Prefix:", apiKey?.substring(0, 10));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "meta-llama/Llama-3.3-70B-Instruct",
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 10
            })
        });

        const status = response.status;
        const text = await response.text();
        console.log(`Status: ${status}`);
        console.log(`Response: ${text}`);

        if (status === 200) {
            console.log("✅ API Key is working!");
        } else {
            console.log("❌ API Key failed.");
        }
    } catch (err: any) {
        console.error("🔥 Error:", err.message);
    }
}

testSiliconFlow();
