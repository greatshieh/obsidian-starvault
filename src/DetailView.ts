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

		// Description 卡片
		if (repo.description) {
			const descCard = sidebar.createDiv('info-card');
			descCard.createEl('h3', { text: '描述' });
			descCard.createDiv('info-description').setText(repo.description);
		}

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
		infoCard.createDiv('info-row').innerHTML = `<span class="label">Star 数量</span><span class="value accent">${this.formatNumber(repo.stars)}</span>`;
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
			const tagsHeader = tagsCard.createDiv('info-card-header');
			tagsHeader.createEl('h3', { text: '自定义标签' });
			const editBtn = tagsHeader.createEl('button', {
				text: '编辑',
				cls: 'info-edit-btn'
			});
			editBtn.addEventListener('click', () => {
				const sidebarView = this.app.workspace.getLeavesOfType('starnest-sidebar')[0];
				if (sidebarView) {
					const view = sidebarView.view as any;
					if (view && view.openTagEditor) {
						view.openTagEditor(repo);
					}
				}
			});
			const tagsContainer = tagsCard.createDiv('info-tags');
			repo.tags.forEach((tag: string) => {
				const tagEl = tagsContainer.createEl('span', {
					text: tag,
					cls: 'info-tag'
				});
				tagEl.style.backgroundColor = `${this.getTagColor(tag)}1a`;
				tagEl.style.color = this.getTagColor(tag);
				tagEl.style.border = `1px solid ${this.getTagColor(tag)}33`;
			});
		} else {
			// 如果没有标签，显示添加按钮
			const tagsCard = sidebar.createDiv('info-card');
			const tagsHeader = tagsCard.createDiv('info-card-header');
			tagsHeader.createEl('h3', { text: '自定义标签' });
			const addBtn = tagsHeader.createEl('button', {
				text: '添加',
				cls: 'info-edit-btn'
			});
			addBtn.addEventListener('click', () => {
				const sidebarView = this.app.workspace.getLeavesOfType('starnest-sidebar')[0];
				if (sidebarView) {
					const view = sidebarView.view as any;
					if (view && view.openTagEditor) {
						view.openTagEditor(repo);
					}
				}
			});
			tagsCard.createDiv('info-empty-text').setText('暂无标签');
		}

		// 链接卡片
		const linkCard = sidebar.createDiv('info-card');
		linkCard.createEl('h3', { text: '链接' });

		linkCard.createEl('a', {
			text: '在 Github 查看',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', async (e) => {
			e.preventDefault();
			const url = `https://github.com/${repo.owner}/${repo.name}`;
			window.open(url, '_blank');
		});

		linkCard.createEl('a', {
			text: '在 Zread 查看',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', async (e) => {
			e.preventDefault();
			const url = `https://zread.ai/${repo.owner}/${repo.name}`;
			window.open(url, '_blank');
		});

		linkCard.createEl('a', {
			text: '在 DeepWiKi 查看',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', async (e) => {
			e.preventDefault();
			const url = `https://deepiki.com/${repo.owner}/${repo.name}`;
			window.open(url, '_blank');
		});


		linkCard.createEl('a', {
			text: '复制 Clone URL',
			cls: 'info-link',
			href: '#'
		}).addEventListener('click', (e) => {
			e.preventDefault();
			navigator.clipboard.writeText(`https://github.com/${repo.owner}/${repo.name}.git`);
			new Notice('已复制到剪贴板');
		});

		linkCard.createEl('a', {
			text: '创建笔记',
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
	 * 根据标签名生成颜色
	 */
	private getTagColor(tagName: string): string {
		const colors = [
			'#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
			'#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
			'#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
			'#ec4899', '#f43f5e', '#78716c', '#71717a', '#a1a1aa'
		];
		let hash = 0;
		for (let i = 0; i < tagName.length; i++) {
			hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length] as string;
	}

	/**
	 * 视图关闭时清理
	 */
	async onClose() {
		// 清理工作
	}
}
