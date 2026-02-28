/**
 * 智谱大模型 API 服务
 * 使用 GLM-4-Flash 模型
 */

const https = require('https');

const API_KEY = process.env.ZHIPU_API_KEY || '';
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

/**
 * 调用智谱 GLM-4-Flash 模型
 * @param {Array<{role: string, content: string}>} messages - 消息列表
 * @param {string} systemPrompt - 系统提示
 * @returns {Promise<string>} AI 回复内容
 */
async function chatWithZhipu(messages, systemPrompt) {
    const allMessages = [];

    if (systemPrompt) {
        allMessages.push({ role: 'system', content: systemPrompt });
    }

    allMessages.push(...messages);

    const requestBody = JSON.stringify({
        model: 'glm-4-flash',
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 2048
    });

    return new Promise((resolve, reject) => {
        const url = new URL(API_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices.length > 0) {
                        resolve(parsed.choices[0].message.content);
                    } else if (parsed.error) {
                        console.error('智谱 API 错误:', parsed.error);
                        reject(new Error(parsed.error.message || '模型调用失败'));
                    } else {
                        console.error('智谱 API 未知响应:', data);
                        reject(new Error('模型返回异常'));
                    }
                } catch (e) {
                    console.error('解析响应失败:', data);
                    reject(new Error('解析模型响应失败'));
                }
            });
        });

        req.on('error', (err) => {
            console.error('请求智谱 API 失败:', err);
            reject(err);
        });

        req.write(requestBody);
        req.end();
    });
}

module.exports = { chatWithZhipu };
