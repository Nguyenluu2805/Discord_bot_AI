import { Client, GatewayIntentBits } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";
import fetch from "node-fetch";

dotenv.config();

// ==========================================
// UPTIME ROBOT SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is alive!");
});
server.listen(PORT, () => console.log(`🌐 Uptime Server đang chạy tại port: ${PORT}`));

// ==========================================
// CONFIG & CLIENT
// ==========================================
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

// ==================== HÀM HỖ TRỢ ĐỌC FILE ====================
// Hàm này chỉ lấy nội dung text từ file đính kèm (nếu có)
async function getAttachmentText(message) {
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        // Kiểm tra sơ bộ xem có phải file code/text không
        const validExtensions = [".txt", ".js", ".py", ".cpp", ".c", ".java", ".html", ".css", ".json", ".md"];
        const isTextType = attachment.contentType && attachment.contentType.includes("text");
        const isCodeExt = validExtensions.some(ext => attachment.name.endsWith(ext));

        if (isTextType || isCodeExt) {
            try {
                const response = await fetch(attachment.url);
                if (!response.ok) return null;
                const text = await response.text();
                return `\n\n[NỘI DUNG FILE ĐÍNH KÈM: ${attachment.name}]\n${text}`;
            } catch (error) {
                console.error("Lỗi đọc file:", error);
                return null;
            }
        }
    }
    return null;
}

// ==================== HÀM XỬ LÝ CHẤM ĐIỂM (/POINT) ====================
async function handlePoint(message, workText) {
    if (!workText) {
        await message.reply("⚠️ Vui lòng gửi bài làm (text hoặc file) sau `/point` để bot chấm.");
        return;
    }

    const pointPrompt = `
Bạn là giáo viên đại học, chấm điểm bài tập sinh viên.
Bài làm: """${workText}"""
Yêu cầu:
- Chấm điểm 0-10
- Chỉ ra tối đa 3 lỗi
- Ngắn gọn
- Markdown

FORMAT:
**Điểm:** ...
**Sai sót:**
1️⃣ ...
2️⃣ ...
3️⃣ ...
`;

    try {
        const response = await genai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: pointPrompt,
            config: { temperature: 0.7 },
        });

        const answer = response.text || "Bot lag sml rồi 😭";
        const chunks = splitMessage(answer);
        for (const chunk of chunks) {
            await message.channel.send(chunk);
        }
    } catch (err) {
        console.error(err);
        await message.channel.send("Bot lỗi khi chấm điểm 🚑");
    }
}

