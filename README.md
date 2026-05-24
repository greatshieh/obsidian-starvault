# StarVault

一个 Obsidian 插件，用于管理你的 GitHub Stars 仓库。

## 功能特性

### 核心功能

- **GitHub Stars 同步** - 使用 Octokit 自动同步你的 GitHub 标星仓库
- **本地持久化存储** - 使用 IndexedDB 存储仓库数据，支持离线访问
- **全文搜索** - 基于 MiniSearch 的中文全文搜索，支持仓库描述、语言、topics 和自定义标签搜索
- **自定义标签** - 为仓库添加、编辑自定义标签，右键菜单快速操作

### 仓库管理

- **仓库列表展示** - 显示仓库名称、描述、语言、Star 数、Fork 数等
- **多维度筛选** - 按标签、语言筛选
- **多种排序** - 按 Star 数、更新时间、名称排序
- **仓库详情** - 在侧边栏显示仓库详细信息

### README 查看

- **嵌入式 README** - 在编辑器区直接显示仓库 README
- **GitHub 样式** - 使用 GitHub Markdown CSS 样式
- **流畅滚动** - 独立的滚动区域

### 笔记功能

- **模板化笔记** - 根据自定义模板创建仓库笔记
- **灵活配置** - 支持路径模板、文件名模板、内容模板
- **变量替换** - 支持丰富的模板变量

### 同步设置

- **启动时同步** - Obsidian 启动时自动同步
- **自动同步** - 可设置自动同步间隔
- **手动同步** - 一键手动同步

## 安装

### 手动安装

1. 下载最新版本的 `main.js`、`manifest.json` 和 `styles.css`
2. 将文件复制到 `<Vault>/.obsidian/plugins/starvault/` 目录
3. 在 Obsidian 设置中启用插件

### 开发版本

```bash
# 克隆仓库
git clone https://github.com/xiewei007/starvault.git

# 安装依赖
npm install

# 开发模式（监视编译）
npm run dev

# 生产构建
npm run build
```

## 使用指南

### 首次设置

1. 打开 Obsidian 设置 → 社区插件 → 启用 StarVault
2. 点击 StarVault 设置标签
3. 在 "GitHub Token" 输入框中填入你的 GitHub Personal Access Token
4. 点击 "登录" 按钮验证 Token
5. 使用命令面板（Ctrl/Cmd + P）执行 "同步 GitHub Stars"

### 创建 GitHub Token

1. 访问 GitHub Settings → Developer settings → Personal access tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限范围
4. 生成 Token 并妥善保存

### 同步仓库

- **手动同步**：命令面板执行 "同步 GitHub Stars"
- **自动同步**：在设置中启用自动同步并设置间隔

### 搜索仓库

在侧边栏顶部的搜索框中输入关键词，支持：
- 仓库名称
- 仓库描述
- 编程语言
- Topics
- 自定义标签

### 管理标签

- **添加标签**：右键仓库卡片，选择 "自定义标签"
- **编辑标签**：在标签编辑弹窗中添加或删除标签
- **筛选标签**：点击侧边栏顶部的标签筛选器

### 创建笔记

1. 右键仓库卡片，选择 "创建笔记"
2. 或使用命令面板执行 "为当前仓库创建笔记"

## 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| GitHub Token | 访问 GitHub API 的令牌 | - |
| 启动时同步 | 启动 Obsidian 时自动同步 | 关闭 |
| 自动同步间隔 | 自动同步间隔（分钟），0 表示关闭 | 0 |
| 默认排序 | 仓库列表默认排序方式 | Star 数（高 → 低） |
| 显示归档仓库 | 是否在列表中显示已归档仓库 | 关闭 |
| 笔记路径模板 | 创建笔记的文件夹路径 | StarVault |
| 笔记名称模板 | 创建笔记的文件名 | {{repo}} |
| 笔记内容模板 | 笔记内容模板 | 见下方 |

### 笔记模板变量

```
{{repo}}         - 仓库名称
{{owner}}        - 仓库所有者
{{starnumber}}   - Star 数量
{{starred-at}}   - 收藏时间
{{updated_at}}   - 更新时间
{{created-at}}   - 创建时间
{{language}}     - 编程语言
{{tags}}         - Topics 列表
{{url}}          - GitHub 仓库 URL
{{repo.name}}    - 仓库名称
{{repo.description}} - 仓库描述
{{repo.stars}}   - Star 数量
{{repo.forks}}   - Fork 数量
```

## 数据存储

StarVault 使用以下本地存储：

- **IndexedDB (StarVaultDB)** - 存储仓库数据、标签、笔记关联
- **LocalStorage (data.json)** - 存储插件设置

所有数据保存在本地，不会上传至任何服务器。

## 技术栈

- **TypeScript** - 类型安全
- **Dexie.js** - IndexedDB 封装
- **MiniSearch** - 全文搜索引擎
- **Octokit** - GitHub API 客户端

## 键盘快捷键

| 命令 | 快捷键 |
|------|--------|
| 打开侧边栏 | Ctrl/Cmd + P → "打开 StarVault 侧边栏" |
| 同步 Stars | Ctrl/Cmd + P → "同步 GitHub Stars" |

## 常见问题

### Q: 同步失败怎么办？

A: 请检查：
1. GitHub Token 是否有效
2. 网络连接是否正常
3. Token 是否有 `repo` 权限

### Q: 搜索不到结果？

A: 请确保：
1. 已经执行过同步
2. 搜索关键词正确
3. 尝试使用简短关键词

### Q: 如何删除所有数据？

A: 在设置页面 → 数据管理 → 删除仓库数据

## 更新日志

### v0.1.0

- 初始版本发布
- GitHub Stars 同步
- IndexedDB 本地存储
- MiniSearch 全文搜索
- 自定义标签
- 仓库笔记创建

## 许可证

MIT License

## 作者

[greatshieh](https://github.com/greatshieh)
