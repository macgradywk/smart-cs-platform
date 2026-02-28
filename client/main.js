// ===== API 工具模块 =====
// 开发环境：为 '' 使用 Vite 代理；生产环境：填入 Render 后端地址
const API_BASE = (import.meta.env.VITE_API_BASE || '') + '/api';

function getToken() {
  return localStorage.getItem('cs_token');
}

function setToken(token) {
  localStorage.setItem('cs_token', token);
}

function getUser() {
  const u = localStorage.getItem('cs_user');
  return u ? JSON.parse(u) : null;
}

function setUser(user) {
  localStorage.setItem('cs_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('cs_token');
  localStorage.removeItem('cs_user');
  renderApp();
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API_BASE + url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

// ===== Toast 通知 =====
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="material-icons-round" style="font-size:18px">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== 时间格式化 =====
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return '昨天';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return d.toLocaleDateString('zh-CN');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== 全局状态 =====
let currentTab = 'chat'; // 'admin' | 'chat'
let currentConversation = null;
let conversations = [];
let chatMessages = [];

// ===== 渲染主应用 =====
function renderApp() {
  const app = document.getElementById('app');
  if (!getToken()) {
    renderLoginPage(app);
  } else {
    renderMainPage(app);
  }
}

// ===== 登录页面 =====
function renderLoginPage(container) {
  let isLogin = true;

  function render() {
    container.innerHTML = `
      <div class="login-page">
        <nav class="login-nav">
          <div class="login-nav-brand">
            <div class="icon"><span class="material-icons-round">smart_toy</span></div>
            智能客服平台
          </div>
          <div class="login-nav-links">
            <a href="#">首页</a>
            <a href="#">功能特性</a>
            <a href="#">开发文档</a>
            <a href="#">技术支持</a>
            <a href="#" class="login-nav-cta">立即开始</a>
          </div>
        </nav>
        <div class="login-content">
          <div class="login-card">
            <h1>欢迎回来</h1>
            <p class="subtitle">管理您的知识库并开启AI驱动的对话服务</p>
            <div class="login-tabs">
              <button class="login-tab ${isLogin ? 'active' : ''}" id="tab-login">账号登录</button>
              <button class="login-tab ${!isLogin ? 'active' : ''}" id="tab-register">新用户注册</button>
            </div>
            <form id="auth-form">
              <div class="form-group">
                <label class="form-label">用户名 / 邮箱</label>
                <div class="form-input-wrapper">
                  <span class="material-icons-round">person</span>
                  <input type="text" id="input-username" placeholder="请输入您的账号" required autocomplete="username">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">登录密码</label>
                <div class="form-input-wrapper">
                  <span class="material-icons-round">lock</span>
                  <input type="password" id="input-password" placeholder="请输入您的密码" required autocomplete="current-password">
                  <button type="button" class="toggle-pwd"><span class="material-icons-round">visibility</span></button>
                </div>
              </div>
              <div class="form-error" id="form-error"></div>
              ${isLogin ? `
              <div class="form-options">
                <label><input type="checkbox"> 记住我</label>
                <a href="#">忘记密码?</a>
              </div>` : ''}
              <button type="submit" class="btn-primary" id="btn-submit">
                ${isLogin ? '立即登录' : '立即注册'}
                <span class="material-icons-round" style="font-size:18px">${isLogin ? 'login' : 'person_add'}</span>
              </button>
            </form>
            <p class="login-footer-text">
              登录即代表您同意我们的 <a href="#">服务协议</a> 和 <a href="#">隐私政策</a>
            </p>
          </div>
        </div>
        <footer class="login-page-footer">
          <a href="#">联系我们</a>
          <a href="#">关于我们</a>
          <a href="#">官方博客</a>
          <span>© 2024 智能客服平台</span>
        </footer>
      </div>
    `;

    // 事件绑定
    document.getElementById('tab-login').onclick = () => { isLogin = true; render(); };
    document.getElementById('tab-register').onclick = () => { isLogin = false; render(); };

    const togglePwd = container.querySelector('.toggle-pwd');
    const pwdInput = document.getElementById('input-password');
    togglePwd.onclick = () => {
      const isHidden = pwdInput.type === 'password';
      pwdInput.type = isHidden ? 'text' : 'password';
      togglePwd.querySelector('.material-icons-round').textContent = isHidden ? 'visibility_off' : 'visibility';
    };

    document.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById('input-username').value.trim();
      const password = document.getElementById('input-password').value;
      const errorEl = document.getElementById('form-error');
      const btn = document.getElementById('btn-submit');

      errorEl.classList.remove('show');
      btn.disabled = true;
      btn.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';

      try {
        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const data = await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        setToken(data.token);
        setUser(data.user);
        showToast(isLogin ? '登录成功！' : '注册成功！', 'success');
        renderApp();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.add('show');
        btn.disabled = false;
        btn.innerHTML = `${isLogin ? '立即登录' : '立即注册'} <span class="material-icons-round" style="font-size:18px">${isLogin ? 'login' : 'person_add'}</span>`;
      }
    };
  }

  render();
}

// ===== 主页面 =====
function renderMainPage(container) {
  const user = getUser();
  container.innerHTML = `
    <div class="main-layout">
      <header class="main-header">
        <div class="main-header-left">
          <div class="main-header-brand">
            <div class="icon"><span class="material-icons-round">smart_toy</span></div>
            智能客服
          </div>
          <div class="main-tabs">
            <button class="main-tab ${currentTab === 'chat' ? 'active' : ''}" data-tab="chat">
              <span class="material-icons-round" style="font-size:16px;vertical-align:middle;margin-right:4px">chat</span>用户端
            </button>
            <button class="main-tab ${currentTab === 'admin' ? 'active' : ''}" data-tab="admin">
              <span class="material-icons-round" style="font-size:16px;vertical-align:middle;margin-right:4px">admin_panel_settings</span>管理后台
            </button>
          </div>
        </div>
        <div class="main-header-right">
          <div class="header-user">
            <div class="avatar">${(user?.username || 'U')[0].toUpperCase()}</div>
            <span>${user?.username || '用户'}</span>
          </div>
          <button class="btn-logout" id="btn-logout">退出登录</button>
        </div>
      </header>
      <div class="main-content" id="main-content"></div>
    </div>
  `;

  // Tab 切换
  container.querySelectorAll('.main-tab').forEach(tab => {
    tab.onclick = () => {
      currentTab = tab.dataset.tab;
      container.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderTabContent();
    };
  });

  document.getElementById('btn-logout').onclick = () => {
    logout();
    showToast('已退出登录', 'info');
  };

  renderTabContent();
}

function renderTabContent() {
  const content = document.getElementById('main-content');
  if (currentTab === 'admin') {
    renderAdminPage(content);
  } else {
    renderChatPage(content);
  }
}

// ===== 管理后台 - 知识库管理 =====
let docPage = 1;
let docSearch = '';

async function renderAdminPage(container) {
  container.innerHTML = `
    <div class="admin-page">
      <div class="admin-toolbar">
        <div class="admin-search">
          <span class="material-icons-round">search</span>
          <input type="text" id="doc-search-input" placeholder="搜索文档名称、大小、状态..." value="${docSearch}">
        </div>
        <button class="btn-filter">
          <span class="material-icons-round" style="font-size:18px">tune</span>
          筛选
        </button>
        <button class="btn-upload" id="btn-upload-doc">
          <span class="material-icons-round" style="font-size:18px">upload_file</span>
          上传文档
        </button>
      </div>
      <div class="doc-table" id="doc-table-container">
        <div style="padding:40px;text-align:center;color:var(--text-muted)">加载中...</div>
      </div>
    </div>
  `;

  // 搜索
  let searchTimer;
  document.getElementById('doc-search-input').oninput = (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      docSearch = e.target.value;
      docPage = 1;
      loadDocuments();
    }, 300);
  };

  // 上传按钮
  document.getElementById('btn-upload-doc').onclick = () => showUploadModal();

  loadDocuments();
}

