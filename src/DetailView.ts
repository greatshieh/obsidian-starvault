/**
 * StarNestDetailView.ts
 * 右侧边栏视图 - 用于显示仓库详情
 * 按照 preview.html 的样式重新设计
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import StarNestPlugin from './main';
import { StarredRepo } from './SidebarView';

export const VIEW_TYPE_STARNEST_DETAIL = 'starnest-detail';

export class StarNestDetailView extends ItemView {
	plugin: StarNestPlugin;
	private currentRepo: StarredRepo | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: StarNestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_STARNEST_DETAIL;
	}

	getDisplayText(): string {
		return '仓库详情';
	}

	getIcon(): string {
		return 'info';
	}

	/**
	 * 显示仓库详情
	 */
	showRepoDetail(repo: StarredRepo): void {
		this.currentRepo = repo;
		this.render();
	}

	/**
	 * 视图打开时初始化
	 */
	async onOpen() {
		const container = this.containerEl;
		container.addClass('starnest-detail-view');
		container.empty();
		this.render();
	}

	/**
	 * 渲染视图内容
	 */
	private render(): void {
		const container = this.containerEl;
		container.empty();

		if (!this.currentRepo) {
			this.renderEmptyState(container);
			return;
		}

		const repo = this.currentRepo;

		// 创建详情侧边栏容器
		const sidebar = container.createDiv('readme-sidebar');

		// Topics 卡片
		if (repo.topics && repo.topics.length > 0) {
			const topicsCard = sidebar.createDiv('info-card');
			topicsCard.createEl('h3', { text: 'Topics' });
			const topicsContainer = topicsCard.createDiv('info-tags');
			repo.topics.forEach((topic: string) => {
				topicsContainer.createEl('span', {
					text: topic,
					cls: 'info-tag'
				});
			});
		}

		// 仓库信息卡片
		const infoCard = sidebar.createDiv('info-card');
		infoCard.createEl('h3', { text: '仓库信息' });

		infoCard.createDiv('info-row').innerHTML = `<span class="label">创建时间</span><span class="value">${repo.createdAt || '-'}</span>`;
		infoCard.createDiv('info-row').innerHTML = `<span class="label">最后推送</span><span class="value">${repo.updatedAt || '-'}</span>`;
		infoCard.createDiv('info-row').innerHTML = `<span class="label">Star 数量</span><span class="value accent">⭐ ${this.formatNumber(repo.stars)}</span>`;
		infoCard.createDiv('info-row').innerHTML = `<span class="label">Fork 数量</span><span class="value">${this.formatNumber(repo.forks)}</span>`;

		if (repo.language) {
			infoCard.createDiv('info-row').innerHTML = `<span class="label">语言</span><span class="value"><span class="lang-dot" style="background: ${repo.languageColor}"></span>${repo.language}</span>`;
		}

		if (repo.isArchived) {
			infoCard.createDiv('info-row').innerHTML = `<span class="label">状态</span><span class="value">⚠️ 已归档</span>`;
		}

		// 自定义标签卡片
		if (repo.tags && repo.tags.length > 0) {
			const tagsCard = sidebar.createDiv('info-card');
			tagsCard.createEl('h3', { text: '标签' });
			const tagsContainer = tagsCard.createDiv('info-tags');
			repo.tags.forEach((tag: string) => {
				tagsContainer.createEl('span', {
					text: tag,
					cls: 'info-tag'
				});
			});
		}

		// 链接卡片
		const linkCard = sidebar.createDiv('info-card');
		linkCard.createEl('h3', { text: '链接' });

		linkCard.createEl('a', {
			text: '↗ 在 Github 查看',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', async (e) => {
			e.preventDefault();
			const url = `https://github.com/${repo.owner}/${repo.name}`;
			window.open(url, '_blank');
		});

		linkCard.createEl('a', {
			text: '↗ 在 Zread 查看',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', async (e) => {
			e.preventDefault();
			const url = `https://zread.ai/${repo.owner}/${repo.name}`;
			window.open(url, '_blank');
		});

		linkCard.createEl('a', {
			text: '↗ 在 DeepWiKi 查看',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', async (e) => {
			e.preventDefault();
			const url = `https://deepiki.com/${repo.owner}/${repo.name}`;
			window.open(url, '_blank');
		});


		linkCard.createEl('a', {
			text: '📋 复制 Clone URL',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', (e) => {
			e.preventDefault();
			navigator.clipboard.writeText(`https://github.com/${repo.owner}/${repo.name}.git`);
			new Notice('已复制到剪贴板');
		});

		linkCard.createEl('a', {
			text: '📝 创建笔记',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', async (e) => {
			e.preventDefault();
			try {
				await this.plugin.createRepoNoteWithTemplate(repo);
				new Notice(`已为 ${repo.name} 创建笔记`);
			} catch (error: any) {
				new Notice('创建笔记失败: ' + error.message);
			}
		});
	}

	/**
	 * 渲染空状态
	 */
	private renderEmptyState(container: HTMLElement): void {
		const emptyState = container.createDiv('detail-empty-state');

		const iconEl = emptyState.createDiv('empty-icon');
		setIcon(iconEl, 'file-search');

		emptyState.createEl('p', {
			text: '暂无仓库详情',
			cls: 'empty-title'
		});

		emptyState.createEl('p', {
			text: '从左侧列表选择一个仓库查看详情',
			cls: 'empty-desc'
		});
	}

	/**
	 * 格式化数字
	 */
	private formatNumber(num: number): string {
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + 'M';
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1) + 'k';
		}
		return num.toString();
	}

	/**
	 * 视图关闭时清理
	 */
	async onClose() {
		// 清理工作
	}
}
