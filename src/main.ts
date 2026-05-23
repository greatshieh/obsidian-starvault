/**
 * StarNest Plugin - Main Entry
 * Obsidian 插件主入口文件
 */

import { Plugin, WorkspaceLeaf, TFile, ItemView, Notice } from 'obsidian';
import { StarNestSidebarView, VIEW_TYPE_STARNEST_SIDEBAR, StarredRepo } from './SidebarView';
import { StarNestDetailView, VIEW_TYPE_STARNEST_DETAIL } from './DetailView';
import { StarNestReadmeView, VIEW_TYPE_STARNEST_README } from './ReadmeView';
import { StarNestSettingTab } from './settings';
import { Octokit } from 'octokit';
import { db, githubRepoToDBRepo } from './db';
import { searchService } from './search';

// 插件设置接口
interface StarNestSettings {
	githubToken: string;
	username: string;
	userAvatar: string;
	syncOnStartup: boolean;
	autoSyncInterval: number; // 分钟，0 表示关闭
	defaultSort: string;
	showArchived: boolean;
	noteTemplate: string;
	notePathTemplate: string;
	noteNameTemplate: string;
}

// 默认设置
const DEFAULT_SETTINGS: StarNestSettings = {
	githubToken: '',
	username: '',
	userAvatar: '',
	syncOnStartup: false,
	autoSyncInterval: 0,
	defaultSort: 'stars-desc',
	showArchived: false,
	noteTemplate: `---
repo: {{repo}}
owner: {{owner}}
starnumber: {{starnumber}}
starred-at: {{starred-at}}
updated_at: {{updated_at}}
created-at: {{created-at}}
language: {{language}}
tags:
{{tags}}
url: {{url}}
---

# {{repo.name}}

> {{repo.description}}

## 笔记

`,
	notePathTemplate: 'StarVault',
	noteNameTemplate: '{{repo}}',
};

export default class StarNestPlugin extends Plugin {
	settings: StarNestSettings;
	sidebarView: StarNestSidebarView | null = null;
	detailView: StarNestDetailView | null = null;
	readmeView: StarNestReadmeView | null = null;
	octokit: Octokit | null = null;