async function loadDocuments() {
  try {
    const params = new URLSearchParams({ page: docPage, pageSize: 10 });
    if (docSearch) params.set('search', docSearch);
    const data = await apiFetch(`/knowledge/documents?${params}`);
    renderDocTable(data);
  } catch (err) {
    showToast('获取文档列表失败: ' + err.message, 'error');
  }
}

function renderDocTable(data) {
  const tableContainer = document.getElementById('doc-table-container');
  if (!tableContainer) return;

  if (data.documents.length === 0) {
    tableContainer.innerHTML = `
      <div class="doc-empty">
        <span class="material-icons-round">folder_open</span>
        <p>暂无文档，点击"上传文档"开始添加</p>
      </div>
    `;
    return;
  }

  const statusMap = {
    'completed': { label: '已完成', class: 'completed' },
    'processing': { label: '解析中', class: 'processing' },
    'failed': { label: '失败', class: 'failed' }
  };

  const getDocIcon = (type) => {
    if (type.includes('PDF')) return { class: 'pdf', icon: 'picture_as_pdf' };
    if (type.includes('Word')) return { class: 'word', icon: 'description' };
    return { class: 'txt', icon: 'text_snippet' };
  };

  const rows = data.documents.map(doc => {
    const status = statusMap[doc.status] || { label: doc.status, class: '' };
    const icon = getDocIcon(doc.type);
    return `
      <div class="doc-table-row" data-id="${doc.id}">
        <div class="doc-name">
          <div class="doc-icon ${icon.class}"><span class="material-icons-round">${icon.icon}</span></div>
          <div class="doc-name-text">
            <h4>${doc.name}</h4>
            <span>${doc.type}</span>
          </div>
        </div>
        <div class="doc-size">${formatSize(doc.size)}</div>
        <div class="doc-date">${formatDate(doc.uploaded_at)}</div>
        <div class="doc-status ${status.class}"><span class="dot"></span>${status.label}</div>
        <div class="doc-actions">
          <button class="btn-view" data-id="${doc.id}">查看</button>
          <button class="btn-del" data-id="${doc.id}"><span class="material-icons-round" style="font-size:16px">delete</span></button>
        </div>
      </div>
    `;
  }).join('');

  // 分页
  const totalPages = data.totalPages || 1;
  let paginationBtns = '';
  paginationBtns += `<button ${docPage <= 1 ? 'disabled' : ''} data-page="${docPage - 1}"><span class="material-icons-round" style="font-size:18px">chevron_left</span></button>`;
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    paginationBtns += `<button class="${i === docPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  paginationBtns += `<button ${docPage >= totalPages ? 'disabled' : ''} data-page="${docPage + 1}"><span class="material-icons-round" style="font-size:18px">chevron_right</span></button>`;

  tableContainer.innerHTML = `
    <div class="doc-table-header">
      <div>文档名称</div>
      <div>文件大小</div>
      <div>上传日期</div>
      <div>状态</div>
      <div>操作</div>
    </div>
    ${rows}
    <div class="doc-pagination">
      <span class="doc-pagination-info">共 ${data.total} 个文档</span>
      <div class="doc-pagination-btns">${paginationBtns}</div>
    </div>
  `;

  // 事件绑定
  tableContainer.querySelectorAll('.btn-view').forEach(btn => {
    btn.onclick = () => viewDocument(btn.dataset.id);
  });

  tableContainer.querySelectorAll('.btn-del').forEach(btn => {
    btn.onclick = () => deleteDocument(btn.dataset.id);
  });

  tableContainer.querySelectorAll('.doc-pagination-btns button[data-page]').forEach(btn => {
    btn.onclick = () => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1 && page <= totalPages) {
        docPage = page;
        loadDocuments();
      }
    };
  });
}

async function viewDocument(id) {
  try {
    const doc = await apiFetch(`/knowledge/documents/${id}`);
    const contentText = typeof doc.content_text === 'string' ? doc.content_text : '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay doc-detail-modal';
    overlay.innerHTML = `
      <div class="modal">
        <h3>${doc.name}</h3>
        <p>类型: ${doc.type} | 大小: ${formatSize(doc.size)} | 状态: ${doc.status}</p>
        <div class="doc-detail-content">${contentText || '（无文本内容）'}</div>
        <div class="modal-actions">
          <button class="btn-cancel" id="btn-close-detail">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.getElementById('btn-close-detail').onclick = () => overlay.remove();
  } catch (err) {
    showToast('获取文档详情失败: ' + err.message, 'error');
  }
}

