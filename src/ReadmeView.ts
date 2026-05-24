/**
 * StarVault README View
 * 在编辑器区显示仓库 README 的视图
 */

import { ItemView, WorkspaceLeaf, MarkdownRenderer } from 'obsidian';
import StarVaultPlugin from './main';
import { StarredRepo } from './SidebarView';

export const VIEW_TYPE_STARNEST_README = 'starvault-readme';

export class StarVaultReadmeView extends ItemView {
	plugin: StarVaultPlugin;
	private currentRepo: StarredRepo | null = null;
	private readmeContent: string | null = null;
	private isLoading: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: StarVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_STARNEST_README;
	}

	getDisplayText(): string {
		return this.currentRepo ? `${this.currentRepo.owner}/${this.currentRepo.name}` : 'README';
	}

	getIcon(): string {
		return 'file-text';
	}

	/**
	 * 显示仓库的 README
	 */
	async showRepoReadme(repo: StarredRepo): Promise<void> {
		this.currentRepo = repo;
		this.isLoading = true;
		this.readmeContent = null;
		await this.render();

		try {
			// 从 GitHub API 获取 README
			const readmeContent = await this.fetchRepoReadme(repo.owner, repo.name);
			this.readmeContent = readmeContent;
		} catch (error) {
			this.readmeContent = `> 无法获取 README: ${error instanceof Error ? error.message : '未知错误'}\n\n点击上方链接在 GitHub 查看。`;
		} finally {
			this.isLoading = false;
			await this.render();
		}
	}

	/**
	 * 从 GitHub API 获取仓库的 README
	 */
	private async fetchRepoReadme(owner: string, name: string): Promise<string> {
		if (!this.plugin.octokit) {
			throw new Error('GitHub 未配置');
		}

		try {
			// 获取 README
			const response = await this.plugin.octokit.rest.repos.getReadme({
				owner,
				repo: name,
				headers: {
					'X-GitHub-Api-Version': '2026-03-10'
				}
			});

			// 解码 base64 内容
			const content = Buffer.from(response.data.content, 'base64').toString('utf8');
			
			// 在顶部添加仓库信息标题
			return `# ${owner}/${name}\n\n> ${this.currentRepo?.description || ''}\n\n---\n\n${content}`;
		} catch (error: any) {
			// 如果是 404 错误，尝试不同的文件名
			if (error.status === 404) {
				return `# ${owner}/${name}\n\n> ${this.currentRepo?.description || ''}\n\n---\n\n> 该仓库没有 README 文件或 README 无法读取。`;
			}
			throw error;
		}
	}

	/**
	 * 视图打开时初始化
	 */
	async onOpen() {
		const container = this.containerEl;
		container.addClass('starvault-readme-view');
		container.empty();
		await this.render();
	}

	/**
	 * 渲染视图内容
	 */
	private async render(): Promise<void> {
		const container = this.containerEl;
		container.empty();

		if (!this.currentRepo) {
			return;
		}

		if (this.isLoading) {
			this.renderLoadingState(container);
			return;
		}

		await this.renderReadmeContent(container);
	}

	/**
	 * 渲染加载状态
	 */
	private renderLoadingState(container: HTMLElement): void {
		const loading = container.createDiv('readme-loading');
		loading.createEl('p', { text: '正在加载 README...', cls: 'loading-text' });
	}

	/**
	 * 渲染 README 内容
	 */
	private async renderReadmeContent(container: HTMLElement): Promise<void> {
		// 创建内容包装器
		const contentWrapper = container.createDiv('readme-content-wrapper');

		// 创建内容容器，添加 markdown-body class 以应用 GitHub 样式
		const contentContainer = contentWrapper.createDiv('readme-content markdown-body');

		// 渲染 Markdown
		if (this.readmeContent) {
			await MarkdownRenderer.render(
				this.app,
				this.readmeContent,
				contentContainer,
				'',
				this
			);
		}
	}

	/**
	 * 视图关闭时清理
	 */
	async onClose() {
		// 清理工作
	}
}
