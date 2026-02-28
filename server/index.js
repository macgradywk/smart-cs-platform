const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

async function startServer() {
    // 初始化数据库
    await initDB();

    const app = express();
    const PORT = process.env.PORT || 3000;

    // CORS 配置：生产环境只允许 Netlify 域名，开发环境允许所有
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [
            'http://localhost:5173',
            'http://localhost:3000',
            'https://deft-beijinho-bb9290.netlify.app'
        ];

    app.use(cors({
        origin: (origin, callback) => {
            // 允许无 origin（如 curl、Render 健康检查）或在白名单里的域名  
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS 不允许的来源: ${origin}`));
            }
        },
        credentials: true
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 路由
    const { router: authRouter } = require('./routes/auth');
    const knowledgeRouter = require('./routes/knowledge');
    const chatRouter = require('./routes/chat');

    app.use('/api/auth', authRouter);
    app.use('/api/knowledge', knowledgeRouter);
    app.use('/api/chat', chatRouter);

    // 健康检查（Render 用）
    app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

    // 静态文件服务（本地开发时提供构建产物）
    const distPath = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(distPath));

    // SPA fallback
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            const indexPath = path.join(distPath, 'index.html');
            res.sendFile(indexPath, (err) => {
                if (err) res.status(404).json({ error: 'Not found' });
            });
        }
    });

    // 错误处理
    app.use((err, req, res, next) => {
        console.error('服务器错误:', err);
        res.status(err.status || 500).json({ error: err.message || '服务器内部错误' });
    });

    app.listen(PORT, () => {
        console.log(`✅ 智能客服平台后端已启动: http://localhost:${PORT}`);
        console.log(`   环境: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   允许来源: ${allowedOrigins.join(', ')}`);
    });
}

startServer().catch(err => {
    console.error('启动失败:', err);
    process.exit(1);
});
