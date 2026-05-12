import { fetch } from 'undici';

async function main() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("no key");
    
    const body = {
        model: "gpt-4o",
        input: [{ role: "user", content: "Say hello!" }],
        stream: true
    };

    const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(body)
    });

    const reader = res.body?.getReader();
    if (!reader) return;
    
    const dec = new TextDecoder();
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        console.log(dec.decode(value));
    }
}
main().catch(console.error);
