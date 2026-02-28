const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbWrapper: db } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smart-cs-jwt-secret-key-2024-dev';

// 认证中间件
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: '请先登录' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

// 注册
router.post('/register', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        if (username.length < 2) {
            return res.status(400).json({ error: '用户名至少2个字符' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: '密码至少6个字符' });
        }

        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        const id = uuidv4();
        const password_hash = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, password_hash);

        const token = jwt.sign({ id, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id, username, role: 'user' } });
    } catch (err) {
        console.error('注册失败:', err);
        res.status(500).json({ error: '注册失败' });
    }
});

// 登录
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error('登录失败:', err);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

module.exports = { router, authMiddleware, JWT_SECRET };
