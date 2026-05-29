/**
 * StarVaultSidebarView.ts
 * Obsidian 侧边栏视图 - 用于展示 GitHub Stars 仓库列表
 *
 * 功能特性：
 * - 自定义标题栏（图标、标题、操作按钮组）
 * - 搜索过滤
 * - 分类筛选标签
 * - 仓库卡片列表
 * - 与主视图联动
 */

import { ItemView, WorkspaceLeaf, setIcon, Menu, TFile, Notice } from 'obsidian';
import StarVaultPlugin from './main';
import { db, DBRepo } from './db';
import { searchService } from './search';
import { ICONS } from 'constant';

export const VIEW_TYPE_STARNEST_SIDEBAR = 'starvault-sidebar';

// 仓库数据接口
export interface StarredRepo {
  id: number;
  owner: string;
  name: string;
  description: string;
  language: string;
  languageColor: string;
  stars: number;
  forks: number;
  updatedAt: string;
  createdAt: string;
  starredAt: string;
  topics: string[];
  tags: string[];
  isArchived: boolean;
  url: string;
  deletedAt: number | null;
}

// 排序选项
enum SortOption {
  STARS_DESC = 'stars-desc',
  STARS_ASC = 'stars-asc',
  UPDATED_DESC = 'updated-desc',
  UPDATED_ASC = 'updated-asc',
  NAME_ASC = 'name-asc',
  NAME_DESC = 'name-desc',
}

export class StarVaultSidebarView extends ItemView {
  plugin: StarVaultPlugin;

  // DOM 元素引用
  private searchInput: HTMLInputElement;
  private filterContainer: HTMLElement;
  private repoListContainer: HTMLElement;
  private sortButton: HTMLElement;

