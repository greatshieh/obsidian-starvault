/**
 * StarVaultDetailView.ts
 * 右侧边栏视图 - 用于显示仓库详情
 * 折叠面板样式
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice, TFile, Modal } from 'obsidian';
import StarVaultPlugin from './main';
import { StarredRepo } from './SidebarView';
import { db } from './db';

export const VIEW_TYPE_STARNEST_DETAIL = 'starvault-detail';

export class StarVaultDetailView extends ItemView {
	plugin: StarVaultPlugin;
	currentRepo: StarredRepo | null = null;
	currentNotes: any[] = [];
	
	// 折叠状态管理
	collapsedSections: Set<string> = new Set();

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
	 * 切换折叠状态
	 */
	private toggleCollapse(sectionId: string, contentEl: HTMLElement, arrowEl: HTMLElement): void {
		if (this.collapsedSections.has(sectionId)) {
			this.collapsedSections.delete(sectionId);
			contentEl.removeClass('collapsed');
			arrowEl.addClass('expanded');
		} else {
			this.collapsedSections.add(sectionId);
			contentEl.addClass('collapsed');
			arrowEl.removeClass('expanded');
		}
	}

	/**
	 * 创建折叠面板
	 */
	private createCollapsePanel(
		parent: HTMLElement,
		sectionId: string,
		title: string,
		contentGenerator: (content: HTMLElement) => void,
		options?: { defaultCollapsed?: boolean; actions?: (header: HTMLElement) => void }
	): void {
		const card = parent.createDiv('collapse-card');
		
		// 面板头部
		const header = card.createDiv('collapse-header');
		header.setAttribute('data-section', sectionId);
		
		// 左侧区域（箭头+标题）
		const headerLeft = header.createDiv('collapse-header-left');
		
		// 箭头图标
		const arrow = headerLeft.createDiv('collapse-arrow');
		setIcon(arrow, 'chevron-right');
		arrow.addClass('expanded');
		
		// 标题
		headerLeft.createEl('h3', {
			text: title,
			cls: 'collapse-title'
		});
		
		// 右侧操作区域
		if (options?.actions) {
			const actionsArea = header.createDiv('collapse-actions');
			options.actions(actionsArea);
		}
		
		// 面板内容
		const content = card.createDiv('collapse-content');
		
		// 生成内容
		contentGenerator(content);
		
		// 默认展开
		if (options?.defaultCollapsed) {
			this.collapsedSections.add(sectionId);
			content.addClass('collapsed');
			arrow.removeClass('expanded');
		}
		
		// 点击头部切换折叠状态
		header.addEventListener('click', (e) => {
			// 如果点击的是操作按钮区域，不触发折叠
			const target = e.target as HTMLElement;
			if (target.closest('.collapse-actions')) return;
			
			this.toggleCollapse(sectionId, content, arrow);
		});
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
			this.createCollapsePanel(sidebar, 'description', '描述', (content) => {
				content.createDiv('info-description').setText(repo.description);
			});
		}

		// Topics 卡片
		if (repo.topics && repo.topics.length > 0) {
			this.createCollapsePanel(sidebar, 'topics', 'Topics', (content) => {
				const topicsContainer = content.createDiv('info-tags');
				repo.topics.forEach((topic: string) => {
					topicsContainer.createEl('span', {
						text: topic,
						cls: 'info-tag'
					});
				});
			});
		}

		// 仓库信息卡片
		this.createCollapsePanel(sidebar, 'info', '仓库信息', (content) => {
			content.createDiv('info-row').innerHTML = `<span class="label">创建时间</span><span class="value">${repo.createdAt || '-'}</span>`;
			content.createDiv('info-row').innerHTML = `<span class="label">最后推送</span><span class="value">${repo.updatedAt || '-'}</span>`;
			content.createDiv('info-row').innerHTML = `<span class="label">Star 数量</span><span class="value accent">${this.formatNumber(repo.stars)}</span>`;
			content.createDiv('info-row').innerHTML = `<span class="label">Fork 数量</span><span class="value">${this.formatNumber(repo.forks)}</span>`;
			
			if (repo.language) {
				content.createDiv('info-row').innerHTML = `<span class="label">语言</span><span class="value"><span class="lang-dot" style="background: ${repo.languageColor}"></span>${repo.language}</span>`;
			}
			
			if (repo.isArchived) {
				content.createDiv('info-row').innerHTML = `<span class="label">状态</span><span class="value warning">⚠️ 已归档</span>`;
			}
		});

		// 自定义标签卡片
		if (repo.tags && repo.tags.length > 0) {
			this.createCollapsePanel(sidebar, 'tags', '自定义标签', (content) => {
				const tagsContainer = content.createDiv('info-tags');
				repo.tags.forEach((tag: string) => {
					const tagEl = tagsContainer.createEl('span', {
						text: tag,
						cls: 'info-tag'
					});
					tagEl.style.backgroundColor = `${this.getTagColor(tag)}1a`;
					tagEl.style.color = this.getTagColor(tag);
					tagEl.style.border = `1px solid ${this.getTagColor(tag)}33`;
				});
			}, {
				actions: (actions) => {
					const editBtn = actions.createEl('button', {
						cls: 'info-edit-btn'
					});
					setIcon(editBtn, 'pencil');
					editBtn.setAttr('title', '编辑标签');
					editBtn.addEventListener('click', () => {
						const sidebarView = this.app.workspace.getLeavesOfType('starvault-sidebar')[0];
						if (sidebarView) {
							const view = sidebarView.view as any;
							if (view && view.openTagEditor) {
								view.openTagEditor(repo);
							}
						}
					});
				}
			});
		} else {
			this.createCollapsePanel(sidebar, 'tags', '自定义标签', (content) => {
				content.createDiv('info-empty-text').setText('暂无标签');
			}, {
				actions: (actions) => {
					const addBtn = actions.createEl('button', {
						cls: 'info-edit-btn'
					});
					setIcon(addBtn, 'plus');
					addBtn.setAttr('title', '添加标签');
					addBtn.addEventListener('click', () => {
						const sidebarView = this.app.workspace.getLeavesOfType('starvault-sidebar')[0];
						if (sidebarView) {
							const view = sidebarView.view as any;
							if (view && view.openTagEditor) {
								view.openTagEditor(repo);
							}
						}
					});
				}
			});
		}

		// 链接卡片
		this.createCollapsePanel(sidebar, 'links', '链接', (content) => {
			content.createEl('a', {
				text: '在 Github 查看',
				cls: 'info-link',
				href: '#'
			}).addEventListener('click', async (e) => {
				e.preventDefault();
				const url = `https://github.com/${repo.owner}/${repo.name}`;
				window.open(url, '_blank');
			});

			content.createEl('a', {
				text: '在 Zread 查看',
				cls: 'info-link',
				href: '#'
			}).addEventListener('click', async (e) => {
				e.preventDefault();
				const url = `https://zread.ai/${repo.owner}/${repo.name}`;
				window.open(url, '_blank');
			});

			content.createEl('a', {
				text: '在 DeepWiKi 查看',
				cls: 'info-link',
				href: '#'
			}).addEventListener('click', async (e) => {
				e.preventDefault();
				const url = `https://deepiki.com/${repo.owner}/${repo.name}`;
				window.open(url, '_blank');
			});

			content.createEl('a', {
				text: '复制 Clone URL',
				cls: 'info-link',
				href: '#'
			}).addEventListener('click', (e) => {
				e.preventDefault();
				navigator.clipboard.writeText(`https://github.com/${repo.owner}/${repo.name}.git`);
				new Notice('已复制到剪贴板');
			});

			// 取消标星/恢复/删除按钮
			const isSoftDeleted = repo.deletedAt !== null && repo.deletedAt > 0;
			const currentRepoId = repo.id;
			
			if (!isSoftDeleted) {
				// 未删除状态：显示取消标星按钮
				const cancelStarBtn = content.createEl('button', {
					text: '取消标星',
					cls: 'info-link'
				});
				
				cancelStarBtn.addEventListener('click', async () => {
					try {
						await db.softDeleteRepo(repo.id);
						new Notice(`已取消标星: ${repo.owner}/${repo.name}`);
						if (this.plugin.sidebarView) {
							await this.plugin.sidebarView.loadReposFromDB();
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
				const restoreBtn = content.createEl('button', {
					text: '恢复',
					cls: 'info-restore-btn'
				});
				
				restoreBtn.addEventListener('click', async () => {
					try {
						await db.restoreRepo(repo.id);
						new Notice(`已恢复标星: ${repo.owner}/${repo.name}`);
						if (this.plugin.sidebarView) {
							await this.plugin.sidebarView.loadReposFromDB();
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
				
				const deleteBtn = content.createEl('button', {
					text: '删除',
					cls: 'info-danger-btn'
				});
				
				deleteBtn.addEventListener('click', async () => {
					const confirmed = window.confirm(
						`确定要彻底删除 "${repo.owner}/${repo.name}" 吗？\n\n此操作将：\n1. 从本地数据库删除仓库\n2. 同步取消 GitHub 标星\n3. 同步删除关联的笔记\n\n此操作不可恢复！`
					);
					
					if (!confirmed) return;
					
					try {
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
						
						await db.hardDeleteRepo(repo.id);
						new Notice(`已彻底删除: ${repo.owner}/${repo.name}`);
						
						const sidebarView = this.plugin.sidebarView;
						if (!sidebarView) {
							this.clearDetail();
							return;
						}

						const currentIndex = sidebarView.filteredRepos.findIndex(r => r.id === currentRepoId);
						await sidebarView.loadReposFromDB();
						
						const userCount = sidebarView.containerEl.querySelector('.user-count');
						if (userCount) {
							userCount.setText(`${sidebarView.repos.length} 个仓库`);
						}
						
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
		});

		// 笔记列表卡片
		this.createCollapsePanel(sidebar, 'notes', '笔记', (content) => {
			// 显示笔记列表
			if (this.currentNotes.length > 0) {
				const notesList = content.createDiv('notes-list');
				for (const note of this.currentNotes) {
					this.renderNoteItem(notesList, note, repo);
				}
			} else {
				// 如果没有笔记，显示空状态
				content.createDiv('info-empty-text').setText('暂无笔记，点击上方按钮创建');
			}
		}, {
			actions: (actions: HTMLElement) => {
				// 笔记数量显示（放在按钮左边）
				const countEl = actions.createDiv('notes-count');
				countEl.setText(`${this.currentNotes.length} 个`);

				// 笔记操作按钮组
				const notesActions = actions.createDiv('notes-actions');

				// 新建笔记按钮
				const createNoteBtn = notesActions.createEl('button', {
					cls: 'info-edit-btn'
				});
				setIcon(createNoteBtn, 'plus');
				createNoteBtn.setAttr('title', '新建笔记');
				createNoteBtn.addEventListener('click', async () => {
					await this.plugin.createRepoNoteWithTemplate(repo);
					new Notice(`已为 ${repo.name} 创建笔记`);
					this.currentNotes = await db.getNotesByRepoId(repo.id);
					this.render();
				});

				// 关联已有笔记按钮
				const linkNoteBtn = notesActions.createEl('button', {
					cls: 'info-edit-btn'
				});
				setIcon(linkNoteBtn, 'link');
				linkNoteBtn.setAttr('title', '关联已有笔记');
				linkNoteBtn.addEventListener('click', async () => {
					this.openNoteLinkModal(repo);
				});
			}
		});
	}

	/**
	 * 渲染笔记项
	 */
	private renderNoteItem(parent: HTMLElement, note: any, repo: any): void {
		const noteItem = parent.createDiv('note-item');
		// 悬浮显示完整路径
		noteItem.setAttr('title', note.filePath || note.title);
		
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
		setIcon(openBtn, 'external-link');
		openBtn.setAttr('title', '打开笔记');
		openBtn.addEventListener('click', async () => {
			if (note.filePath) {
				let file = this.plugin.app.vault.getAbstractFileByPath(note.filePath);
				
				if (!(file instanceof TFile)) {
					file = await this.findNoteByTitle(note.title);
					if (file) {
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
				await db.deleteNote(note.id);
				if (note.filePath) {
					const file = this.plugin.app.vault.getAbstractFileByPath(note.filePath);
					if (file instanceof TFile) {
						await this.plugin.app.vault.delete(file);
					}
				}
				new Notice('笔记已删除');
				this.currentNotes = await db.getNotesByRepoId(repo.id);
				this.render();
			} catch (error: any) {
				new Notice('删除失败: ' + error.message);
			}
		});
	}

	/**
	 * 打开笔记关联弹窗
	 */
	private async openNoteLinkModal(repo: any): Promise<void> {
		const linkedPaths = new Set(this.currentNotes.map(note => note.filePath).filter(Boolean));
		
		const allFiles = this.plugin.app.vault.getFiles();
		const mdFiles = allFiles.filter(
			file => file instanceof TFile && 
			        file.extension === 'md' && 
			        !linkedPaths.has(file.path)
		);
		
		if (mdFiles.length === 0) {
			new Notice('没有可关联的笔记（已全部关联或没有其他笔记）');
			return;
		}
		
		const modal = new Modal(this.plugin.app);
		modal.titleEl.setText('选择要关联的笔记');
		
		const container = modal.contentEl.createDiv('note-select-container');
		container.addClass('starvault-note-select');
		
		const searchWrapper = container.createDiv('note-search-wrapper');
		const searchInput = searchWrapper.createEl('input', {
			type: 'text',
			placeholder: '输入关键字搜索笔记...',
			cls: 'note-search-input'
		});
		
		const selectedCountEl = container.createDiv('note-selected-count');
		selectedCountEl.setText('已选择 0 个');
		
		const list = container.createEl('div', 'note-select-list');
		const selectedPaths = new Set<string>();
		
		const renderFiles = (files: TFile[]) => {
			list.empty();
			selectedPaths.clear();
			updateSelectedCount();
			
			if (files.length === 0) {
				list.createDiv('note-select-empty').setText('没有找到匹配的笔记');
				return;
			}
			
			for (const file of files) {
				const item = list.createEl('div', 'note-select-item');
				
				const checkbox = item.createEl('input', {
					type: 'checkbox',
					cls: 'note-item-checkbox'
				});
				checkbox.setAttribute('data-path', file.path);
				
				item.createEl('span', {
					text: file.path,
					cls: 'note-item-text'
				});
				
				const toggleSelection = (e: Event) => {
					const target = e.target as HTMLElement;
					if (target === checkbox) {
						checkbox.checked = !checkbox.checked;
					}
					
					if (checkbox.checked) {
						selectedPaths.add(file.path);
					} else {
						selectedPaths.delete(file.path);
					}
					updateSelectedCount();
				};
				
				item.addEventListener('click', toggleSelection);
				checkbox.addEventListener('click', toggleSelection);
			}
		};
		
		const updateSelectedCount = () => {
			const count = selectedPaths.size;
			selectedCountEl.setText(`已选择 ${count} 个`);
			confirmBtn.disabled = count === 0;
		};
		
		const buttonArea = container.createDiv('note-button-area');
		
		const selectAllBtn = buttonArea.createEl('button', {
			text: '全选',
			cls: 'note-btn note-btn-secondary'
		});
		selectAllBtn.addEventListener('click', () => {
			list.querySelectorAll('.note-item-checkbox').forEach((cb) => {
				const checkbox = cb as HTMLInputElement;
				checkbox.checked = true;
				const path = checkbox.getAttribute('data-path');
				if (path) selectedPaths.add(path);
			});
			updateSelectedCount();
		});
		
		const deselectAllBtn = buttonArea.createEl('button', {
			text: '取消全选',
			cls: 'note-btn note-btn-secondary'
		});
		deselectAllBtn.addEventListener('click', () => {
			list.querySelectorAll('.note-item-checkbox').forEach((cb) => {
				const checkbox = cb as HTMLInputElement;
				checkbox.checked = false;
			});
			selectedPaths.clear();
			updateSelectedCount();
		});
		
		const confirmBtn = buttonArea.createEl('button', {
			text: '确认关联',
			cls: 'note-btn note-btn-primary'
		});
		confirmBtn.disabled = true;
		confirmBtn.addEventListener('click', async () => {
			if (selectedPaths.size === 0) return;
			
			modal.close();
			
			const repoName = `${repo.owner}/${repo.name}`;
			let successCount = 0;
			
			for (const filePath of selectedPaths) {
				const note = await db.linkNote(repo.id, repoName, filePath);
				if (note) successCount++;
			}
			
			new Notice(`已关联 ${successCount} 个笔记`);
			this.currentNotes = await db.getNotesByRepoId(repo.id);
			this.render();
		});
		
		searchInput.addEventListener('input', () => {
			const keyword = searchInput.value.toLowerCase().trim();
			if (keyword) {
				const filtered = mdFiles.filter(file => 
					file.path.toLowerCase().includes(keyword)
				);
				renderFiles(filtered);
			} else {
				renderFiles(mdFiles);
			}
		});
		
		renderFiles(mdFiles);
		
		modal.open();
		setTimeout(() => searchInput.focus(), 100);
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
