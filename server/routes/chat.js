const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbWrapper: db } = require('../db');
const { authMiddleware } = require('./auth');
const { chatWithZhipu } = require('../services/zhipu');
const { searchKnowledge } = require('../services/search');

const router = express.Router();

// 获取对话列表
router.get('/conversations', authMiddleware, (req, res) => {
    try {
        const conversations = db.prepare(`
      SELECT id, title, created_at, updated_at
      FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(req.user.id);

        // 为每个对话获取最后一条消息
        for (const conv of conversations) {
            const lastMsg = db.prepare(
                'SELECT content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1'
            ).get(conv.id);
            conv.last_message = lastMsg ? lastMsg.content : '';
        }

        res.json({ conversations });
    } catch (err) {
        console.error('获取对话列表失败:', err);
        res.status(500).json({ error: '获取对话列表失败' });
    }
});

// 创建新对话
router.post('/conversations', authMiddleware, (req, res) => {
    try {
        const id = uuidv4();
        const title = req.body.title || '新对话';
        db.prepare('INSERT INTO conversations (id, title, user_id) VALUES (?, ?, ?)').run(id, title, req.user.id);

        // 添加欢迎消息
        const welcomeId = uuidv4();
        db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
            welcomeId, id, 'assistant',
            '您好！我是您的智能客服助手。我已经准备好基于知识库为您提供解答。请问有什么可以帮您？'
        );

        res.json({ id, title });
    } catch (err) {
        console.error('创建对话失败:', err);
        res.status(500).json({ error: '创建对话失败' });
    }
});

// 获取对话消息
router.get('/conversations/:id/messages', authMiddleware, (req, res) => {
    try {
        const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }

        const messages = db.prepare('SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);
        res.json({ messages, conversation });
    } catch (err) {
        console.error('获取消息失败:', err);
        res.status(500).json({ error: '获取消息失败' });
    }
});

// 发送消息
router.post('/messages', authMiddleware, async (req, res) => {
    try {
        const { conversation_id, content } = req.body;
        if (!conversation_id || !content) {
            return res.status(400).json({ error: '参数不完整' });
        }

        const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(conversation_id, req.user.id);
        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }

        // 保存用户消息
        const userMsgId = uuidv4();
        db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
            userMsgId, conversation_id, 'user', content
        );

        // 从知识库检索相关信息
        const searchResults = searchKnowledge(content);
        let systemPrompt = '你是一个智能客服助手，请用中文回答用户的问题。请保持回答简洁、准确、友好。';

        let knowledgeUsed = false;
        if (searchResults.length > 0) {
            knowledgeUsed = true;
            const knowledgeContext = searchResults.map((r, i) =>
                `[来源: ${r.source}]\n${r.content}`
            ).join('\n\n---\n\n');

            systemPrompt = `你是一个智能客服助手。请优先根据以下知识库内容来回答用户的问题。如果知识库中没有相关信息，请根据你的知识自主回答。回答请使用中文，保持简洁、准确、友好。

知识库参考内容：
${knowledgeContext}`;
        }

        // 获取最近的对话历史（按插入顺序排列）
        const recentMessages = db.prepare(
            'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY rowid ASC'
        ).all(conversation_id).slice(-10);

        // 调用智谱大模型
        let aiReply;
        try {
            console.log('发送给智谱的消息:', JSON.stringify(recentMessages.map(m => ({ role: m.role, content: (m.content || '').substring(0, 50) }))));
            aiReply = await chatWithZhipu(recentMessages, systemPrompt);
            console.log('AI 回复:', (aiReply || '').substring(0, 100));
        } catch (apiErr) {
            console.error('AI 回复失败:', apiErr);
            aiReply = '抱歉，我暂时无法回答您的问题，请稍后重试。';
        }

        // 确保 aiReply 是有效字符串
        if (!aiReply || typeof aiReply !== 'string' || aiReply.trim() === '') {
            console.warn('AI 回复为空，使用默认回复');
            aiReply = '抱歉，我暂时无法生成回复，请稍后重试。';
        }

        // 保存 AI 回复
        const aiMsgId = uuidv4();
        db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
            aiMsgId, conversation_id, 'assistant', aiReply
        );

        // 更新对话标题
        const msgCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND role = ?').get(conversation_id, 'user');
        if (msgCount && msgCount.count === 1) {
            const title = content.length > 20 ? content.substring(0, 20) + '...' : content;
            db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conversation_id);
        }

        // 更新对话时间
        db.prepare("UPDATE conversations SET updated_at = datetime('now', 'localtime') WHERE id = ?").run(conversation_id);

        res.json({
            userMessage: { id: userMsgId, role: 'user', content },
            aiMessage: { id: aiMsgId, role: 'assistant', content: aiReply },
            knowledgeUsed
        });
    } catch (err) {
        console.error('发送消息失败:', err);
        res.status(500).json({ error: '发送消息失败' });
    }
});

// 删除对话
router.delete('/conversations/:id', authMiddleware, (req, res) => {
    try {
        const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params.id);
        db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('删除对话失败:', err);
        res.status(500).json({ error: '删除对话失败' });
    }
});

module.exports = router;