  // 状态
  public repos: StarredRepo[] = [];
  private filteredRepos: StarredRepo[] = [];
  private activeFilter: string = '全部';
  private currentSort: SortOption = SortOption.STARS_DESC;
  private searchQuery: string = '';
  public selectedRepoId: number | null = null;
  private selectedRepo: StarredRepo | null = null;
  private createNoteBtn: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: StarVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.repos = [];
    this.filteredRepos = [];
  }

  getViewType(): string {
    return VIEW_TYPE_STARNEST_SIDEBAR;
  }

  getDisplayText(): string {
    return 'StarVault';
  }

  getIcon(): string {
    return 'github';
  }

  /**
   * 视图打开时初始化
   */
  async onOpen() {
    const container = this.containerEl;
    container.addClass('starvault-sidebar-view');

    // 清空容器
    container.empty();

    // 从 IndexedDB 加载仓库数据
    await this.loadReposFromDB();

    // 创建导航头部（标题栏）
    this.createHeader(container);

    // 创建搜索区域
    this.createSearchArea(container);

    // 创建过滤器
    this.createFilters(container);

    // 创建仓库列表
    this.createRepoList(container);

    // 初始渲染
    this.renderRepoList();
  }

  /**
   * 从 IndexedDB 加载仓库数据
   */
  async loadReposFromDB(): Promise<void> {
    try {
      await db.open();
      const dbRepos = await db.repos.toArray();

      if (!searchService.isReady()) {
        await searchService.buildIndex();
      }

      if (dbRepos.length === 0) {
        this.clearRepos();
        return;
      }

      this.repos = dbRepos.map(this.mapDBRepoToStarredRepo.bind(this));
      this.filteredRepos = [...this.repos];
      this.renderFilters();
      this.applyFilters();
    } catch {
      this.clearRepos();
    }
  }

  private clearRepos(): void {
    this.repos = [];
    this.filteredRepos = [];
    this.renderFilters();
  }

  private mapDBRepoToStarredRepo(repo: DBRepo): StarredRepo {
    return {
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
    };
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
   * 创建标题栏
   */
  private createHeader(container: HTMLElement): void {
    const navHeader = container.createDiv('nav-header starvault-header');

    // 用户信息区域（左侧）
    const userContainer = navHeader.createDiv('user-container');

    // 用户头像
    const avatarEl = userContainer.createEl('img', {
      cls: 'user-avatar'
    });
    if (this.plugin.settings.userAvatar) {
      avatarEl.src = this.plugin.settings.userAvatar;
      avatarEl.alt = this.plugin.settings.username;
    } else if (this.plugin.settings.username) {
      // 如果没有头像 URL 但有用户名，使用默认 GitHub 头像
      avatarEl.src = `https://avatars.githubusercontent.com/u/499550?v=4`;
      avatarEl.alt = this.plugin.settings.username;
    } else {
      // 默认头像
      avatarEl.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/></svg>`;
    }

    // 用户信息
    const userInfo = userContainer.createDiv('user-info');
    const userName = userInfo.createEl('span', {
      text: this.plugin.settings.username || '未登录',
      cls: 'user-name'
    });
    const userCount = userInfo.createEl('span', {
      text: `${this.repos.length} 个仓库`,
      cls: 'user-count'
    });

    // 右侧：操作按钮组
    const buttonContainer = navHeader.createDiv('nav-buttons-container');

    // 同步按钮
    const syncBtn = this.createHeaderButton(
      buttonContainer,
      'refresh-cw',
      '同步 GitHub Stars',
      () => this.syncStars()
    );
    syncBtn.addClass('starvault-sync-btn');

    // 排序按钮
    this.sortButton = this.createHeaderButton(
      buttonContainer,
      'arrow-up-down',
      '排序',
      (evt) => this.showSortMenu(evt)
    );

    // 新建笔记按钮（初始禁用，需选择仓库后启用）
    this.createNoteBtn = this.createHeaderButton(
      buttonContainer,
      'plus',
      '请先选择仓库',
      () => this.createNewNote(),
      true // 初始禁用
    );

    // 更多选项按钮
    this.createHeaderButton(
      buttonContainer,
      'more-vertical',
      '更多选项',
      (evt) => this.showMoreMenu(evt)
    );
  }

  /**
   * 创建标题栏按钮
   */
  private createHeaderButton(
    container: HTMLElement,
    icon: string,
    tooltip: string,
    onClick: (evt: MouseEvent) => void,
    disabled: boolean = false
  ): HTMLElement {
    const btn = container.createDiv('nav-action-button');
    btn.setAttribute('aria-label', tooltip);
    setIcon(btn, icon);
    btn.addEventListener('click', (evt) => {
      // 动态检查按钮是否有 is-disabled class
      if (!btn.hasClass('is-disabled')) {
        onClick(evt);
      }
    });

    if (disabled) {
      btn.addClass('is-disabled');
    }

    return btn;
  }

  /**
   * 更新数量徽章
   */
  private updateCountBadge(container: HTMLElement, count: number): void {
    const existingBadge = container.querySelector('.starvault-count-badge');
    if (existingBadge) existingBadge.remove();

    container.createEl('span', {
      text: count.toString(),
      cls: 'starvault-count-badge'
    });
  }

  /**
   * 创建搜索区域
   */
  private createSearchArea(container: HTMLElement): void {
    const searchContainer = container.createDiv('starvault-search-container');

    const searchWrapper = searchContainer.createDiv('search-input-container');

    // 搜索图标
    const searchIcon = searchWrapper.createDiv('search-icon');
    setIcon(searchIcon, 'search');

    // 搜索输入框
    this.searchInput = searchWrapper.createEl('input', {
      type: 'text',
      placeholder: '搜索仓库...',
      cls: 'search-input'
    });

    // 监听输入
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.toLowerCase();
      this.applyFilters();
    });

    // 清除按钮（当有内容时显示）
    const clearBtn = searchWrapper.createDiv('search-clear-button hidden');
    setIcon(clearBtn, 'x');
    clearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      clearBtn.addClass('hidden');
      this.applyFilters();
    });

    this.searchInput.addEventListener('input', () => {
      if (this.searchInput.value) {
        clearBtn.removeClass('hidden');
      } else {
        clearBtn.addClass('hidden');
      }
    });
  }

  /**
   * 创建过滤器标签
   */
  private createFilters(container: HTMLElement): void {
    this.filterContainer = container.createDiv('starvault-filter-container');
    this.renderFilters();
  }

  /**
   * 渲染筛选器（支持动态更新）
   */
  private renderFilters(): void {
    if (!this.filterContainer) return;

    this.filterContainer.empty();

    // 内置筛选器
    const builtInFilters = ['全部'];

    // 所有自定义标签（按字母排序）
    const allTags = Array.from(new Set(
      this.repos.flatMap(repo => repo.tags)
    )).sort();

    const filters = [...builtInFilters, ...allTags];

    filters.forEach(filter => {
      const pill = this.filterContainer.createEl('span', {
        text: filter,
        cls: `filter-pill ${filter === this.activeFilter ? 'active' : ''}`
      });

      // 如果是标签，添加颜色
      if (filter !== '全部') {
        pill.style.backgroundColor = `${this.getTagColor(filter)}1a`;
        pill.style.color = this.getTagColor(filter);
        pill.style.border = `1px solid ${this.getTagColor(filter)}33`;
      }

      pill.addEventListener('click', () => {
        // 更新活跃状态
        this.filterContainer.querySelectorAll('.filter-pill').forEach(p => {
          p.removeClass('active');
        });
        pill.addClass('active');

        this.activeFilter = filter;
        this.applyFilters();
      });
    });
  }

  /**
   * 创建仓库列表容器
   */
  private createRepoList(container: HTMLElement): void {
    this.repoListContainer = container.createDiv('starvault-repo-list nav-files-container');
  }

  /**
   * 渲染仓库列表
   */
  public renderRepoList(): void {
    // 检查容器是否已初始化
    if (!this.repoListContainer) {
      console.log('StarVault: repoListContainer 尚未初始化，跳过渲染');
      return;
    }
    
    this.repoListContainer.empty();

    if (this.filteredRepos.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.filteredRepos.forEach(repo => {
      const repoEl = this.createRepoElement(repo);
      this.repoListContainer.appendChild(repoEl);
    });
  }

  /**
   * 创建单个仓库元素
   */
  private createRepoElement(repo: StarredRepo): HTMLElement {
    const isSoftDeleted = repo.deletedAt !== null && repo.deletedAt > 0;
    const repoEl = this.repoListContainer.createDiv(
      `starvault-repo-item ${this.selectedRepoId === repo.id ? 'active' : ''}${isSoftDeleted ? ' repo-item-deleted' : ''}`
    );
    repoEl.setAttribute('data-repo-id', repo.id.toString());

    // 仓库头部（头像 + 名称 + 语言标识）
    const header = repoEl.createDiv('repo-item-header');

    // 所有者头像（首字母）
    const owner = repo.owner || '?';
    const avatar = header.createDiv('repo-item-avatar');
    avatar.setText(owner.charAt(0).toUpperCase());
    avatar.addClass(this.generateGradient(owner));

    // 仓库名称
    const nameEl = header.createEl('span', {
      text: `${owner}/${repo.name || 'repo'}`,
      cls: 'repo-item-name'
    });

    // 语言颜色点
    const langDot = header.createSpan('repo-item-lang');
    langDot.style.backgroundColor = repo.languageColor;
    langDot.setAttribute('aria-label', repo.language);

    // 描述（显示一行，超出部分用...截断）
    if (repo.description) {
      const maxLength = 80;
      const displayText = repo.description.length > maxLength 
        ? repo.description.substring(0, maxLength) + '...' 
        : repo.description;
      const descEl = repoEl.createDiv({
        text: displayText,
        cls: 'repo-item-desc'
      });
      // 添加间距（上部到中部）
      descEl.style.marginTop = '8px';
      // 添加 title 属性，鼠标悬停时显示完整描述
      descEl.setAttribute('title', repo.description);
    }

    // 元信息（Star 数、Fork 数、更新时间）
    const meta = repoEl.createDiv('repo-item-meta');
    // 添加间距（描述到元信息）
    meta.style.marginTop = '8px';
    
    // Star 数
    const starSpan = meta.createSpan();
    starSpan.innerHTML = `${ICONS.star} ${this.formatNumber(repo.stars)}`;
    
    // Fork 数
    const forkSpan = meta.createSpan();
    forkSpan.innerHTML = `${ICONS.fork} ${this.formatNumber(repo.forks)}`;
    
    // 更新时间
    meta.createSpan({ text: repo.updatedAt });

    // 标签（loadReposFromDB 中已经处理了软删除的"归档"标签，这里直接使用）
    const tagsToDisplay = repo.tags;
    if (tagsToDisplay.length > 0) {
      const tagsContainer = repoEl.createDiv('repo-item-tags');
      // 添加间距（元信息到标签）
      tagsContainer.style.marginTop = '8px';
      const maxTags = 3;
      const displayTags = tagsToDisplay.slice(0, maxTags);
      const remainingCount = tagsToDisplay.length - maxTags;

      displayTags.forEach(tag => {
        const tagEl = tagsContainer.createEl('span', {
          text: tag,
          cls: `repo-item-tag${tag === '归档' ? ' repo-item-tag-archived' : ''}`
        });
        if (tag === '归档') {
          tagEl.style.backgroundColor = 'rgba(150, 150, 150, 0.1)';
          tagEl.style.color = '#999';
          tagEl.style.border = '1px solid rgba(150, 150, 150, 0.3)';
        } else {
          tagEl.style.backgroundColor = `${this.getTagColor(tag)}1a`;
          tagEl.style.color = this.getTagColor(tag);
          tagEl.style.border = `1px solid ${this.getTagColor(tag)}33`;
        }
      });

      // 如果标签数量超过3个，显示"+x标签"
      if (remainingCount > 0) {
        const moreTag = tagsContainer.createEl('span', {
          text: `+${remainingCount}标签`,
          cls: 'repo-item-tag repo-item-tag-more'
        });
        moreTag.style.backgroundColor = 'rgba(100, 100, 100, 0.08)';
        moreTag.style.color = '#666';
        moreTag.style.border = '1px solid rgba(100, 100, 100, 0.2)';
        moreTag.style.fontSize = '0.75em';
      }
    }

    // 点击事件
    repoEl.addEventListener('click', () => {
      this.selectRepo(repo);
    });

    // 右键菜单
    repoEl.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      this.showRepoContextMenu(evt, repo);
    });

    return repoEl;
  }

  /**
   * 渲染空状态
   */
  private renderEmptyState(): void {
    const emptyState = this.repoListContainer.createDiv('starvault-empty-state');

    const iconEl = emptyState.createDiv('empty-icon');
    setIcon(iconEl, 'inbox');

    emptyState.createEl('p', {
      text: this.searchQuery
        ? '没有找到匹配的仓库'
        : '还没有收藏的仓库',
      cls: 'empty-title'
    });

    if (!this.searchQuery) {
      emptyState.createEl('p', {
        text: '点击上方同步按钮获取你的 GitHub Stars',
        cls: 'empty-desc'
      });
    }
  }

  /**
   * 选择仓库
   */
  public selectRepo(repo: StarredRepo): void {
    this.selectedRepoId = repo.id;
    this.selectedRepo = repo;

    // 更新 UI 活跃状态
    this.repoListContainer.querySelectorAll('.starvault-repo-item').forEach(el => {
      el.removeClass('active');
    });
    const activeEl = this.repoListContainer.querySelector(`[data-repo-id="${repo.id}"]`);
    if (activeEl) activeEl.addClass('active');

    // 启用新建笔记按钮
    if (this.createNoteBtn) {
      this.createNoteBtn.removeClass('is-disabled');
      this.createNoteBtn.setAttribute('aria-label', `为 ${repo.owner}/${repo.name} 新建笔记`);
    }

    // 触发主视图更新（通过插件事件）
    this.plugin.emitRepoSelected(repo);

    // 显示通知
    new Notice(`已选择: ${repo.owner}/${repo.name}`);
  }

  /**
   * 应用过滤和排序
   */
  private applyFilters(): void {
    let result = [...this.repos];

    // 搜索过滤
    if (this.searchQuery) {
      result = result.filter(repo =>
        repo.name.toLowerCase().includes(this.searchQuery) ||
        repo.owner.toLowerCase().includes(this.searchQuery) ||
        repo.description.toLowerCase().includes(this.searchQuery) ||
        repo.tags.some(tag => tag.toLowerCase().includes(this.searchQuery))
      );
    }

    // 分类过滤（按自定义标签）
    if (this.activeFilter !== '全部') {
      result = result.filter(repo => repo.tags.includes(this.activeFilter));
    }

    // 排序
    result = this.sortRepos(result, this.currentSort);

    this.filteredRepos = result;
    this.renderRepoList();
  }

  /**
   * 排序仓库
   */
  private sortRepos(repos: StarredRepo[], sort: SortOption): StarredRepo[] {
    const sorted = [...repos];

    switch (sort) {
      case SortOption.STARS_DESC:
        return sorted.sort((a, b) => b.stars - a.stars);
      case SortOption.STARS_ASC:
        return sorted.sort((a, b) => a.stars - b.stars);
      case SortOption.UPDATED_DESC:
        return sorted; // 简化处理，实际应该按日期排序
      case SortOption.UPDATED_ASC:
        return sorted.reverse();
      case SortOption.NAME_ASC:
        return sorted.sort((a, b) => `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`));
      case SortOption.NAME_DESC:
        return sorted.sort((a, b) => `${b.owner}/${b.name}`.localeCompare(`${a.owner}/${a.name}`));
      default:
        return sorted;
    }
  }

  /**
   * 显示排序菜单
   */
  private showSortMenu(evt: MouseEvent): void {
    const menu = new Menu();

    const sortOptions: { label: string; value: SortOption }[] = [
      { label: 'Star 数（高 → 低）', value: SortOption.STARS_DESC },
      { label: 'Star 数（低 → 高）', value: SortOption.STARS_ASC },
      { label: '最近更新', value: SortOption.UPDATED_DESC },
      { label: '最早更新', value: SortOption.UPDATED_ASC },
      { label: '名称（A → Z）', value: SortOption.NAME_ASC },
      { label: '名称（Z → A）', value: SortOption.NAME_DESC },
    ];

    sortOptions.forEach(option => {
      menu.addItem((item) => {
        item
          .setTitle(option.label)
          .setIcon(this.currentSort === option.value ? 'check' : '')
          .onClick(() => {
            this.currentSort = option.value;
            this.applyFilters();
            new Notice(`已按: ${option.label} 排序`);
          });
      });
    });

    menu.showAtMouseEvent(evt);
  }

  /**
   * 显示更多选项菜单
   */
  private showMoreMenu(evt: MouseEvent): void {
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle('设置')
        .setIcon('settings')
        .onClick(() => {
          // 打开设置
          (this.app as any).setting.open();
          (this.app as any).setting.openTabById('starvault');
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('导出 Stars')
        .setIcon('download')
        .onClick(() => this.exportStars());
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle('刷新')
        .setIcon('refresh-cw')
        .onClick(() => this.syncStars());
    });

    menu.showAtMouseEvent(evt);
  }

  /**
   * 显示仓库右键菜单
   */
  private showRepoContextMenu(evt: MouseEvent, repo: StarredRepo): void {
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle('在 Obsidian 中打开')
        .setIcon('external-link')
        .onClick(async () => {
          const url = `https://github.com/${repo.owner}/${repo.name}`;
          await this.app.workspace.openLinkText('', url, true);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('复制 Clone URL')
        .setIcon('copy')
        .onClick(() => {
          navigator.clipboard.writeText(`https://github.com/${repo.owner}/${repo.name}.git`);
          new Notice('已复制到剪贴板');
        });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle('自定义标签')
        .setIcon('tag')
        .onClick(() => this.openTagEditor(repo));
    });

    menu.addItem((item) => {
      item
        .setTitle('创建笔记')
        .setIcon('file-plus')
        .onClick(() => this.createRepoNote(repo));
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle('取消 Star')
        .setIcon('star-off')
        .onClick(() => this.unstarRepo(repo));
    });

    menu.showAtMouseEvent(evt);
  }

  /**
   * 同步 Stars
   */
  private async syncStars(): Promise<void> {
    const syncBtn = this.containerEl.querySelector('.starvault-sync-btn');
    if (syncBtn) {
      syncBtn.addClass('is-syncing');
    }

    try {
      await this.plugin.syncGitHubStars();
    } catch (error: any) {
      new Notice('同步失败: ' + (error.message || '未知错误'));
    } finally {
      if (syncBtn) {
        syncBtn.removeClass('is-syncing');
      }
    }
  }

  /**
   * 创建新笔记
   */
  private async createNewNote(): Promise<void> {
    if (!this.selectedRepo) {
      new Notice('请先选择一个仓库');
      return;
    }

    const repo = this.selectedRepo;

    try {
      // 使用插件的模板方法创建笔记
      await this.plugin.createRepoNoteWithTemplate(repo);
      new Notice(`已为 ${repo.owner}/${repo.name} 创建笔记`);
    } catch (error: any) {
      new Notice('创建笔记失败: ' + error.message);
    }
  }

  /**
   * 创建仓库笔记
   */
  private async createRepoNote(repo: StarredRepo): Promise<void> {
    try {
      // 调用插件的模板方法创建笔记
      await this.plugin.createRepoNoteWithTemplate(repo);
      new Notice(`已为 ${repo.name} 创建笔记`);
    } catch (error: any) {
      new Notice('创建笔记失败: ' + error.message);
    }
  }

  /**
   * 自定义标签
   */
  private async openTagEditor(repo: StarredRepo): Promise<void> {
    const allTags = await db.getAllTags();
    const currentTags = [...repo.tags];

    const modal = document.createElement('div');
    modal.className = 'starvault-modal-overlay';
    modal.innerHTML = `
      <div class="starvault-modal">
        <div class="starvault-modal-header">
          <h3>自定义标签</h3>
          <button class="starvault-modal-close">&times;</button>
        </div>
        <div class="starvault-modal-body">
          <div class="starvault-tags-section">
            <h4>已添加标签</h4>
            <div class="starvault-current-tags">
              ${currentTags.length > 0 ? currentTags.map(tag => `
                <span class="starvault-tag-item" data-tag="${tag}">
                  ${tag}
                  <span class="starvault-tag-remove">&times;</span>
                </span>
              `).join('') : '<p class="starvault-empty-text">暂无标签</p>'}
            </div>
          </div>
          <div class="starvault-tags-section">
            <h4>已有标签</h4>
            <div class="starvault-existing-tags">
              ${allTags.filter(t => !currentTags.includes(t)).length > 0 
                ? allTags.filter(t => !currentTags.includes(t)).map(tag => `
                  <span class="starvault-tag-suggestion" data-tag="${tag}">${tag}</span>
                `).join('')
                : '<p class="starvault-empty-text">无其他标签</p>'}
            </div>
          </div>
          <div class="starvault-tags-section">
            <h4>添加新标签</h4>
            <input type="text" class="starvault-tag-input" placeholder="输入标签（按 Enter 确认）" />
          </div>
        </div>
        <div class="starvault-modal-footer">
          <button class="starvault-modal-btn starvault-modal-btn-primary">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
      modal.remove();
    };

    const saveTags = async () => {
      await db.updateRepoTags(repo.id, currentTags);
      await this.refreshRepoList();
      new Notice('标签已保存');
      closeModal();
    };

    modal.querySelector('.starvault-modal-close')?.addEventListener('click', saveTags);
    modal.querySelector('.starvault-modal-btn-primary')?.addEventListener('click', saveTags);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) saveTags();
    });

    const addTagToCurrent = (tagName: string) => {
      const trimmed = tagName.trim();
      if (trimmed && trimmed.length <= 20 && !currentTags.includes(trimmed)) {
        currentTags.push(trimmed);
        renderCurrentTags();
        renderExistingTags();
      }
    };

    const removeTagFromCurrent = (tagName: string) => {
      const index = currentTags.indexOf(tagName);
      if (index > -1) {
        currentTags.splice(index, 1);
        renderCurrentTags();
        renderExistingTags();
      }
    };

    const renderCurrentTags = () => {
      const container = modal.querySelector('.starvault-current-tags');
      if (container) {
        if (currentTags.length > 0) {
          container.innerHTML = currentTags.map(tag => `
            <span class="starvault-tag-item" data-tag="${tag}">
              ${tag}
              <span class="starvault-tag-remove">&times;</span>
            </span>
          `).join('');
          container.querySelectorAll('.starvault-tag-item').forEach(el => {
            el.querySelector('.starvault-tag-remove')?.addEventListener('click', () => {
              removeTagFromCurrent(el.getAttribute('data-tag') || '');
            });
          });
        } else {
          container.innerHTML = '<p class="starvault-empty-text">暂无标签</p>';
        }
      }
    };

    const renderExistingTags = () => {
      const container = modal.querySelector('.starvault-existing-tags');
      const availableTags = allTags.filter(t => !currentTags.includes(t));
      if (container) {
        if (availableTags.length > 0) {
          container.innerHTML = availableTags.map(tag => `
            <span class="starvault-tag-suggestion" data-tag="${tag}">${tag}</span>
          `).join('');
          container.querySelectorAll('.starvault-tag-suggestion').forEach(el => {
            el.addEventListener('click', () => {
              addTagToCurrent(el.getAttribute('data-tag') || '');
            });
          });
        } else {
          container.innerHTML = '<p class="starvault-empty-text">无其他标签</p>';
        }
      }
    };

    const input = modal.querySelector('.starvault-tag-input') as HTMLInputElement;
    input?.focus();
    input?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        addTagToCurrent(input.value);
        input.value = '';
      }
    });

    modal.querySelectorAll('.starvault-tag-suggestion').forEach(el => {
      el.addEventListener('click', () => {
        addTagToCurrent(el.getAttribute('data-tag') || '');
      });
    });

    modal.querySelectorAll('.starvault-tag-item').forEach(el => {
      el.querySelector('.starvault-tag-remove')?.addEventListener('click', () => {
        removeTagFromCurrent(el.getAttribute('data-tag') || '');
      });
    });
  }

  /**
   * 取消 Star
   */
  private unstarRepo(repo: StarredRepo): void {
    // 这里应该调用 GitHub API 取消 Star
    this.repos = this.repos.filter(r => r.id !== repo.id);
    this.applyFilters();
    new Notice(`已取消对 ${repo.name} 的 Star`);
  }

  /**
   * 导出 Stars
   */
  private async exportStars(): Promise<void> {
    const data = JSON.stringify(this.repos, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `starvault-export-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    new Notice('Stars 已导出');
  }

  /**
   * 生成头像渐变色类名（基于字符串哈希）
   */
  private generateGradient(str: string): string {
    const gradientCount = 7;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradientCount;
    return `gradient-${index}`;
  }

  /**
   * 格式化数字（添加千分位）
   */
  private formatNumber(num: number | null | undefined): string {
    if (num == null || isNaN(num) || !isFinite(num)) {
      return '0';
    }
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
   * 刷新仓库列表（从数据库重新加载）
   */
  private async refreshRepoList(): Promise<void> {
    const dbRepos = await db.repos.toArray();
    this.repos = dbRepos.map((repo: DBRepo) => ({
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        languageColor: repo.languageColor,
        stars: repo.stars,
        forks: repo.forks,
        updatedAt: new Date(repo.updatedAt).toLocaleDateString('zh-CN'),
        createdAt: new Date(repo.createdAt).toLocaleDateString('zh-CN'),
        starredAt: '',
        topics: repo.topics,
        tags: (repo.deletedAt ? [...repo.tags, '归档'] : repo.tags),
        isArchived: repo.isArchived,
        url: repo.htmlUrl,
        deletedAt: repo.deletedAt || null,
      }));
    this.renderFilters();
    this.applyFilters();

    const userCount = this.containerEl.querySelector('.user-count');
    if (userCount) {
      userCount.setText(`${this.repos.length} 个仓库`);
    }
  }

  /**
   * 更新仓库列表（从外部调用）
   */
  public updateRepos(repos: StarredRepo[]): void {
    this.repos = repos;
    this.renderFilters();
    this.applyFilters();

    // 更新用户信息区域的仓库数量
    const userCount = this.containerEl.querySelector('.user-count');
    if (userCount) {
      userCount.setText(`${repos.length} 个仓库`);
    }

    // 更新用户名（如果有设置）
    const userName = this.containerEl.querySelector('.user-name');
    if (userName && this.plugin.settings.username) {
      userName.setText(this.plugin.settings.username);
    }

    // 更新头像
    const avatar = this.containerEl.querySelector('.user-avatar') as HTMLImageElement;
    if (avatar) {
      if (this.plugin.settings.userAvatar) {
        avatar.src = this.plugin.settings.userAvatar;
        avatar.alt = this.plugin.settings.username;
      } else if (this.plugin.settings.username) {
        avatar.src = `https://avatars.githubusercontent.com/u/499550?v=4`;
        avatar.alt = this.plugin.settings.username;
      }
    }
  }

  /**
   * 更新用户信息（从外部调用，如设置页面登录/注销后）
   */
  public updateUserInfo(): void {
    // 更新用户名
    const userName = this.containerEl.querySelector('.user-name');
    if (userName) {
      userName.setText(this.plugin.settings.username || '未登录');
    }

    // 更新头像
    const avatar = this.containerEl.querySelector('.user-avatar') as HTMLImageElement;
    if (avatar) {
      if (this.plugin.settings.userAvatar) {
        avatar.src = this.plugin.settings.userAvatar;
        avatar.alt = this.plugin.settings.username;
      } else if (this.plugin.settings.username) {
        avatar.src = `https://avatars.githubusercontent.com/u/499550?v=4`;
        avatar.alt = this.plugin.settings.username;
      } else {
        avatar.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/></svg>`;
        avatar.alt = '';
      }
    }
  }

  /**
   * 视图关闭时清理
   */
  async onClose() {
    // 清理工作
  }
}
