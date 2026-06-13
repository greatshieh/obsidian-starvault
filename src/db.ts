import Dexie, { Table } from 'dexie';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 仓库数据 */
export interface DBRepo {
  id: number;                    // GitHub repo ID（主键）
  owner: string;                 // 所有者
  name: string;                  // 仓库名
  fullName: string;              // owner/name（冗余，方便搜索）
  description: string;           // 描述
  language: string;              // 主要语言
  languageColor: string;         // 语言颜色
  stars: number;                 // Star 数
  forks: number;                 // Fork 数
  topics: string[];              // GitHub Topics
  tags: string[];                // 用户自定义标签
  isArchived: boolean;           // 是否归档
  homepage: string | null;       // 主页 URL
  license: string | null;        // 许可证
  defaultBranch: string;         // 默认分支
  pushedAt: number;              // 最后推送时间戳
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  syncedAt: number;              // 同步时间戳
  avatarUrl: string;             // 所有者头像
  htmlUrl: string;               // GitHub URL
  deletedAt: number | null;     // 软删除标记（时间戳），null 表示未删除
}

/** 用户笔记 */
interface DBNote {
  id: string;                    // UUID（主键）
  repoId: number;                // 关联的仓库 ID
  repoName: string;              // 仓库全名（owner/name），用于显示孤立笔记
  title: string;                 // 笔记标题
  content: string;               // 笔记内容（Markdown）
  tags: string[];                // 笔记标签
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  filePath: string | null;       // 关联的 Obsidian 文件路径
  isOrphaned: boolean;           // 是否孤立（仓库已删除）
}

/** 自定义标签 */
interface DBTag {
  id: string;                    // UUID（主键）
  name: string;                  // 标签名
  color: string;                 // 颜色（HEX）
  icon: string | null;           // 图标
  description: string | null;    // 描述
  order: number;                 // 排序权重
  createdAt: number;             // 创建时间戳
}

/** 仓库-标签关联（多对多）*/
interface DBRepoTag {
  repoId: number;                // 仓库 ID
  tagId: string;                 // 标签 ID
  createdAt: number;             // 添加时间戳
}

/** 同步状态 */
interface DBSyncState {
  id: 'sync-state';              // 固定 ID（单例）
  lastSyncAt: number;            // 最后同步时间戳
  lastFullSyncAt: number;        // 最后全量同步时间戳
  totalRepos: number;            // 总仓库数
  syncInProgress: boolean;       // 是否正在同步
  lastError: string | null;      // 最后错误信息
}

// ═══════════════════════════════════════════════════════════════
// 数据库类
// ═══════════════════════════════════════════════════════════════

class StarVaultDB extends Dexie {
  repos!: Table<DBRepo, number>;
  notes!: Table<DBNote, string>;
  tags!: Table<DBTag, string>;
  repoTags!: Table<DBRepoTag, [number, string]>;
  syncState!: Table<DBSyncState, string>;

  constructor() {
    super('StarVaultDB');
    
    this.version(1).stores({
      // 仓库表：主键 id，多个索引用于排序和过滤
      repos: [
        'id',                          // 主键
        'owner',                       // 按所有者查询
        'name',                        // 按名称查询
        'fullName',                    // owner/name 组合查询
        'language',                    // 按语言过滤
        'stars',                       // 按 Star 数排序
        'forks',                       // 按 Fork 数排序
        'pushedAt',                    // 按推送时间排序
        'createdAt',                   // 按创建时间排序
        'updatedAt',                   // 按更新时间排序
        'syncedAt',                    // 按同步时间排序
        'isArchived',                  // 过滤归档仓库
        '*tags',                       // 多值索引：按标签查询
        '*topics',                     // 多值索引：按 Topic 查询
      ].join(','),
      
      // 笔记表
      notes: [
        'id',                          // 主键
        'repoId',                      // 按仓库 ID 查询
        'title',                       // 按标题查询
        'filePath',                    // 按文件路径查询（检查重复关联）
        'createdAt',                   // 按创建时间排序
        'updatedAt',                   // 按更新时间排序
        '*tags',                       // 多值索引：按标签查询
      ].join(','),
      
      // 标签表
      tags: [
        'id',                          // 主键
        '&name',                       // 唯一索引：标签名
        'order',                       // 排序权重
      ].join(','),
      
      // 仓库-标签关联表
      repoTags: [
        '[repoId+tagId]',              // 复合主键
        'repoId',                      // 按仓库查询标签
        'tagId',                       // 按标签查询仓库
      ].join(','),
      
      // 同步状态（单例）
      syncState: 'id',
      
      // 用户信息（单例）
      user: 'id',
    });
  }

