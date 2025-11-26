// index.js
import { Client, GatewayIntentBits } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const genai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const conversations = {};

const badWords = [
    "dm", "đm", "cặc", "lồn", "loz", "l0z",
    "vcl", "clm", "đụ", "đjt", "shit", "fuck",
    "bitch", "motherfucker", "địt", "djt"
];

function containsBadWords(text) {
    const t = text.toLowerCase();
    return badWords.some(w => t.includes(w));
}

client.on("ready", () => {
    console.log(`🔥 Bot đã online: ${client.user.tag}`);
});

function splitMessage(text, maxLength = 2000) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        chunks.push(text.slice(start, start + maxLength));
        start += maxLength;
    }
    return chunks;
}

client.on("messageCreate", async(message) => {
    if (message.author.bot) return;

    const content = message.content.trim();

    if (containsBadWords(content)) {
        await message.reply("⚠️ **Ê ông, hạn chế chửi thề trong nhóm nha. Giữ văn minh xíu.**");
        return;
    }

    // ==========================
    // /point - ngắn gọn
    // ==========================
    if (content.startsWith("/point")) {
        const workText = content.replace("/point", "").trim();
        if (!workText) {
            await message.reply("⚠️ Vui lòng gửi bài làm sau `/point` để bot chấm.");
            return;
        }

        const pointPrompt = `
Bạn là giáo viên đại học, chấm điểm bài tập sinh viên.
Bài làm: """${workText}"""
Yêu cầu:
- Chấm điểm theo thang 0-10.
- Chỉ ra tối đa 2-3 sai sót chính, giải thích ngắn gọn, dễ hiểu.
- Dùng Markdown để format output.
- Format trả về:
**Điểm:** ...
**Sai sót:**
1️⃣ ...
2️⃣ ...
`;

        try {
            const response = await genai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: pointPrompt,
                temperature: 0.7,
            });

            let answer = response.text || "Bot lag sml rồi 😭";
            const chunks = splitMessage(answer);
            for (const chunk of chunks) {
                await message.channel.send(chunk);
            }
        } catch (err) {
            console.error("Gemini API Error:", err);
            await message.channel.send("Bot lỗi khi chấm điểm, gọi cứu hộ 🚑");
        }
        return;
    }

    // ==========================
    // /feedback - chi tiết
    // ==========================
    if (content.startsWith("/feedback")) {
        const workText = content.replace("/feedback", "").trim();
        if (!workText) {
            await message.reply("⚠️ Vui lòng gửi bài làm sau `/feedback` để bot phân tích.");
            return;
        }

        const feedbackPrompt = `
Bạn là giáo viên đại học, chấm điểm bài tập sinh viên.
Bài làm: """${workText}"""
Yêu cầu:
- Chấm điểm theo thang 0-10.
- Chỉ ra các sai sót, giải thích chi tiết và cách cải thiện từng lỗi.
- Nêu điểm mạnh bài làm.
- Sử dụng Markdown để in đậm tiêu đề (**Điểm**, **Sai sót**, **Điểm mạnh**).
- Format:
**Điểm:** ...
**Nhận xét tổng quát:** ...
**Sai sót và cách cải thiện:**
1️⃣ ...
2️⃣ ...
...
**Điểm mạnh:**
- ...
- ...
Kết thúc feedback: Động viên sinh viên học tốt.
`;

        try {
            const response = await genai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: feedbackPrompt,
                temperature: 0.7,
            });

            let answer = response.text || "Bot lag sml rồi 😭";
            const chunks = splitMessage(answer);
            for (const chunk of chunks) {
                await message.channel.send(chunk);
            }
        } catch (err) {
            console.error("Gemini API Error:", err);
            await message.channel.send("Bot lỗi khi phân tích, gọi cứu hộ 🚑");
        }
        return;
    }

    // ==========================
    // !ask hoặc ? hỏi AI
    // ==========================
    if (!content.startsWith("!ask") && !content.endsWith("?")) return;

    const prompt = content.startsWith("!ask") ?
        content.replace("!ask", "").trim() :
        content;

    if (!conversations[message.channel.id]) conversations[message.channel.id] = [];

    conversations[message.channel.id].push({ role: "user", content: prompt });
    if (conversations[message.channel.id].length > 10)
        conversations[message.channel.id].shift();

    const isBug =
        /(bug|lỗi|sai|error|exception|không chạy|crash|toang|bị lỗi|fix|undefined|stack|compile)/i.test(prompt);

    const isProcess =
        /(làm sao|làm thế nào|như thế nào|cách làm|quy trình|hướng dẫn|how to|cách để|làm kiểu gì|procedure)/i.test(prompt);

    let tone = "";

    if (isBug) {
        tone = `
Bạn là một thằng bạn thân cà khịa, chửi mạnh bạo nhưng vui vẻ và thương bạn.
User đang hỏi BUG hoặc lỗi code.
Hãy:
- Chửi kiểu bạn thân: "trời đất ơi", "cái gì đây cha nội", "lỗi thấy gớm".
- Có văng tục nhẹ nhưng không quá nặng.
- Không xúc phạm cá nhân, không đụng gia đình.
- Chỉ rõ lỗi code, giải thích dễ hiểu.
`;
    } else if (isProcess) {
        tone = `
Bạn là thằng bạn thân thất vọng nhưng thương bạn.
User đang hỏi về quy trình / cách làm.
Hãy:
- Giọng thất vọng nhẹ: "trời má, cái này cũng phải hỏi nữa hả…".
- Hướng dẫn rõ ràng, chi tiết.
`;
    } else {
        tone = `
Bạn là bạn thân vui tính nhưng cọc cằn.
Nói chuyện kiểu đời thường có văng tục nhẹ như  "vãi".
Trả lời ngắn gọn, dễ hiểu, đầy đủ nội dung.
`;
    }

    const aiPrompt =
        tone +
        "\n\n" +
        conversations[message.channel.id]
        .map((m) => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`)
        .join("\n") +
        "\nBot:";

    try {
        const response = await genai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: aiPrompt,
            temperature: 0.75,
        });

        let answer = response.text || "Bot lag sml rồi 😭";
        const chunks = splitMessage(answer);
        for (const chunk of chunks) {
            await message.channel.send(chunk);
        }

        conversations[message.channel.id].push({ role: "bot", content: answer });
        if (conversations[message.channel.id].length > 10)
            conversations[message.channel.id].shift();

    } catch (err) {
        console.error("Gemini API Error:", err);
        await message.channel.send("Bot lỗi sml rồi, gọi cứu hộ đi 🚑");
    }
});

client.login(process.env.DISCORD_TOKEN);