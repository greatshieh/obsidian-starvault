/**
 * StarVault Plugin - Main Entry
 * Obsidian 插件主入口文件
 */

import { Plugin, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { StarVaultSidebarView, VIEW_TYPE_STARNEST_SIDEBAR, StarredRepo } from './SidebarView';
import { StarVaultDetailView, VIEW_TYPE_STARNEST_DETAIL } from './DetailView';
import { StarVaultReadmeView, VIEW_TYPE_STARNEST_README } from './ReadmeView';
import { StarVaultSettingTab } from './settings';
import { Octokit } from 'octokit';
import { db, githubRepoToDBRepo, DBUser } from './db';
import { searchService } from './search';
import { t } from './lang';
import * as languageColorsRaw from './color.json';
const languageColors = languageColorsRaw as Record<string, string>;

// 插件设置接口
interface StarVaultSettings {
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
	language: 'en' | 'zh'; // 界面语言
}

// 默认设置
const DEFAULT_SETTINGS: StarVaultSettings = {
	githubToken: '',
	username: '',
	userAvatar: '',
	syncOnStartup: false,
	autoSyncInterval: 0,
	defaultSort: 'stars-desc',
	showArchived: false,
	language: 'zh', // 默认中文
	noteTemplate: `---
repo: {{repo}}
owner: {{owner}}
starnumber: {{starnumber}}
starred-at: {{starred-at}}
updated_at: {{updated_at}}
created-at: {{created-at}}
language: {{language}}
topics:
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

export default class StarVaultPlugin extends Plugin {
	settings: StarVaultSettings;
	sidebarView: StarVaultSidebarView | null = null;
	detailView: StarVaultDetailView | null = null;
	readmeView: StarVaultReadmeView | null = null;
	octokit: Octokit | null = null;
	currentUserId: string = 'default';  // 当前活跃用户 ID

	async onload() {
		// 加载设置
		await this.loadSettings();

		// 初始化 Octokit
		this.initOctokit();

		// 初始化当前用户（多用户支持）
		await this.initCurrentUser();

		// 注册左侧边栏视图
		this.registerView(
			VIEW_TYPE_STARNEST_SIDEBAR,
			(leaf: WorkspaceLeaf) => {
				this.sidebarView = new StarVaultSidebarView(leaf, this);
				return this.sidebarView;
			}
		);

		// 注册右侧边栏详情视图
		this.registerView(
			VIEW_TYPE_STARNEST_DETAIL,
			(leaf: WorkspaceLeaf) => {
				this.detailView = new StarVaultDetailView(leaf, this);
				return this.detailView;
			}
		);

		// 注册 README 视图（在编辑器区）
		this.registerView(
			VIEW_TYPE_STARNEST_README,
			(leaf: WorkspaceLeaf) => {
				this.readmeView = new StarVaultReadmeView(leaf, this);
				return this.readmeView;
			}
		);

		// 添加命令
		this.addCommand({
			id: 'open-starvault-sidebar',
			name: t('commands.openSidebar', this.settings.language),
			callback: () => this.activateSidebarView(),
		});

		this.addCommand({
			id: 'open-starvault-detail',
			name: 'Open StarVault Detail',
			callback: () => this.activateDetailView(),
		});

		this.addCommand({
			id: 'open-starvault-readme',
			name: 'Open StarVault README',
			callback: () => this.activateReadmeView(),
		});

		this.addCommand({
			id: 'sync-github-stars',
			name: t('commands.syncStars', this.settings.language),
			callback: () => this.syncGitHubStars(),
		});

		this.addCommand({
			id: 'create-repo-note',
			name: 'Create Note for Current Repo',
			callback: () => this.createNoteForCurrentRepo(),
		});

		// 添加设置页
		this.addSettingTab(new StarVaultSettingTab(this.app, this));

		// 监听文件重命名事件，更新笔记路径
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				// 只处理 markdown 文件
				if (file instanceof TFile && file.extension === 'md') {
					this.updateNotePath(oldPath, file.path);
				}
			})
		);

		// 监听文件删除事件，清理数据库中的笔记记录
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				// 只处理 markdown 文件
				if (file instanceof TFile && file.extension === 'md') {
					this.deleteNoteByPath(file.path);
				}
			})
		);

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
	 * 初始化当前用户（多用户支持）
	 * 尝试从数据库获取活跃用户，如果没有则使用默认用户
	 * 同时处理老用户升级，自动获取 GitHub 用户信息
	 */
	async initCurrentUser(): Promise<void> {
		// 如果 Token 已配置但用户表中没有 Token，先迁移 Token 到默认用户
		if (this.settings.githubToken) {
			const users = await db.getAllUsers();
			const activeUser = users.find(u => u.isActive);
			
			if (activeUser && !activeUser.token && activeUser.id === 'default') {
				// 首次升级：将现有 Token 迁移到默认用户
				await db.updateUser('default', { 
					token: this.settings.githubToken,
					name: '默认账号'
				});
			}
		}
		
		// 获取活跃用户
		let activeUser = await db.getActiveUser();
		if (activeUser) {
			this.currentUserId = activeUser.id;
			// 如果活跃用户有 Token，同步到设置
			if (activeUser.token && !this.settings.githubToken) {
				this.settings.githubToken = activeUser.token;
				await this.saveSettings();
			}
			
			// 老用户升级：如果有 Token 但没有 GitHub 用户信息，自动获取
			if (activeUser.token && !activeUser.login) {
				try {
					await this.fetchAndUpdateUserInfo();
					// 重新获取更新后的用户信息
					activeUser = await db.getActiveUser();
				} catch (error) {
					console.warn('Failed to fetch user info during upgrade:', error);
				}
			}
		} else {
			this.currentUserId = 'default';
		}
	}

	/**
	 * 获取并更新当前用户的 GitHub 信息
	 */
	private async fetchAndUpdateUserInfo(): Promise<void> {
		if (!this.settings.githubToken) return;
		
		this.initOctokit();
		if (!this.octokit) return;
		
		try {
			const userResponse = await this.octokit.request('GET /user', {
				headers: {
					'X-GitHub-Api-Version': '2026-03-10',
				},
			});
			const githubUser = userResponse.data as any;
			
			// 更新当前用户的 GitHub 信息
			await db.updateUser(this.currentUserId, {
				login: githubUser.login || '',
				avatarUrl: githubUser.avatar_url || '',
			});
			
			// 同步到设置
			this.settings.username = githubUser.login || '';
			this.settings.userAvatar = githubUser.avatar_url || '';
			await this.saveSettings();
			
			new Notice(t('notices.userUpdated', this.settings.language));
		} catch (error) {
			console.error('Failed to fetch user info:', error);
		}
	}

	/**
	 * 获取当前活跃用户
	 */
	async getCurrentUser(): Promise<DBUser | undefined> {
		return db.getUser(this.currentUserId);
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
	 * 打开 StarVault 侧边栏
	 */
	async openStarVaultSidebar(): Promise<void> {
		await this.activateSidebarView();
	}

	/**
	 * 同步 GitHub Stars
	 */
	async syncGitHubStars(): Promise<void> {
		if (!this.settings.githubToken) {
			// 打开设置页提示用户配置 Token
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById('starvault');
			return;
		}

		let page = 1;
		let totalFetched = 0;

		try {
			// 第一步：获取当前用户信息
			new Notice('Fetching user info...');
			const userResponse = await this.octokit.request('GET /user', {
				headers: {
					'X-GitHub-Api-Version': '2026-03-10',
				},
			});
			const githubUser = userResponse.data as any;
			
			// 更新当前用户的 GitHub 信息
			await db.updateUser(this.currentUserId, {
				login: githubUser.login || '',
				avatarUrl: githubUser.avatar_url || '',
			});
			
			// 同步到设置
			this.settings.username = githubUser.login || '';
			this.settings.userAvatar = githubUser.avatar_url || '';
			await this.saveSettings();

			// 第二步：保存现有仓库的自定义数据（标签和删除状态）
			const existingRepos = await db.repos.toArray();
			const existingDataMap = new Map<number, {
				tags: string[];
				deletedAt: number | null;
			}>();

			existingRepos.forEach(repo => {
				existingDataMap.set(repo.id, {
					tags: repo.tags || [],
					deletedAt: repo.deletedAt,
				});
			});

			// 第二步：从 GitHub 获取所有 starred 仓库（原始 API 数据）
			new Notice('Fetching GitHub Stars...');
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
				new Notice(`Fetching page ${page}... (${totalFetched} repos fetched)`);

				if (data.length < perPage) break;
				page++;
			}

			// 第三步：转换并合并自定义数据
			new Notice(`Saving ${rawRepos.length} repos to local database...`);
			const dbRepos = rawRepos.map(repo => {
				const dbRepo = githubRepoToDBRepo(repo, this.getLanguageColor(repo.language), this.currentUserId);
				// 合并现有自定义数据（保留用户标签和删除状态）
				const existingData = existingDataMap.get(dbRepo.id);
				if (existingData) {
					dbRepo.tags = existingData.tags;
					dbRepo.deletedAt = existingData.deletedAt;
				}
				return dbRepo;
			});
			await db.bulkUpsertRepos(dbRepos);

			// 第四步：重建搜索索引
			new Notice('Building search index...');
			await searchService.buildIndex();

			// 第五步：从 IndexedDB 加载当前用户的数据（包含软删除的）
			new Notice('Loading local data...');
			const allRepos = await db.repos.where('userId').equals(this.currentUserId).toArray();

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
				deletedAt: repo.deletedAt || null,
			}));

			// 第六步：更新侧边栏
			if (this.sidebarView) {
				this.sidebarView.updateRepos(starredRepos);
			}

			// 完成
			new Notice(t('notices.syncSuccess', this.settings.language) + ` ${rawRepos.length} repos`);
		} catch (error) {
			new Notice(t('notices.syncFailed', this.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
		}
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
		console.log('emitRepoSelected called for repo:', repo.owner, repo.name);
		// 在编辑器区打开 README 视图
		this.openRepoReadmeView(repo);
		// 在右侧边栏打开详情视图
		this.openRepoDetailView(repo);
	}

	/**
	 * 打开仓库详情视图（右侧边栏）
	 */
	private async openRepoDetailView(repo: StarredRepo): Promise<void> {
		console.log('openRepoDetailView called');
		const { workspace } = this.app;

		// 检查是否已存在该视图
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_STARNEST_DETAIL)[0];
		console.log('Existing detail leaf:', leaf);

		if (!leaf) {
			// 在右侧边栏创建新视图
			console.log('Creating new detail leaf in right sidebar');
			leaf = workspace.getRightLeaf(false) as WorkspaceLeaf;
			await leaf.setViewState({ type: VIEW_TYPE_STARNEST_DETAIL });
			console.log('New detail leaf created:', leaf);
		}

		// 聚焦到该视图
		workspace.revealLeaf(leaf);

		// 更新详情视图内容
		// 直接从 leaf 获取视图实例，确保视图已正确初始化
		const view = leaf.view as StarVaultDetailView;
		console.log('Detail view instance:', view);
		if (view) {
			console.log('Calling showRepoDetail');
			view.showRepoDetail(repo);
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
		// 直接从 leaf 获取视图实例，确保视图已正确初始化
		const view = leaf.view as StarVaultReadmeView;
		if (view) {
			view.showRepoReadme(repo);
		}
	}

	/**
	 * 获取语言颜色
	 */
	private getLanguageColor(language: string | null): string {
		return languageColors[language || ''] || '#8b949e';
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
      const topicsStr = (repo.topics || []).map(topic => `  - ${topic}`).join('\n');

      content = content
        .replace(/\{\{repo\}\}/g, repo.name)
        .replace(/\{\{owner\}\}/g, repo.owner)
        .replace(/\{\{starnumber\}\}/g, String(repo.stars))
        .replace(/\{\{starred-at\}\}/g, repo.starredAt || '')
        .replace(/\{\{updated_at\}\}/g, repo.updatedAt || '')
        .replace(/\{\{created-at\}\}/g, repo.createdAt || '')
        .replace(/\{\{language\}\}/g, repo.language || '')
        .replace(/\{\{tags\}\}/g, topicsStr)
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
      
      // 保存笔记到数据库（包含仓库名称）
      const repoName = `${repo.owner}/${repo.name}`;
      await db.createNote(repo.id, repoName, fileName, content, fullPath, this.currentUserId);
      
      // 打开文件
      await this.app.workspace.getLeaf().openFile(file);
    } catch (error: any) {
      new Notice('创建笔记失败: ' + (error.message || '未知错误'));
    }
  }

  /**
   * 更新笔记路径（当文件重命名时）
   */
  private async updateNotePath(oldPath: string, newPath: string): Promise<void> {
    try {
      // 查找数据库中匹配旧路径的笔记
      const notes = await db.notes.toArray();
      const note = notes.find(n => n.filePath === oldPath);
      
      if (note) {
        // 更新路径和标题（从新文件名提取）
        const newFileName = newPath.split('/').pop()?.replace('.md', '') || note.title;
        await db.updateNote(note.id, {
          filePath: newPath,
          title: newFileName,
        });
        
        // 如果右侧边栏正在显示这个仓库的详情，刷新笔记列表
        if (this.detailView && this.detailView.currentRepo?.id === note.repoId) {
          this.detailView.currentNotes = await db.getNotesByRepoId(note.repoId, this.currentUserId);
          this.detailView.render();
        }
      }
    } catch (error) {
      // 静默失败，不影响用户体验
    }
  }

  /**
   * 删除笔记记录（当文件被删除时）
   */
  private async deleteNoteByPath(path: string): Promise<void> {
    try {
      // 查找数据库中匹配路径的笔记
      const notes = await db.notes.toArray();
      const note = notes.find(n => n.filePath === path);
      
      if (note) {
        await db.deleteNote(note.id);
        
        // 如果右侧边栏正在显示这个仓库的详情，刷新笔记列表
        if (this.detailView && this.detailView.currentRepo?.id === note.repoId) {
          this.detailView.currentNotes = await db.getNotesByRepoId(note.repoId, this.currentUserId);
          this.detailView.render();
        }
      }
    } catch (error) {
      // 静默失败，不影响用户体验
    }
  }
}