async function deleteDocument(id) {
  if (!confirm('确定要删除此文档吗？此操作不可恢复。')) return;
  try {
    await apiFetch(`/knowledge/documents/${id}`, { method: 'DELETE' });
    showToast('文档已删除', 'success');
    loadDocuments();
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error');
  }
}

function showUploadModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>上传文档</h3>
      <p>支持 PDF、Word (.docx)、TXT 格式，最大 50MB</p>
      <div class="upload-zone" id="upload-zone">
        <span class="material-icons-round">cloud_upload</span>
        <p>点击或拖拽文件到这里上传</p>
        <span class="hint" id="upload-hint">支持 .pdf, .docx, .txt 格式</span>
        <input type="file" id="file-input" accept=".pdf,.doc,.docx,.txt" style="display:none">
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" id="btn-cancel-upload">取消</button>
        <button class="btn-confirm" id="btn-confirm-upload" disabled>开始上传</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fileInput = overlay.querySelector('#file-input');
  const uploadZone = overlay.querySelector('#upload-zone');
  const hint = overlay.querySelector('#upload-hint');
  const confirmBtn = overlay.querySelector('#btn-confirm-upload');
  let selectedFile = null;

  uploadZone.onclick = () => fileInput.click();
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--accent)'; });
  uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = ''; });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    if (e.dataTransfer.files.length > 0) {
      selectedFile = e.dataTransfer.files[0];
      hint.textContent = `已选择: ${selectedFile.name} (${formatSize(selectedFile.size)})`;
      confirmBtn.disabled = false;
    }
  });

  fileInput.onchange = () => {
    if (fileInput.files.length > 0) {
      selectedFile = fileInput.files[0];
      hint.textContent = `已选择: ${selectedFile.name} (${formatSize(selectedFile.size)})`;
      confirmBtn.disabled = false;
    }
  };

  overlay.querySelector('#btn-cancel-upload').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  confirmBtn.onclick = async () => {
    if (!selectedFile) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '上传中...';

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await apiFetch('/knowledge/upload', {
        method: 'POST',
        body: formData
      });
      showToast('文档上传成功，正在解析中...', 'success');
      overlay.remove();
      loadDocuments();
    } catch (err) {
      showToast('上传失败: ' + err.message, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '开始上传';
    }
  };
}