	async onload() {
		// 加载设置
		await this.loadSettings();

		// 初始化 Octokit
		this.initOctokit();

		// 注册左侧边栏视图
		this.registerView(
			VIEW_TYPE_STARNEST_SIDEBAR,
			(leaf: WorkspaceLeaf) => {
				this.sidebarView = new StarNestSidebarView(leaf, this);
				return this.sidebarView;
			}
		);

		// 注册右侧边栏详情视图
		this.registerView(
			VIEW_TYPE_STARNEST_DETAIL,
			(leaf: WorkspaceLeaf) => {
				this.detailView = new StarNestDetailView(leaf, this);
				return this.detailView;
			}
		);

		// 注册 README 视图（在编辑器区）
		this.registerView(
			VIEW_TYPE_STARNEST_README,
			(leaf: WorkspaceLeaf) => {
				this.readmeView = new StarNestReadmeView(leaf, this);
				return this.readmeView;
			}
		);

		// 添加命令
		this.addCommand({
			id: 'open-starnest-sidebar',
			name: '打开 StarNest 侧边栏',
			callback: () => this.activateSidebarView(),
		});

		this.addCommand({
			id: 'open-starnest-detail',
			name: '打开 StarNest 详情',
			callback: () => this.activateDetailView(),
		});

		this.addCommand({
			id: 'open-starnest-readme',
			name: '打开 StarNest README',
			callback: () => this.activateReadmeView(),
		});

		this.addCommand({
			id: 'sync-github-stars',
			name: '同步 GitHub Stars',
			callback: () => this.syncGitHubStars(),
		});

		this.addCommand({
			id: 'create-repo-note',
			name: '为当前仓库创建笔记',
			callback: () => this.createNoteForCurrentRepo(),
		});

		// 添加设置页
		this.addSettingTab(new StarNestSettingTab(this.app, this));

		// 如果设置了启动时同步
		if (this.settings.syncOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				this.syncGitHubStars();
			});
		}

		// 设置自动同步
		this.setupAutoSync();
	}

	onunload() {
		this.sidebarView = null;
		this.detailView = null;
	}

	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
		this.setupAutoSync();
		// 重新初始化 Octokit（如果 token 发生变化）
		this.initOctokit();
	}

	/**
	 * 初始化 Octokit 实例
	 */
	initOctokit(): void {
		if (this.settings.githubToken) {
			this.octokit = new Octokit({
				auth: this.settings.githubToken,
			});
		} else {
			this.octokit = null;
		}
	}

	/**
	 * 激活侧边栏视图
	 */
	async activateSidebarView(): Promise<void> {
		const { workspace } = this.app;

		// 检查是否已存在该视图
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_STARNEST_SIDEBAR)[0];

		if (!leaf) {
			// 在左侧边栏创建新视图
			leaf = workspace.getLeftLeaf(false) as WorkspaceLeaf;
			await leaf.setViewState({ type: VIEW_TYPE_STARNEST_SIDEBAR });
		}

		// 聚焦到该视图
		workspace.revealLeaf(leaf);
	}

	/**
	 * 激活右侧边栏详情视图
	 */
	async activateDetailView(): Promise<void> {
		const { workspace } = this.app;

		// 检查是否已存在该视图
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_STARNEST_DETAIL)[0];

		if (!leaf) {
			// 在右侧边栏创建新视图
			leaf = workspace.getRightLeaf(false) as WorkspaceLeaf;
			await leaf.setViewState({ type: VIEW_TYPE_STARNEST_DETAIL });
		}

		// 聚焦到该视图
		workspace.revealLeaf(leaf);
	}

	/**
	 * 激活 README 视图
	 */
	async activateReadmeView(): Promise<void> {
		const { workspace } = this.app;

		// 检查是否已存在该视图
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_STARNEST_README)[0];

		if (!leaf) {
			// 在编辑器区创建新视图
			leaf = workspace.getLeaf(false) as WorkspaceLeaf;
			await leaf.setViewState({ type: VIEW_TYPE_STARNEST_README });
		}

		// 聚焦到该视图
		workspace.revealLeaf(leaf);
	}

	/**
	 * 打开 StarNest 侧边栏
	 */
	async openStarNestSidebar(): Promise<void> {
		await this.activateSidebarView();
	}

	/**
	 * 同步 GitHub Stars
	 */
	async syncGitHubStars(): Promise<void> {
		if (!this.settings.githubToken) {
			// 打开设置页提示用户配置 Token
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById('starnest');
			return;
		}

		let page = 1;
		let totalFetched = 0;

		try {
			// 第一步：清空现有数据库（清除旧数据）
			new Notice('正在清空旧数据...');
			await db.repos.clear();

			// 第二步：从 GitHub 获取所有 starred 仓库（原始 API 数据）
			new Notice('正在获取 GitHub Stars...');
			const rawRepos: any[] = [];
			page = 1;
			const perPage = 100;

			while (true) {
				const response = await this.octokit.request(
					'GET /user/starred',
					{
						per_page: perPage,
						page: page,
						headers: {
							'X-GitHub-Api-Version': '2026-03-10',
						},
					}
				);

				const data = response.data as any[];

				if (data.length === 0) break;

				rawRepos.push(...data);
				totalFetched += data.length;
				new Notice(`正在获取第 ${page} 页... (已获取 ${totalFetched} 个仓库)`);

				if (data.length < perPage) break;
				page++;
			}

			// 第三步：保存到 IndexedDB
			new Notice(`正在保存 ${rawRepos.length} 个仓库到本地数据库...`);
			const dbRepos = rawRepos.map(repo => githubRepoToDBRepo(repo, this.getLanguageColor(repo.language)));
			await db.bulkUpsertRepos(dbRepos);

			// 第四步：重建搜索索引
			new Notice('正在构建搜索索引...');
			await searchService.buildIndex();

			// 第五步：从 IndexedDB 加载数据
			new Notice('正在加载本地数据...');
			const allRepos = await db.repos.toArray();

			const starredRepos: StarredRepo[] = allRepos.map(repo => ({
				id: repo.id || 0,
				owner: repo.owner || 'unknown',
				name: repo.name || 'repo',
				description: repo.description || '',
				language: repo.language || 'Unknown',
				languageColor: repo.languageColor || '#cccccc',
				stars: repo.stars || 0,
				forks: repo.forks || 0,
				updatedAt: this.formatRelativeTime(new Date(repo.updatedAt || 0).toISOString()),
				createdAt: this.formatRelativeTime(new Date(repo.createdAt || 0).toISOString()),
				starredAt: this.formatRelativeTime(new Date(repo.syncedAt || Date.now()).toISOString()),
				topics: repo.topics || [],
				tags: repo.tags || [],
				isArchived: repo.isArchived || false,
				url: repo.htmlUrl || '',
			}));

			// 第六步：更新侧边栏
			if (this.sidebarView) {
				this.sidebarView.updateRepos(starredRepos);
			}

			// 第七步：保存到本地数据（兼容旧版本）
			const oldFormatRepos: StarredRepo[] = rawRepos.map(item => ({
				id: item.id,
				owner: item.owner?.login || 'unknown',
				name: item.name || 'repo',
				description: item.description || '',
				language: item.language || 'Unknown',
				languageColor: this.getLanguageColor(item.language),
				stars: item.stargazers_count || 0,
				forks: item.forks_count || 0,
				updatedAt: this.formatRelativeTime(item.updated_at),
				createdAt: this.formatRelativeTime(item.created_at),
				starredAt: this.formatRelativeTime(item.starred_at),
				topics: item.topics || [],
				tags: [],
				isArchived: item.archived || false,
				url: item.html_url || '',
			}));
			await this.saveStarsToData(oldFormatRepos);

			// 完成
			new Notice(`同步完成！共 ${rawRepos.length} 个仓库`);
		} catch (error) {
			new Notice('同步失败: ' + (error instanceof Error ? error.message : '未知错误'));
		}
	}

	/**
	 * 从 GitHub API 获取 Starred 仓库（使用 Octokit），带进度回调
	 */
	private async fetchGitHubStarsWithProgress(
		onProgress?: (totalFetched: number, page: number) => void
	): Promise<StarredRepo[]> {
		if (!this.octokit) {
			throw new Error('Octokit not initialized');
		}

		const repos: StarredRepo[] = [];
		let page = 1;
		const perPage = 100;
		let totalFetched = 0;

		while (true) {
			const response = await this.octokit.request(
				'GET /user/starred',
				{
					per_page: perPage,
					page: page,
					headers: {
						'X-GitHub-Api-Version': '2026-03-10',
					},
				}
			);

			const data = response.data as any[];

			if (data.length === 0) break;

			repos.push(...data.map((item: any) => ({
				id: item.id,
				owner: item.owner.login,
				name: item.name,
				description: item.description || '',
				language: item.language || 'Unknown',
				languageColor: this.getLanguageColor(item.language),
				stars: item.stargazers_count,
				forks: item.forks_count,
				updatedAt: this.formatRelativeTime(item.updated_at),
				createdAt: this.formatRelativeTime(item.created_at),
				starredAt: this.formatRelativeTime(item.starred_at),
				topics: item.topics || [],
				tags: [], // 从本地数据获取
				isArchived: item.archived,
				url: item.html_url,
			})));

			totalFetched += data.length;
			onProgress?.(totalFetched, page);

			if (data.length < perPage) break;
			page++;
		}

		return repos;
	}

	/**
	 * 保存 Stars 到本地数据
	 */
	private async saveStarsToData(repos: StarredRepo[]): Promise<void> {
		const data = await this.loadData() || {};
		data.stars = repos;
		data.lastSync = Date.now();
		await this.saveData(data);
	}

	/**
	 * 从本地数据加载 Stars
	 */
	async loadStarsFromData(): Promise<StarredRepo[]> {
		const data = await this.loadData() || {};
		return data.stars || [];
	}

	/**
	 * 设置自动同步
	 */
	private setupAutoSync(): void {
		// 清除现有的定时器
		if ((this as any).autoSyncIntervalId) {
			clearInterval((this as any).autoSyncIntervalId);
		}

		// 如果启用了自动同步
		if (this.settings.autoSyncInterval > 0) {
			const intervalMs = this.settings.autoSyncInterval * 60 * 1000;
			(this as any).autoSyncIntervalId = setInterval(() => {
				this.syncGitHubStars();
			}, intervalMs);
		}
	}

	/**
	 * 为当前选中的仓库创建笔记
	 */
	async createNoteForCurrentRepo(): Promise<void> {
		// 这里需要从 sidebarView 获取当前选中的仓库
		// 简化实现，实际应该通过事件或状态管理
	}

	/**
	 * 发射仓库选择事件
	 */
	emitRepoSelected(repo: StarredRepo): void {
		// 在编辑器区打开 README 视图
		this.openRepoReadmeView(repo);
		// 在右侧边栏打开详情视图
		this.openRepoDetailView(repo);
	}

	/**
	 * 打开仓库详情视图（右侧边栏）
	 */
	private async openRepoDetailView(repo: StarredRepo): Promise<void> {
		const { workspace } = this.app;

		// 检查是否已存在该视图
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_STARNEST_DETAIL)[0];

		if (!leaf) {
			// 在右侧边栏创建新视图
			leaf = workspace.getRightLeaf(false) as WorkspaceLeaf;
			await leaf.setViewState({ type: VIEW_TYPE_STARNEST_DETAIL });
		}

		// 聚焦到该视图
		workspace.revealLeaf(leaf);

		// 更新详情视图内容
		if (this.detailView) {
			this.detailView.showRepoDetail(repo);
		}
	}

	/**
	 * 打开仓库 README 视图（编辑器区）
	 */
	private async openRepoReadmeView(repo: StarredRepo): Promise<void> {
		const { workspace } = this.app;

		// 检查是否已存在该视图
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_STARNEST_README)[0];

		if (!leaf) {
			// 在编辑器区创建新视图（在中央创建）
			leaf = workspace.getLeaf(false) as WorkspaceLeaf;
			await leaf.setViewState({ type: VIEW_TYPE_STARNEST_README });
		}

		// 聚焦到该视图
		workspace.revealLeaf(leaf);

		// 更新 README 视图内容
		if (this.readmeView) {
			this.readmeView.showRepoReadme(repo);
		}
	}

	/**
	 * 获取语言颜色
	 */
	private getLanguageColor(language: string | null): string {
		const colors: Record<string, string> = {
			'TypeScript': '#3178c6',
			'JavaScript': '#f1e05a',
			'Rust': '#dea584',
			'Python': '#3572A5',
			'Go': '#00ADD8',
			'Vue': '#41b883',
			'React': '#61dafb',
			'Java': '#b07219',
			'C++': '#f34b7d',
			'C': '#555555',
			'Ruby': '#701516',
			'PHP': '#4F5D95',
			'Swift': '#ffac45',
			'Kotlin': '#A97BFF',
		};
		return colors[language || ''] || '#8b949e';
	}

	/**
	 * 格式化相对时间
	 */
	private formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 60) return `${diffMins}分钟前`;
		if (diffHours < 24) return `${diffHours}小时前`;
		if (diffDays < 30) return `${diffDays}天前`;
		return date.toLocaleDateString();
	}

	/**
	 * 获取当前日期（年-月-日格式）
	 */
	private getCurrentDate(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/**
	 * 解析模板字符串
	 * 支持 {{owner}}, {{repo}}, {{date}}
	 */
	private parseTemplate(template: string, repo: StarredRepo): string {
		let result = template;
		const date = this.getCurrentDate();

		result = result.replace(/\{\{owner\}\}/g, repo.owner);
		result = result.replace(/\{\{repo\}\}/g, repo.name);
		result = result.replace(/\{\{date\}\}/g, date);

		// 清理无效字符
		result = result.replace(/[<>:"/\\|?*]/g, '_');

		return result;
	}

	/**
	 * 递归创建文件夹
	 */
	private async ensureFolderExists(path: string): Promise<void> {
		const parts = path.split('/').filter(p => p);
		let currentPath = '';

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const folder = this.app.vault.getAbstractFileByPath(currentPath);

			if (!folder) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	/**
	 * 根据模板创建仓库笔记
	 */
	async createRepoNoteWithTemplate(repo: StarredRepo): Promise<void> {
		try {
			// 解析路径和文件名模板
			const folderPath = this.parseTemplate(this.settings.notePathTemplate, repo);
			const fileName = this.parseTemplate(this.settings.noteNameTemplate, repo);
			const fullPath = `${folderPath}/${fileName}.md`;

			// 确保文件夹存在
			await this.ensureFolderExists(folderPath);

			// 检查文件是否已存在
			const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
			if (existingFile) {
				// 如果文件已存在，直接打开
				if (existingFile instanceof TFile) {
					await this.app.workspace.getLeaf().openFile(existingFile);
				}
				return;
			}

			// 准备内容模板
			let content = this.settings.noteTemplate;

			// 处理 tags（topics）- 将数组转换为 YAML 格式的列表
			const tagsStr = (repo.topics || []).map(tag => `  - ${tag}`).join('\n');

			content = content
				.replace(/\{\{repo\}\}/g, repo.name)
				.replace(/\{\{owner\}\}/g, repo.owner)
				.replace(/\{\{starnumber\}\}/g, String(repo.stars))
				.replace(/\{\{starred-at\}\}/g, repo.starredAt || '')
				.replace(/\{\{updated_at\}\}/g, repo.updatedAt || '')
				.replace(/\{\{created-at\}\}/g, repo.createdAt || '')
				.replace(/\{\{language\}\}/g, repo.language || '')
				.replace(/\{\{tags\}\}/g, tagsStr)
				.replace(/\{\{url\}\}/g, repo.url || `https://github.com/${repo.owner}/${repo.name}`)
				.replace(/\{\{repo\.name\}\}/g, repo.name)
				.replace(/\{\{repo\.owner\}\}/g, repo.owner)
				.replace(/\{\{repo\.description\}\}/g, repo.description || '')
				.replace(/\{\{repo\.language\}\}/g, repo.language || '')
				.replace(/\{\{repo\.stars\}\}/g, String(repo.stars))
				.replace(/\{\{repo\.forks\}\}/g, String(repo.forks))
				.replace(/\{\{repo\.url\}\}/g, repo.url || `https://github.com/${repo.owner}/${repo.name}`)
				.replace(/\{\{repo\.createdAt\}\}/g, repo.createdAt || '')
				.replace(/\{\{repo\.updatedAt\}\}/g, repo.updatedAt || '')
				.replace(/\{\{repo\.starredAt\}\}/g, repo.starredAt || '');

			// 创建文件
			const file = await this.app.vault.create(fullPath, content);
			await this.app.workspace.getLeaf().openFile(file);
		} catch (error) {
		}
	}
}
