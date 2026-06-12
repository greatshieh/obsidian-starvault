/**
 * StarVaultDetailView.ts
 * 右侧边栏视图 - 用于显示仓库详情
 * 按照 preview.html 的样式重新设计
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice, TFile } from 'obsidian';
import StarVaultPlugin from './main';
import { StarredRepo } from './SidebarView';
import { db } from './db';

export const VIEW_TYPE_STARNEST_DETAIL = 'starvault-detail';

export class StarVaultDetailView extends ItemView {
	plugin: StarVaultPlugin;
	currentRepo: StarredRepo | null = null;
	currentNotes: any[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: StarVaultPlugin) {
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
	async showRepoDetail(repo: StarredRepo): Promise<void> {
		this.currentRepo = repo;
		// 加载该仓库的笔记
		this.currentNotes = await db.getNotesByRepoId(repo.id);
		this.render();
	}

	/**
	 * 视图打开时初始化
	 */
	async onOpen() {
		const container = this.containerEl;
		container.addClass('starvault-detail-view');
		container.empty();
		this.render();
	}

	/**
	 * 渲染视图内容
	 */
	public render(): void {
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
				const sidebarView = this.app.workspace.getLeavesOfType('starvault-sidebar')[0];
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
				const sidebarView = this.app.workspace.getLeavesOfType('starvault-sidebar')[0];
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

		// 取消标星/恢复/删除按钮
		const isSoftDeleted = repo.deletedAt !== null && repo.deletedAt > 0;
		const currentRepoId = repo.id;
		
		if (!isSoftDeleted) {
			// 未删除状态：显示取消标星按钮
			const cancelStarBtn = linkCard.createEl('button', {
				text: '取消标星',
				cls: 'info-link'
			});
			
			cancelStarBtn.addEventListener('click', async () => {
				try {
					await db.softDeleteRepo(repo.id);
					new Notice(`已取消标星: ${repo.owner}/${repo.name}`);
					// 刷新侧边栏 - 统一从数据库重新加载并保持选中状态
					if (this.plugin.sidebarView) {
						await this.plugin.sidebarView.loadReposFromDB();
						// 先设置选中状态，再渲染，最后触发选中事件更新详情
						this.plugin.sidebarView.selectedRepoId = currentRepoId;
						this.plugin.sidebarView.renderRepoList();
						const updatedRepo = this.plugin.sidebarView.repos.find(r => r.id === currentRepoId);
						if (updatedRepo) {
							this.plugin.sidebarView.selectRepo(updatedRepo);
						}
					}
				} catch (error: any) {
					new Notice('操作失败: ' + error.message);
				}
			});
		} else {
			// 软删除状态：显示恢复和删除按钮
			const restoreBtn = linkCard.createEl('button', {
				text: '恢复',
				cls: 'info-restore-btn'
			});
			
			restoreBtn.addEventListener('click', async () => {
				try {
					await db.restoreRepo(repo.id);
					new Notice(`已恢复标星: ${repo.owner}/${repo.name}`);
					// 刷新侧边栏并保持选中状态
					if (this.plugin.sidebarView) {
						await this.plugin.sidebarView.loadReposFromDB();
						// 先设置选中状态，再渲染，最后触发选中事件更新详情
						this.plugin.sidebarView.selectedRepoId = currentRepoId;
						this.plugin.sidebarView.renderRepoList();
						const updatedRepo = this.plugin.sidebarView.repos.find(r => r.id === currentRepoId);
						if (updatedRepo) {
							this.plugin.sidebarView.selectRepo(updatedRepo);
						}
					}
				} catch (error: any) {
					new Notice('恢复失败: ' + error.message);
				}
			});
			
			const deleteBtn = linkCard.createEl('button', {
				text: '删除',
				cls: 'info-danger-btn'
			});
			
			deleteBtn.addEventListener('click', async () => {
				const confirmed = window.confirm(
					`确定要彻底删除 "${repo.owner}/${repo.name}" 吗？\n\n此操作将：\n1. 从本地数据库删除仓库\n2. 同步取消 GitHub 标星\n3. 同步删除关联的笔记\n\n此操作不可恢复！`
				);
				
				if (!confirmed) return;
				
				try {
					// 调用 GitHub API 取消标星
					if (this.plugin.octokit) {
						await this.plugin.octokit.request(
							'DELETE /user/starred/{owner}/{repo}',
							{
								owner: repo.owner,
								repo: repo.name,
								headers: {
									'X-GitHub-Api-Version': '2026-03-10',
								},
							}
						);
					}
					
					// 从数据库彻底删除
					await db.hardDeleteRepo(repo.id);
					new Notice(`已彻底删除: ${repo.owner}/${repo.name}`);
					
					// 刷新侧边栏并自动激活下一个仓库
					const sidebarView = this.plugin.sidebarView;
					if (!sidebarView) {
						this.clearDetail();
						return;
					}

					// 删除前记录位置
					const currentIndex = sidebarView.filteredRepos.findIndex(r => r.id === currentRepoId);
					
					// 重新加载数据
					await sidebarView.loadReposFromDB();
					
					// 更新仓库总数
					const userCount = sidebarView.containerEl.querySelector('.user-count');
					if (userCount) {
						userCount.setText(`${sidebarView.repos.length} 个仓库`);
					}
					
					// 选择下一个仓库
					const reposAfter = sidebarView.filteredRepos.length;
					const nextRepo = reposAfter > 0
						? sidebarView.filteredRepos[currentIndex < reposAfter ? currentIndex : currentIndex - 1]
						: null;
					
					sidebarView.renderRepoList();
					nextRepo ? sidebarView.selectRepo(nextRepo) : this.clearDetail();
				} catch (error: any) {
					new Notice('删除失败: ' + (error.message || '未知错误'));
				}
			});
		}

		// 笔记列表卡片
		const notesCard = sidebar.createDiv('info-card');
		const notesHeader = notesCard.createDiv('info-card-header');
		notesHeader.createEl('h3', { text: '笔记' });
		const createNoteBtn = notesHeader.createEl('button', {
			text: '+ 新建',
			cls: 'info-edit-btn'
		});
		createNoteBtn.addEventListener('click', async () => {
			await this.plugin.createRepoNoteWithTemplate(repo);
			new Notice(`已为 ${repo.name} 创建笔记`);
			// 重新加载笔记列表
			this.currentNotes = await db.getNotesByRepoId(repo.id);
			this.render();
		});

		// 显示笔记列表
		if (this.currentNotes.length > 0) {
			const notesList = notesCard.createDiv('notes-list');
			for (const note of this.currentNotes) {
				const noteItem = notesList.createDiv('note-item');
				
				// 左侧：笔记信息
				const noteInfo = noteItem.createDiv('note-info');
				noteInfo.createEl('span', {
					text: note.title,
					cls: 'note-title'
				});
				noteInfo.createEl('span', {
					text: new Date(note.createdAt).toLocaleDateString(),
					cls: 'note-date'
				});
				
				// 右侧：操作按钮
				const noteActions = noteItem.createDiv('note-actions');
				
				// 打开笔记按钮
				const openBtn = noteActions.createEl('button', {
					cls: 'note-action-btn note-open-btn'
				});
				setIcon(openBtn, 'file-text');
				openBtn.setAttr('title', '打开笔记');
				openBtn.addEventListener('click', async () => {
					if (note.filePath) {
						let file = this.plugin.app.vault.getAbstractFileByPath(note.filePath);
						
						// 如果文件路径失效，尝试通过标题搜索同名文件
						if (!(file instanceof TFile)) {
							file = await this.findNoteByTitle(note.title);
							if (file) {
								// 更新数据库中的路径
								await db.updateNote(note.id, { filePath: file.path });
								note.filePath = file.path;
							}
						}
						
						if (file instanceof TFile) {
							await this.plugin.app.workspace.getLeaf().openFile(file);
						} else {
							new Notice('笔记文件不存在');
						}
					}
				});

				// 删除笔记按钮
				const deleteBtn = noteActions.createEl('button', {
					cls: 'note-action-btn note-delete-btn'
				});
				setIcon(deleteBtn, 'trash-2');
				deleteBtn.setAttr('title', '删除笔记');
				deleteBtn.addEventListener('click', async () => {
					const confirmed = window.confirm(`确定要删除笔记 "${note.title}" 吗？`);
					if (!confirmed) return;
					
					try {
						// 从数据库删除
						await db.deleteNote(note.id);
						// 从文件系统中删除（如果文件存在）
						if (note.filePath) {
							const file = this.plugin.app.vault.getAbstractFileByPath(note.filePath);
							if (file instanceof TFile) {
								await this.plugin.app.vault.delete(file);
							}
						}
						new Notice('笔记已删除');
						// 重新加载笔记列表
						this.currentNotes = await db.getNotesByRepoId(repo.id);
						this.render();
					} catch (error: any) {
						new Notice('删除失败: ' + error.message);
					}
				});
			}
		} else {
			// 如果没有笔记，显示空状态
			notesCard.createDiv('info-empty-text').setText('暂无笔记，点击上方按钮创建');
		}
	}

	/**
	 * 清空详情视图
	 */
	private clearDetail(): void {
		this.currentRepo = null;
		this.render();
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
	 * 通过标题搜索笔记文件
	 */
	private async findNoteByTitle(title: string): Promise<TFile | null> {
		const allFiles = this.plugin.app.vault.getFiles();
		// 查找匹配标题的 md 文件
		return allFiles.find(file => 
			file.extension === 'md' && 
			file.name.replace('.md', '') === title
		) || null;
	}

	/**
	 * 视图关闭时清理
	 */
	async onClose() {
		// 清理工作
	}
}