// ==================== MAIN MESSAGE HANDLER ====================
client.on("messageCreate", async(message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    // 1. Kiểm tra từ cấm
    if (containsBadWords(content)) {
        await message.reply("⚠️ **Ê ông, hạn chế chửi thề trong nhóm nha. Giữ văn minh xíu.**");
        return;
    }

    // 2. Xử lý lệnh /examset
    if (content.startsWith("/examset")) {
        const topic = content.replace("/examset", "").trim();
        if (!topic) {
            await message.reply("❌ Nhập buổi học phía sau. Ví dụ: `/examset Buổi 3 - con trỏ trong C`");
            return;
        }

        const examPrompt = `
Bạn là giảng viên đại học ngành CNTT.
Hãy tạo 5 bài tập theo BUỔI HỌC sau: """${topic}"""

YÊU CẦU:
- Sắp xếp từ dễ → khó
- Mỗi bài: có tên + mô tả + đầu vào/đầu ra (nếu cần)
- Ưu tiên bài code thực hành
- Viết bằng tiếng Việt
- Markdown

FORMAT:
**📚 BÀI TẬP THEO BUỔI: ${topic}**
**Bài 1 (Dễ):** ...
**Bài 2:** ...
**Bài 3:** ...
**Bài 4:** ...
**Bài 5 (Khó):** ...
`;
        try {
            const response = await genai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: examPrompt,
                config: { temperature: 0.6 },
            });
            const answer = response.text || "Lỗi khi tạo đề 😭";
            const chunks = splitMessage(answer);
            for (const chunk of chunks) await message.channel.send(chunk);
        } catch (err) {
            console.error(err);
            await message.channel.send("❌ Lỗi khi tạo bộ đề /examset");
        }
        return;
    }

    // 3. Xử lý lệnh /homework
    if (content.startsWith("/homework")) {
        const topic = content.replace("/homework", "").trim();
        if (!topic) {
            await message.reply("❌ Nhập chủ đề + ngôn ngữ. Ví dụ: `/homework array trong C`");
            return;
        }

        const homeworkPrompt = `
Bạn là giảng viên đại học ngành lập trình.
Hãy tạo 5 bài tập về chủ đề: """${topic}"""

YÊU CẦU:
- Thứ tự: Rất dễ → Trung bình → Khó → Nâng cao → Thử thách
- Chỉ viết ĐỀ BÀI
- Rõ ràng + đủ thông tin để sinh viên tự code
- Ưu tiên sát thực tế
- Viết bằng tiếng Việt
- Markdown

FORMAT:
**📘 BÀI TẬP VỀ: ${topic}**
**Bài 1 (Rất dễ):** ...
**Bài 2 (Dễ):** ...
**Bài 3 (Trung bình):** ...
**Bài 4 (Khó):** ...
**Bài 5 (Thử thách):** ...
`;
        try {
            const response = await genai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: homeworkPrompt,
                config: { temperature: 0.7 },
            });
            const answer = response.text || "Bot bị khùng 😭";
            const chunks = splitMessage(answer);
            for (const chunk of chunks) await message.channel.send(chunk);
        } catch (err) {
            console.error(err);
            await message.channel.send("❌ Lỗi khi tạo bộ bài tập /homework");
        }
        return;
    }

    // 4. Xử lý lệnh /point (CÓ HỖ TRỢ FILE)
    if (content.startsWith("/point")) {
        let workText = content.replace("/point", "").trim();

        // Đọc file nếu có
        const fileText = await getAttachmentText(message);
        if (fileText) {
            workText += fileText;
            await message.react("📄"); // Báo hiệu đã nhận file
        }

        await handlePoint(message, workText);
        return;
    }

    // 5. Xử lý lệnh /feedback (CÓ HỖ TRỢ FILE)
    if (content.startsWith("/feedback")) {
        let workText = content.replace("/feedback", "").trim();

        // Đọc file nếu có
        const fileText = await getAttachmentText(message);
        if (fileText) {
            workText += fileText;
            await message.react("📄"); // Báo hiệu đã nhận file
        }

        if (!workText) {
            await message.reply("⚠️ Vui lòng gửi bài làm (text hoặc file) sau `/feedback` để bot phân tích.");
            return;
        }

        const feedbackPrompt = `
Bạn là giáo viên đại học, chấm điểm bài tập sinh viên.
Bài làm: """${workText}"""
Yêu cầu:
- Chấm theo thang 0-10
- Chỉ rõ lỗi + cách sửa
- Nêu điểm mạnh
- Động viên cuối
- Markdown

FORMAT:
**Điểm:** ...
**Nhận xét tổng quát:** ...
**Sai sót và cách cải thiện:**
1️⃣ ...
2️⃣ ...
**Điểm mạnh:**
- ...
- ...
`;
        try {
            const response = await genai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: feedbackPrompt,
                config: { temperature: 0.7 },
            });
            const answer = response.text || "Bot lag sml rồi 😭";
            const chunks = splitMessage(answer);
            for (const chunk of chunks) await message.channel.send(chunk);
        } catch (err) {
            console.error(err);
            await message.channel.send("Bot lỗi khi phân tích 🚑");
        }
        return;
    }

    // 6. Xử lý Chat thông thường (!ask hoặc dấu ?)
    if (!content.startsWith("!ask") && !content.endsWith("?")) return;

    const prompt = content.startsWith("!ask") ? content.replace("!ask", "").trim() : content;

    // Quản lý bộ nhớ hội thoại
    if (!conversations[message.channel.id]) conversations[message.channel.id] = [];
    conversations[message.channel.id].push({ role: "user", content: prompt });
    if (conversations[message.channel.id].length > 10) conversations[message.channel.id].shift();

    const isBug = /(bug|lỗi|sai|error|exception|không chạy|crash|toang|bị lỗi|fix|undefined|stack|compile)/i.test(prompt);
    const isProcess = /(làm sao|làm thế nào|như thế nào|cách làm|quy trình|hướng dẫn|how to|cách để|procedure)/i.test(prompt);

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
Nói chuyện kiểu đời thường có văng tục nhẹ như "vãi".
Trả lời ngắn gọn, dễ hiểu, đầy đủ nội dung.
`;
    }

    const aiPrompt = tone + "\n\n" +
        conversations[message.channel.id].map(m => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`).join("\n") +
        "\nBot:";

    try {
        const response = await genai.models.generateContent({
            model: "gemini-2.0-pro",
            contents: aiPrompt,
            config: { temperature: 0.75 },
        });
        const answer = response.text || "Bot lag sml rồi 😭";
        const chunks = splitMessage(answer);
        for (const chunk of chunks) await message.channel.send(chunk);

        conversations[message.channel.id].push({ role: "bot", content: answer });
        if (conversations[message.channel.id].length > 10) conversations[message.channel.id].shift();
    } catch (err) {
        console.error(err);
        await message.channel.send("Bot sập mẹ rồi 🚑");
    }
});

client.login(process.env.DISCORD_TOKEN);