// ===== 用户端 - 智能客服对话 =====
async function renderChatPage(container) {
  container.innerHTML = `
    <div class="chat-page">
      <div class="chat-sidebar">
        <div class="chat-sidebar-header">
          <div class="chat-sidebar-brand">
            <div class="icon"><span class="material-icons-round">smart_toy</span></div>
            <div class="chat-sidebar-brand-text">
              <h3>智谱 AI 助手</h3>
              <span>智能客服平台</span>
            </div>
          </div>
          <button class="btn-new-chat" id="btn-new-chat">
            <span class="material-icons-round" style="font-size:18px">add</span>
            开启新对话
          </button>
        </div>
        <div class="chat-sidebar-label">历史对话</div>
        <div class="chat-history" id="chat-history-list"></div>
        <div class="chat-sidebar-footer">
          <a href="#" onclick="currentTab='admin';document.querySelector('[data-tab=admin]').click();return false;">
            <span class="material-icons-round">admin_panel_settings</span>
            管理后台
          </a>
        </div>
      </div>
      <div class="chat-main">
        <div class="chat-header">
          <div class="chat-header-left">
            <span class="online-dot"></span>
            <h3>在线咨询助手</h3>
            <span class="badge">ZHIPU LLM</span>
          </div>
          <div class="chat-header-right">
            <div class="header-user">
              <div class="avatar">${(getUser()?.username || 'U')[0].toUpperCase()}</div>
            </div>
          </div>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-suggestions" id="chat-suggestions">
          <button class="chat-suggestion" data-q="密码忘记了怎么办？">密码忘记了怎么办？</button>
          <button class="chat-suggestion" data-q="如何修改绑定手机？">如何修改绑定手机？</button>
          <button class="chat-suggestion" data-q="支持哪些支付方式？">支持哪些支付方式？</button>
        </div>
        <div class="chat-input-area">
          <div class="chat-input-wrapper">
            <textarea id="chat-input" placeholder="输入您的问题..." rows="1"></textarea>
            <div class="chat-input-actions">
              <button class="btn-send" id="btn-send">
                <span class="material-icons-round" style="font-size:20px">send</span>
              </button>
            </div>
          </div>
          <div class="chat-footer-text">
            由 智谱 Zhipu LLM 提供技术支持 · 所有的回答均基于企业私有知识库
          </div>
        </div>
      </div>
    </div>
  `;

  // 事件绑定
  document.getElementById('btn-new-chat').onclick = () => createNewConversation();

  document.getElementById('btn-send').onclick = () => sendMessage();

  const chatInput = document.getElementById('chat-input');
  chatInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 自动调整高度
  chatInput.oninput = () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  };

  // 快捷问题
  document.querySelectorAll('.chat-suggestion').forEach(btn => {
    btn.onclick = () => {
      chatInput.value = btn.dataset.q;
      sendMessage();
    };
  });

  // 加载对话列表
  await loadConversations();
}

async function loadConversations() {
  try {
    const data = await apiFetch('/chat/conversations');
    conversations = data.conversations || [];
    renderConversationList();

    if (currentConversation) {
      const exists = conversations.find(c => c.id === currentConversation);
      if (exists) {
        loadMessages(currentConversation);
      } else {
        currentConversation = null;
        renderWelcomeChat();
      }
    } else if (conversations.length > 0) {
      currentConversation = conversations[0].id;
      renderConversationList();
      loadMessages(currentConversation);
    } else {
      renderWelcomeChat();
    }
  } catch (err) {
    showToast('加载对话列表失败', 'error');
  }
}

