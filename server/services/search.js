/**
 * 知识库检索服务
 * 支持中文关键词搜索
 */

const { dbWrapper: db } = require('../db');

/**
 * 对查询文本提取中文词和英文词
 * - 中文：提取所有单个及双字词
 * - 英文：按空格分割，保留长度 >= 2 的词
 */
function tokenize(text) {
    if (!text || typeof text !== 'string') return [];

    const tokens = new Set();

    // 提取英文单词（忽略大小写）
    const englishWords = text.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
    for (const w of englishWords) tokens.add(w);

    // 提取中文字符串中所有长度 1-4 的片段作为 token
    const chineseBlocks = text.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const block of chineseBlocks) {
        // 提取连续中文片段中的 1-gram、2-gram、3-gram
        for (let len = 1; len <= Math.min(4, block.length); len++) {
            for (let i = 0; i <= block.length - len; i++) {
                tokens.add(block.substring(i, i + len));
            }
        }
    }

    return Array.from(tokens);
}

/**
 * 计算查询词与文本块的相关性分数
 */
function calculateRelevance(query, text) {
    if (!query || !text) return 0;

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    let score = 0;

    // 1. 完整原句直接包含，最高优先级
    if (textLower.includes(queryLower)) {
        score += 50;
    }

    // 2. 中文词匹配：提取查询中的中文片段（n-gram）逐一检索
    const chineseInQuery = query.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const block of chineseInQuery) {
        // 整块中文短语匹配
        if (textLower.includes(block)) {
            score += block.length * 3;  // 越长分越高
        }
        // 双字词匹配
        for (let i = 0; i < block.length - 1; i++) {
            const bigram = block.substring(i, i + 2);
            const count = (textLower.split(bigram).length - 1);
            if (count > 0) {
                score += count * 2;
            }
        }
        // 单字匹配（权重低）
        for (const ch of block) {
            const count = (textLower.split(ch).length - 1);
            if (count > 0) {
                score += count * 0.5;
            }
        }
    }

    // 3. 英文词匹配
    const englishTokens = tokenize(query).filter(t => /^[a-z0-9]+$/.test(t));
    for (const token of englishTokens) {
        const regex = new RegExp(token, 'gi');
        const matches = textLower.match(regex);
        if (matches) score += matches.length;
    }

    return score;
}

/**
 * 文本切分（按段落 + 长度限制）
 */
function splitIntoChunks(text, chunkSize = 600) {
    if (!text || typeof text !== 'string') return [];

    const chunks = [];
    const paragraphs = text.split(/\n{2,}|。\s*/);

    let currentChunk = '';
    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if (currentChunk.length + trimmed.length > chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = trimmed;
        } else {
            currentChunk += (currentChunk ? '\n' : '') + trimmed;
        }
    }
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    // 如果没有段落切分，按固定长度切分
    if (chunks.length === 0 && text.trim()) {
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }
    }

    return chunks;
}

/**
 * 从知识库检索与查询相关的内容
 * @param {string} query - 用户查询
 * @param {number} topK - 返回最多 K 个结果
 * @returns {Array<{content, source, score}>}
 */
function searchKnowledge(query, topK = 3) {
    let documents;
    try {
        documents = db.prepare(
            "SELECT id, name, content_text FROM documents WHERE status = 'completed' AND content_text IS NOT NULL AND content_text != ''"
        ).all();
    } catch (err) {
        console.error('知识库查询失败:', err);
        return [];
    }

    if (!documents || documents.length === 0) {
        console.log('知识库中暂无已处理的文档');
        return [];
    }

    console.log(`知识库检索：共 ${documents.length} 个文档，查询词："${query}"`);

    const results = [];

    for (const doc of documents) {
        // 确保 content_text 是字符串
        let text = doc.content_text;
        if (!text || typeof text !== 'string') {
            console.warn(`文档 ${doc.name} 的 content_text 类型异常:`, typeof text);
            continue;
        }

        const chunks = splitIntoChunks(text);
        for (const chunk of chunks) {
            const score = calculateRelevance(query, chunk);
            if (score > 0) {
                results.push({
                    content: chunk.substring(0, 800),
                    source: doc.name || '未知文档',
                    score
                });
            }
        }
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, topK);
    console.log(`知识库检索结果：找到 ${results.length} 个相关段落，取 top${topK}`);
    return top;
}

module.exports = { searchKnowledge };
