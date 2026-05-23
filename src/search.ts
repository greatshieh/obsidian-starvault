import MiniSearch from 'minisearch';
import { db, DBRepo } from './db';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 可搜索的文档结构 */
export interface SearchableDoc {
  id: number;           // 仓库 ID
  description: string;  // 描述
  language: string;      // 语言
  topics: string[];      // GitHub Topics
  tags: string[];        // 自定义标签
  fullName: string;      // owner/name 组合
}

// ═══════════════════════════════════════════════════════════════
// 中文分词器
// ═══════════════════════════════════════════════════════════════

/**
 * 中文分词器
 * 基于正则的中文分词，支持中日韩文字
 */
function tokenizeChinese(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }
  
  // 移除 HTML 标签
  text = text.replace(/<[^>]*>/g, '');
  
  // 移除特殊字符，保留字母、数字、中日韩文字
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  
  // 按空格分割
  let tokens = text.split(/\s+/).filter(t => t.length > 0);
  
  // 对每个中文字符序列进行进一步分词
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/g;
  
  const result: string[] = [];
  for (const token of tokens) {
    if (cjkPattern.test(token)) {
      // 连续的中日韩文字，按 2-3 字符滑动窗口分词
      const matches = token.match(cjkPattern);
      if (matches) {
        for (const match of matches) {
          // 按 2 字符和 3 字符滑动窗口分词
          for (let i = 0; i < match.length - 1; i++) {
            result.push(match.substring(i, i + 2));
            if (i < match.length - 2) {
              result.push(match.substring(i, i + 3));
            }
          }
        }
      }
      // 同时保留原始 token
      result.push(token);
    } else {
      // 英文 token 转小写
      result.push(token.toLowerCase());
    }
  }
  
  return [...new Set(result)]; // 去重
}

// ═══════════════════════════════════════════════════════════════
// 搜索服务类
// ═══════════════════════════════════════════════════════════════

class SearchService {
  private miniSearch: MiniSearch;
  private isIndexBuilt: boolean = false;

  constructor() {
    this.miniSearch = new MiniSearch({
      fields: ['description', 'language', 'topics', 'tags', 'fullName'],
      storeFields: ['id'],
      searchOptions: {
        boost: { description: 1, language: 2, topics: 2, tags: 3, fullName: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
      tokenize: tokenizeChinese,
    });
  }

  /**
   * 从 IndexedDB 加载所有仓库并构建搜索索引
   */
  async buildIndex(): Promise<void> {
    try {
      const repos = await db.repos.toArray();
      
      if (repos.length === 0) {
        this.miniSearch = new MiniSearch({
          fields: ['description', 'language', 'topics', 'tags', 'fullName'],
          storeFields: ['id'],
          searchOptions: {
            boost: { description: 1, language: 2, topics: 2, tags: 3, fullName: 2 },
            fuzzy: 0.2,
            prefix: true,
          },
          tokenize: tokenizeChinese,
        });
        this.isIndexBuilt = true;
        return;
      }

      // 转换为搜索文档
      const documents: SearchableDoc[] = repos.map(repo => ({
        id: repo.id,
        description: repo.description || '',
        language: repo.language || '',
        topics: repo.topics || [],
        tags: repo.tags || [],
        fullName: repo.fullName || '',
      }));

      // 重建索引
      this.miniSearch = new MiniSearch({
        fields: ['description', 'language', 'topics', 'tags', 'fullName'],
        storeFields: ['id'],
        searchOptions: {
          boost: { description: 1, language: 2, topics: 2, tags: 3, fullName: 2 },
          fuzzy: 0.2,
          prefix: true,
        },
        tokenize: tokenizeChinese,
      });
      this.miniSearch.addAll(documents);
      this.isIndexBuilt = true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 添加单个仓库到索引
   */
  addToIndex(repo: DBRepo): void {
    if (!this.isIndexBuilt) {
      return;
    }

    const doc: SearchableDoc = {
      id: repo.id,
      description: repo.description || '',
      language: repo.language || '',
      topics: repo.topics || [],
      tags: repo.tags || [],
      fullName: repo.fullName || '',
    };

    this.miniSearch.add(doc);
  }

  /**
   * 从索引中移除仓库
   */
  removeFromIndex(repoId: number): void {
    if (!this.isIndexBuilt) {
      return;
    }

    try {
      this.miniSearch.discard(repoId);
    } catch {
      // 忽略不存在的文档
    }
  }

  /**
   * 更新索引中的仓库
   */
  updateInIndex(repo: DBRepo): void {
    this.removeFromIndex(repo.id);
    this.addToIndex(repo);
  }

  /**
   * 搜索仓库
   * @param query 搜索关键词
   * @param limit 返回结果数量限制
   * @returns 匹配的仓库 ID 数组
   */
  search(query: string, limit: number = 50): number[] {
    if (!this.isIndexBuilt || !query.trim()) {
      return [];
    }

    try {
      const results = this.miniSearch.search(query);
      return results.slice(0, limit).map((r: { id: number }) => r.id);
    } catch (error) {
      return [];
    }
  }

  /**
   * 获取搜索建议（自动补全）
   */
  suggest(query: string, limit: number = 5): string[] {
    if (!this.isIndexBuilt || !query.trim()) {
      return [];
    }

    try {
      const suggestions = this.miniSearch.autoSuggest(query);
      return suggestions.slice(0, limit).map((s: { suggestion: string }) => s.suggestion);
    } catch (error) {
      return [];
    }
  }

  /**
   * 检查索引是否已构建
   */
  isReady(): boolean {
    return this.isIndexBuilt;
  }

  /**
   * 获取索引大小
   */
  getIndexSize(): number {
    return this.miniSearch.documentCount;
  }

  /**
   * 清空索引
   */
  clearIndex(): void {
    this.miniSearch = new MiniSearch({
      fields: ['description', 'language', 'topics', 'tags', 'fullName'],
      storeFields: ['id'],
      searchOptions: {
        boost: { description: 1, language: 2, topics: 2, tags: 3, fullName: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
      tokenize: tokenizeChinese,
    });
    this.isIndexBuilt = false;
  }
}

// 导出单例
export const searchService = new SearchService();