  /**
   * 批量保存或更新仓库
   */
  async bulkUpsertRepos(repos: DBRepo[]): Promise<void> {
    await this.transaction('rw', this.repos, async () => {
      for (const repo of repos) {
        await this.repos.put(repo);
      }
    });
  }

  /**
   * 根据 ID 列表获取仓库
   */
  async getReposByIds(ids: number[]): Promise<DBRepo[]> {
    if (ids.length === 0) return [];
    return this.repos.where('id').anyOf(ids).toArray();
  }

  /**
   * 获取所有标签（从所有仓库中提取）
   */
  async getAllTags(): Promise<string[]> {
    const repos = await this.repos.toArray();
    const tagsSet = new Set<string>();
    repos.forEach(repo => {
      repo.tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }

  /**
   * 给仓库添加标签
   */
  async addTagToRepo(repoId: number, tag: string): Promise<void> {
    const repo = await this.repos.get(repoId);
    if (!repo) return;
    if (!repo.tags.includes(tag)) {
      repo.tags = [...repo.tags, tag];
      await this.repos.put(repo);
    }
  }

  /**
   * 数据完整性检查
   * 标记孤立笔记（关联的仓库不存在）
   * 返回标记的笔记数量
   */
  async checkDataIntegrity(): Promise<number> {
    let markedCount = 0;
    
    await this.transaction('rw', [this.repos, this.notes], async () => {
      // 获取所有仓库 ID
      const repos = await this.repos.toArray();
      const validRepoIds = new Set(repos.map(r => r.id));
      
      // 获取所有笔记
      const notes = await this.notes.toArray();
      
      // 找出孤立笔记（repoId 不存在于仓库列表中）
      const orphanedNotes = notes.filter(note => !validRepoIds.has(note.repoId) && !note.isOrphaned);
      
      // 标记孤立笔记
      for (const note of orphanedNotes) {
        note.isOrphaned = true;
        await this.notes.put(note);
        markedCount++;
      }
    });
    
    return markedCount;
  }

  /**
   * 从仓库移除标签
   */
  async removeTagFromRepo(repoId: number, tag: string): Promise<void> {
    const repo = await this.repos.get(repoId);
    if (!repo) return;
    repo.tags = repo.tags.filter(t => t !== tag);
    await this.repos.put(repo);
  }

  /**
   * 更新仓库的标签列表
   */
  async updateRepoTags(repoId: number, tags: string[]): Promise<void> {
    const repo = await this.repos.get(repoId);
    if (!repo) return;
    repo.tags = tags;
    await this.repos.put(repo);
  }

  /**
   * 软删除仓库（标记 deletedAt 并添加归档标签）
   */
  async softDeleteRepo(repoId: number): Promise<void> {
    const repo = await this.repos.get(repoId);
    if (!repo) return;
    repo.deletedAt = Date.now();
    // 添加归档标签（如果不存在）
    if (!repo.tags?.includes('归档')) {
      repo.tags = [...(repo.tags || []), '归档'];
    }
    await this.repos.put(repo);
  }

  /**
   * 硬删除仓库（彻底删除）
   * 包括：删除仓库记录、删除仓库-标签关联、标记笔记为孤立状态
   */
  async hardDeleteRepo(repoId: number): Promise<void> {
    await this.transaction('rw', [this.repos, this.repoTags, this.notes], async () => {
      // 1. 删除仓库-标签关联
      await this.repoTags.where('repoId').equals(repoId).delete();
      
      // 2. 标记关联的笔记为孤立状态（保留笔记）
      const notes = await this.notes.where('repoId').equals(repoId).toArray();
      for (const note of notes) {
        note.isOrphaned = true;
        await this.notes.put(note);
      }
      
      // 3. 删除仓库记录
      await this.repos.delete(repoId);
    });
  }

  /**
   * 获取已删除的仓库
   */
  async getDeletedRepos(): Promise<DBRepo[]> {
    return this.repos.filter(repo => repo.deletedAt !== null && repo.deletedAt > 0).toArray();
  }

  /**
   * 恢复已软删除的仓库
   */
  async restoreRepo(repoId: number): Promise<void> {
    const repo = await this.repos.get(repoId);
    if (!repo) return;
    repo.deletedAt = null;
    // 移除自动添加的"归档"标签
    if (repo.tags && repo.tags.includes('归档')) {
      repo.tags = repo.tags.filter(tag => tag !== '归档');
    }
    await this.repos.put(repo);
  }

  /**
   * 创建笔记
   */
  async createNote(repoId: number, repoName: string, title: string, content: string, filePath: string): Promise<DBNote> {
    const now = Date.now();
    const note: DBNote = {
      id: crypto.randomUUID(),
      repoId,
      repoName,
      title,
      content,
      tags: [],
      createdAt: now,
      updatedAt: now,
      filePath,
      isOrphaned: false,
    };
    await this.notes.put(note);
    return note;
  }

  /**
   * 获取仓库的所有笔记
   */
  async getNotesByRepoId(repoId: number): Promise<DBNote[]> {
    return this.notes.where('repoId').equals(repoId).toArray();
  }

  /**
   * 更新笔记
   */
  async updateNote(noteId: string, updates: Partial<DBNote>): Promise<void> {
    const note = await this.notes.get(noteId);
    if (!note) return;
    Object.assign(note, updates, { updatedAt: Date.now() });
    await this.notes.put(note);
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteId: string): Promise<void> {
    await this.notes.delete(noteId);
  }

  /**
   * 手动关联已有笔记到仓库
   * @param repoId 仓库 ID
   * @param repoName 仓库全名
   * @param filePath 文件路径
   * @returns 关联后的笔记对象，如果文件不存在或已关联返回 null
   */
  async linkNote(repoId: number, repoName: string, filePath: string): Promise<DBNote | null> {
    // 检查笔记是否已存在（通过文件路径）- 使用 filter 以防 filePath 索引不存在
    let existingNote: DBNote | undefined;
    try {
      existingNote = await this.notes.where('filePath').equals(filePath).first();
    } catch {
      // 如果索引不存在，使用 filter
      const allNotes = await this.notes.toArray();
      existingNote = allNotes.find(n => n.filePath === filePath);
    }
    
    if (existingNote) {
      return existingNote;  // 已关联，返回现有记录
    }

    // 从文件路径提取文件名作为标题
    const fileName = filePath.split('/').pop()?.replace('.md', '') || '';

    // 创建关联记录
    const now = Date.now();
    const note: DBNote = {
      id: crypto.randomUUID(),
      repoId,
      repoName,
      title: fileName,
      content: '',
      tags: [],
      createdAt: now,
      updatedAt: now,
      filePath,
      isOrphaned: false,
    };
    await this.notes.put(note);
    return note;
  }

  /**
   * 获取孤立笔记（仓库已删除但笔记保留）
   */
  async getOrphanedNotes(): Promise<DBNote[]> {
    return this.notes.filter(note => note.isOrphaned).toArray();
  }

  /**
   * 删除仓库的所有笔记
   */
  async deleteNotesByRepoId(repoId: number): Promise<void> {
    await this.notes.where('repoId').equals(repoId).delete();
  }
}

// ═══════════════════════════════════════════════════════════════
// 数据库操作辅助方法
// ═══════════════════════════════════════════════════════════════

/**
 * 将 GitHub API 响应转换为 DBRepo 格式
 */
export function githubRepoToDBRepo(item: any, languageColor: string): DBRepo {
  const ownerLogin = item.owner?.login || 'unknown';
  
  return {
    id: item.id || 0,
    owner: ownerLogin,
    name: item.name || 'repo',
    fullName: item.full_name || `${ownerLogin}/repo`,
    description: item.description || '',
    language: item.language || 'Unknown',
    languageColor: languageColor,
    stars: item.stargazers_count || 0,
    forks: item.forks_count || 0,
    topics: item.topics || [],
    tags: [], // 从本地数据获取
    isArchived: item.archived || false,
    homepage: item.homepage || null,
    license: item.license?.spdx_id || null,
    defaultBranch: item.default_branch || 'main',
    pushedAt: item.pushed_at ? new Date(item.pushed_at).getTime() : Date.now(),
    createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
    updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
    syncedAt: Date.now(),
    avatarUrl: item.owner?.avatar_url || '',
    htmlUrl: item.html_url || '',
    deletedAt: null, // 新增字段
  };
}

// 导出数据库实例
export const db = new StarVaultDB();