function renderWelcomeChat() {
  const msgContainer = document.getElementById('chat-messages');
  if (!msgContainer) return;
  msgContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted)">
      <span class="material-icons-round" style="font-size:64px;margin-bottom:16px;opacity:0.3">forum</span>
      <p style="font-size:16px;margin-bottom:8px">开始一段新对话</p>
      <p style="font-size:13px">点击"开启新对话"或直接输入问题开始</p>
    </div>
  `;
}

function renderConversationList() {
  const listEl = document.getElementById('chat-history-list');
  if (!listEl) return;

  listEl.innerHTML = conversations.map(c => `
    <div class="chat-history-item ${c.id === currentConversation ? 'active' : ''}" data-id="${c.id}">
      <div class="chat-history-item-text">
        <h4>${c.title || '新对话'}</h4>
        <p>${c.last_message ? c.last_message.substring(0, 30) : ''}</p>
      </div>
      <span class="time">${formatTime(c.updated_at)}</span>
    </div>
  `).join('');

  listEl.querySelectorAll('.chat-history-item').forEach(item => {
    item.onclick = () => {
      currentConversation = item.dataset.id;
      renderConversationList();
      loadMessages(currentConversation);
    };
  });
}

async function createNewConversation() {
  try {
    const data = await apiFetch('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: '新对话' })
    });
    currentConversation = data.id;
    await loadConversations();
    loadMessages(currentConversation);
  } catch (err) {
    showToast('创建对话失败: ' + err.message, 'error');
  }
}

async function loadMessages(conversationId) {
  try {
    const data = await apiFetch(`/chat/conversations/${conversationId}/messages`);
    chatMessages = data.messages || [];
    renderMessages();
  } catch (err) {
    showToast('加载消息失败', 'error');
  }
}

function renderMessages() {
  const msgContainer = document.getElementById('chat-messages');
  if (!msgContainer) return;
  const user = getUser();

  msgContainer.innerHTML = chatMessages.map(msg => `
    <div class="chat-msg ${msg.role}">
      <div class="chat-msg-avatar">
        <span class="material-icons-round">${msg.role === 'assistant' ? 'smart_toy' : 'person'}</span>
      </div>
      <div class="chat-msg-content">
        <div class="chat-msg-meta">
          <span>${msg.role === 'assistant' ? '智能客服' : (user?.username || '我')}</span>
          <span>${formatTime(msg.created_at)}</span>
        </div>
        <div class="chat-msg-bubble">${escapeHtml(msg.content)}</div>
      </div>
    </div>
  `).join('');

  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;

  // 如果没有当前对话，先创建一个
  if (!currentConversation) {
    try {
      const data = await apiFetch('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: '新对话' })
      });
      currentConversation = data.id;
      // 加载欢迎消息
      const msgData = await apiFetch(`/chat/conversations/${currentConversation}/messages`);
      chatMessages = msgData.messages || [];
    } catch (err) {
      showToast('创建对话失败', 'error');
      return;
    }
  }

  input.value = '';
  input.style.height = 'auto';

  // 显示用户消息
  chatMessages.push({ id: 'temp-user', role: 'user', content, created_at: new Date().toISOString() });
  renderMessages();

  // 显示加载中
  const msgContainer = document.getElementById('chat-messages');
  const loadingEl = document.createElement('div');
  loadingEl.className = 'chat-msg assistant';
  loadingEl.innerHTML = `
    <div class="chat-msg-avatar">
      <span class="material-icons-round">smart_toy</span>
    </div>
    <div class="chat-msg-content">
      <div class="chat-msg-knowledge">
        <span class="material-icons-round">search</span>
        正在从知识库检索相关信息...
      </div>
      <div class="chat-msg-bubble">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  msgContainer.appendChild(loadingEl);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  try {
    const data = await apiFetch('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: currentConversation, content })
    });

    // 移除加载中
    loadingEl.remove();

    // 更新消息列表
    chatMessages[chatMessages.length - 1] = data.userMessage;
    chatMessages.push(data.aiMessage);
    renderMessages();

    // 刷新对话列表
    loadConversations();
  } catch (err) {
    loadingEl.remove();
    showToast('发送消息失败: ' + err.message, 'error');
  }
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});
