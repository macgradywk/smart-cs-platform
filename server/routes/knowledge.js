const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { dbWrapper: db } = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

// 文件上传配置
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式，仅支持 PDF、Word、TXT 文件'));
        }
    }
});

// 解析文档文本内容
async function parseDocument(filePath, ext) {
    try {
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text || '';
        } else if (ext === '.docx' || ext === '.doc') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value || '';
        } else if (ext === '.txt') {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return '';
    } catch (err) {
        console.error('文档解析失败:', err);
        return '';
    }
}

// 获取文档列表
router.get('/documents', authMiddleware, (req, res) => {
    try {
        const { search, page = 1, pageSize = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        let countSql, dataSql;
        let countParams = [], dataParams = [];

        if (search) {
            countSql = 'SELECT COUNT(*) as total FROM documents WHERE name LIKE ?';
            countParams = [`%${search}%`];
            dataSql = 'SELECT id, name, type, size, status, uploaded_at FROM documents WHERE name LIKE ? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
            dataParams = [`%${search}%`, parseInt(pageSize), offset];
        } else {
            countSql = 'SELECT COUNT(*) as total FROM documents';
            dataSql = 'SELECT id, name, type, size, status, uploaded_at FROM documents ORDER BY uploaded_at DESC LIMIT ? OFFSET ?';
            dataParams = [parseInt(pageSize), offset];
        }

        const totalRow = db.prepare(countSql).get(...countParams);
        const total = totalRow ? totalRow.total : 0;
        const documents = db.prepare(dataSql).all(...dataParams);

        res.json({
            documents,
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize))
        });
    } catch (err) {
        console.error('获取文档列表失败:', err);
        res.status(500).json({ error: '获取文档列表失败' });
    }
});

// 上传文档
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择文件' });
        }

        const id = uuidv4();
        // multer 接收的 originalname 是 latin1 编码，需转换为 utf8 以支持中文文件名
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalName).toLowerCase();
        const typeMap = {
            '.pdf': 'PDF Document',
            '.doc': 'Word Document',
            '.docx': 'Word Document',
            '.txt': 'Text File'
        };

        db.prepare(`INSERT INTO documents (id, name, type, size, status, user_id) VALUES (?, ?, ?, ?, 'processing', ?)`).run(id, originalName, typeMap[ext] || 'Unknown', req.file.size, req.user.id);

        res.json({ id, name: originalName, status: 'processing' });

        // 异步解析文档
        try {
            const contentText = await parseDocument(req.file.path, ext);
            db.prepare('UPDATE documents SET content_text = ?, status = ? WHERE id = ?').run(contentText, 'completed', id);
            console.log(`文档 ${originalName} 解析完成，提取 ${contentText.length} 字符`);
        } catch (parseErr) {
            db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('failed', id);
            console.error(`文档 ${originalName} 解析失败:`, parseErr);
        }
    } catch (err) {
        console.error('上传文档失败:', err);
        res.status(500).json({ error: '上传文档失败' });
    }
});

// 删除文档
router.delete('/documents/:id', authMiddleware, (req, res) => {
    try {
        const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: '文档不存在' });
        }
        db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('删除文档失败:', err);
        res.status(500).json({ error: '删除文档失败' });
    }
});

// 查看文档详情
router.get('/documents/:id', authMiddleware, (req, res) => {
    try {
        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: '文档不存在' });
        }
        res.json(doc);
    } catch (err) {
        console.error('获取文档详情失败:', err);
        res.status(500).json({ error: '获取文档详情失败' });
    }
});

module.exports = router;
