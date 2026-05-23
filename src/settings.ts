/**
 * StarNest Plugin Settings Tab
 * Obsidian 插件设置页面
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import StarNestPlugin from './main';

export class StarNestSettingTab extends PluginSettingTab {
  plugin: StarNestPlugin;

  constructor(app: App, plugin: StarNestPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'StarNest 设置' });

    // GitHub Token 设置（带登录按钮）
    new Setting(containerEl)
      .setName('GitHub Token')
      .setDesc('用于访问 GitHub API 获取你的 Stars。在 GitHub Settings > Developer settings > Personal access tokens 中创建。')
      .addText(text => text
        .setPlaceholder('ghp_xxxxxxxxxxxx')
        .setValue(this.plugin.settings.githubToken)
        .onChange(async (value) => {
          this.plugin.settings.githubToken = value;
          await this.plugin.saveSettings();
          // 重新初始化 Octokit
          this.plugin.initOctokit();
        }))
      .addButton(button => {
        if (this.plugin.settings.username) {
          // 已登录，显示注销按钮
          button
            .setButtonText('注销')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.githubToken = '';
              this.plugin.settings.username = '';
              this.plugin.settings.userAvatar = '';
              this.plugin.octokit = null;
              await this.plugin.saveSettings();
              // 更新左侧边栏用户信息
              this.plugin.sidebarView?.updateUserInfo();
              new Notice('已注销');
              this.display(); // 刷新设置页面
            });
        } else {
          // 未登录，显示登录按钮
          button
            .setButtonText('登录')
            .setCta()
            .onClick(async () => {
              if (!this.plugin.octokit) {
                new Notice('请先设置 GitHub Token');
                return;
              }
              try {
                button.setButtonText('登录中...');
                button.setDisabled(true);
                
                const { data: user } = await this.plugin.octokit.rest.users.getAuthenticated();
                
                this.plugin.settings.username = user.login;
                this.plugin.settings.userAvatar = user.avatar_url;
                await this.plugin.saveSettings();
                
                // 更新左侧边栏用户信息
                this.plugin.sidebarView?.updateUserInfo();
                
                new Notice(`登录成功：${user.login}`);
                this.display(); // 刷新设置页面
              } catch (error: any) {
                new Notice('登录失败：' + error.message);
                button.setButtonText('登录');
                button.setDisabled(false);
              }
            });
        }
      });

    // 用户信息显示区域
    if (this.plugin.settings.username) {
      const userInfoEl = containerEl.createDiv('github-user-info');
      userInfoEl.style.display = 'flex';
      userInfoEl.style.alignItems = 'center';
      userInfoEl.style.gap = '12px';
      userInfoEl.style.padding = '12px';
      userInfoEl.style.background = 'var(--background-secondary)';
      userInfoEl.style.borderRadius = '6px';
      userInfoEl.style.marginTop = '8px';

      const avatarEl = userInfoEl.createEl('img', {
        cls: 'github-user-avatar'
      });
      avatarEl.src = this.plugin.settings.userAvatar;
      avatarEl.alt = this.plugin.settings.username;
      avatarEl.style.width = '48px';
      avatarEl.style.height = '48px';
      avatarEl.style.borderRadius = '50%';

      const userDetailsEl = userInfoEl.createDiv('github-user-details');
      userDetailsEl.style.display = 'flex';
      userDetailsEl.style.flexDirection = 'column';
      userDetailsEl.style.gap = '4px';

      const nameEl = userDetailsEl.createEl('span', {
        text: this.plugin.settings.username,
        cls: 'github-user-name'
      });
      nameEl.style.fontSize = '16px';
      nameEl.style.fontWeight = '600';
      nameEl.style.color = 'var(--text-normal)';

      const idEl = userDetailsEl.createEl('span', {
        text: `ID: ${this.plugin.settings.username}`,
        cls: 'github-user-id'
      });
      idEl.style.fontSize = '12px';
      idEl.style.color = 'var(--text-faint)';
    }

    containerEl.createEl('h3', { text: '同步设置' });

    // 启动时同步
    new Setting(containerEl)
      .setName('启动时同步')
      .setDesc('Obsidian 启动时自动同步 GitHub Stars')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        }));

    // 自动同步间隔
    new Setting(containerEl)
      .setName('自动同步间隔')
      .setDesc('自动同步的时间间隔（分钟），设为 0 表示关闭自动同步')
      .addSlider(slider => slider
        .setLimits(0, 60, 5)
        .setValue(this.plugin.settings.autoSyncInterval)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.autoSyncInterval = value;
          await this.plugin.saveSettings();
        }))
      .addExtraButton(button => button
        .setIcon('reset')
        .setTooltip('重置为默认值')
        .onClick(async () => {
          this.plugin.settings.autoSyncInterval = 0;
          await this.plugin.saveSettings();
          this.display();
        }));

    containerEl.createEl('h3', { text: '显示设置' });

    // 默认排序
    new Setting(containerEl)
      .setName('默认排序方式')
      .setDesc('仓库列表的默认排序方式')
      .addDropdown(dropdown => dropdown
        .addOption('stars-desc', 'Star 数（高 → 低）')
        .addOption('stars-asc', 'Star 数（低 → 高）')
        .addOption('updated-desc', '最近更新')
        .addOption('updated-asc', '最早更新')
        .addOption('name-asc', '名称（A → Z）')
        .addOption('name-desc', '名称（Z → A）')
        .setValue(this.plugin.settings.defaultSort)
        .onChange(async (value) => {
          this.plugin.settings.defaultSort = value;
          await this.plugin.saveSettings();
        }));

    // 显示归档仓库
    new Setting(containerEl)
      .setName('显示归档仓库')
      .setDesc('在列表中显示已归档的仓库')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showArchived)
        .onChange(async (value) => {
          this.plugin.settings.showArchived = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: '笔记设置' });

    // 笔记路径模板
    new Setting(containerEl)
      .setName('笔记路径模板')
      .setDesc('创建笔记的文件夹路径。支持变量：{{owner}}, {{repo}}, {{date}}（年-月-日）。默认：StarVault')
      .addText(text => text
        .setPlaceholder('StarVault')
        .setValue(this.plugin.settings.notePathTemplate)
        .onChange(async (value) => {
          this.plugin.settings.notePathTemplate = value || 'StarVault';
          await this.plugin.saveSettings();
        }));

    // 笔记名称模板
    new Setting(containerEl)
      .setName('笔记名称模板')
      .setDesc('创建笔记的文件名（不含扩展名）。支持变量：{{owner}}, {{repo}}, {{date}}。默认：{{repo}}')
      .addText(text => text
        .setPlaceholder('{{repo}}')
        .setValue(this.plugin.settings.noteNameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.noteNameTemplate = value || '{{repo}}';
          await this.plugin.saveSettings();
        }));

    // 笔记内容模板
    new Setting(containerEl)
      .setName('笔记内容模板')
      .setDesc('创建仓库笔记时使用的内容模板。可用变量：{{repo}}, {{owner}}, {{starnumber}}, {{starred-at}}, {{updated_at}}, {{created-at}}, {{language}}, {{tags}}, {{url}}, {{repo.name}}, {{repo.description}}')
      .addTextArea(text => {
        text
          .setPlaceholder('# {{repo.name}}\n\n...')
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.noteTemplate = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 12;
        text.inputEl.style.width = '100%';
        text.inputEl.style.minWidth = '300px';
        text.inputEl.style.fontFamily = 'monospace';
        return text;
      });
  }
}
