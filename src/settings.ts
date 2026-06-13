/**
 * StarVault Plugin Settings Tab
 * Obsidian 插件设置页面
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import StarVaultPlugin from './main';
import { db } from './db';
import { searchService } from './search';
import { t } from './lang';

export class StarVaultSettingTab extends PluginSettingTab {
  plugin: StarVaultPlugin;

  constructor(app: App, plugin: StarVaultPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'StarVault ' + t('settings.title', this.plugin.settings.language) });

    // GitHub Token 设置（带登录按钮）
    new Setting(containerEl)
      .setName(t('settings.githubToken', this.plugin.settings.language))
      .setDesc(t('settings.githubTokenDesc', this.plugin.settings.language))
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
            .setButtonText(t('settings.logout', this.plugin.settings.language))
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.githubToken = '';
              this.plugin.settings.username = '';
              this.plugin.settings.userAvatar = '';
              this.plugin.octokit = null;
              await this.plugin.saveSettings();
              // 更新左侧边栏用户信息
              this.plugin.sidebarView?.updateUserInfo();
              new Notice(t('notices.loggedOut', this.plugin.settings.language));
              this.display(); // 刷新设置页面
            });
        } else {
          // 未登录，显示登录按钮
          button
            .setButtonText(t('settings.login', this.plugin.settings.language))
            .setCta()
            .onClick(async () => {
              if (!this.plugin.octokit) {
                new Notice(t('notices.pleaseEnterToken', this.plugin.settings.language));
                return;
              }
              try {
                button.setButtonText(t('settings.loggingIn', this.plugin.settings.language));
                button.setDisabled(true);
                
                const { data: user } = await this.plugin.octokit.rest.users.getAuthenticated();
                
                this.plugin.settings.username = user.login;
                this.plugin.settings.userAvatar = user.avatar_url;
                await this.plugin.saveSettings();
                
                // 更新左侧边栏用户信息
                this.plugin.sidebarView?.updateUserInfo();
                
                new Notice(t('notices.loginSuccess', this.plugin.settings.language) + user.login);
                this.display(); // 刷新设置页面
              } catch (error: any) {
                new Notice(t('notices.loginFailed', this.plugin.settings.language) + error.message);
                button.setButtonText(t('settings.login', this.plugin.settings.language));
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

    // 用户管理入口（多用户支持）
    new Setting(containerEl)
      .setName(t('settings.userManagement', this.plugin.settings.language))
      .setDesc(t('settings.userManagementDesc', this.plugin.settings.language))
      .addButton(button => button
        .setButtonText(t('common.edit', this.plugin.settings.language))
        .onClick(() => {
          this.openUserManagementModal();
        }));

    // 数据备份与恢复
    containerEl.createEl('h3', { text: t('settings.backupRestore', this.plugin.settings.language) });

    // 导出所有数据
    new Setting(containerEl)
      .setName(t('settings.exportAllData', this.plugin.settings.language))
      .setDesc(t('settings.exportAllDataDesc', this.plugin.settings.language))
      .addButton(button => button
        .setButtonText(t('common.export', this.plugin.settings.language))
        .onClick(async () => {
          try {
            const data = await db.exportAllData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `starvault-backup-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            new Notice(t('notices.dataExported', this.plugin.settings.language));
          } catch (error) {
            new Notice(t('notices.exportFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
          }
        }));

    // 导入数据
    new Setting(containerEl)
      .setName(t('settings.importData', this.plugin.settings.language))
      .setDesc(t('settings.importDataDesc', this.plugin.settings.language))
      .addButton(button => button
        .setButtonText(t('common.import', this.plugin.settings.language))
        .onClick(() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.style.display = 'none';
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
              const text = await file.text();
              const confirmed = window.confirm(t('common.confirm', this.plugin.settings.language));
              if (!confirmed) return;

              await db.importData(text);
              new Notice(t('notices.dataImportedRestart', this.plugin.settings.language));
            } catch (error) {
              new Notice(t('notices.importFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
            }
          };
          document.body.appendChild(input);
          input.click();
          document.body.removeChild(input);
        }));

    containerEl.createEl('h3', { text: t('settings.syncSettings', this.plugin.settings.language) });

    // 启动时同步
    new Setting(containerEl)
      .setName(t('settings.syncOnStartup', this.plugin.settings.language))
      .setDesc(t('settings.syncOnStartupDesc', this.plugin.settings.language))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        }));

    // 自动同步间隔
    new Setting(containerEl)
      .setName(t('settings.autoSyncInterval', this.plugin.settings.language))
      .setDesc(t('settings.autoSyncIntervalDesc', this.plugin.settings.language))
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
        .setTooltip(t('settings.reset', this.plugin.settings.language))
        .onClick(async () => {
          this.plugin.settings.autoSyncInterval = 0;
          await this.plugin.saveSettings();
          this.display();
        }));

    containerEl.createEl('h3', { text: t('settings.displaySettings', this.plugin.settings.language) });

    // 默认排序
    new Setting(containerEl)
      .setName(t('settings.defaultSort', this.plugin.settings.language))
      .setDesc(t('settings.defaultSortDesc', this.plugin.settings.language))
      .addDropdown(dropdown => dropdown
        .addOption('stars-desc', t('settings.sortStarsDesc', this.plugin.settings.language))
        .addOption('stars-asc', t('settings.sortStarsAsc', this.plugin.settings.language))
        .addOption('updated-desc', t('settings.sortUpdatedDesc', this.plugin.settings.language))
        .addOption('updated-asc', t('settings.sortUpdatedAsc', this.plugin.settings.language))
        .addOption('name-asc', t('settings.sortNameAsc', this.plugin.settings.language))
        .addOption('name-desc', t('settings.sortNameDesc', this.plugin.settings.language))
        .setValue(this.plugin.settings.defaultSort)
        .onChange(async (value) => {
          this.plugin.settings.defaultSort = value;
          await this.plugin.saveSettings();
        }));

    // 显示归档仓库
    new Setting(containerEl)
      .setName(t('settings.showArchived', this.plugin.settings.language))
      .setDesc(t('settings.showArchivedDesc', this.plugin.settings.language))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showArchived)
        .onChange(async (value) => {
          this.plugin.settings.showArchived = value;
          await this.plugin.saveSettings();
        }));

    // 语言设置
    new Setting(containerEl)
      .setName(t('settings.language', this.plugin.settings.language))
      .setDesc(t('settings.languageDesc', this.plugin.settings.language))
      .addDropdown(dropdown => dropdown
        .addOption('zh', '中文')
        .addOption('en', 'English')
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          this.plugin.settings.language = value as 'en' | 'zh';
          await this.plugin.saveSettings();
          new Notice(t('notices.languageChanged', value as 'en' | 'zh'));
          this.display(); // 刷新设置页面以应用新语言
        }));

    containerEl.createEl('h3', { text: t('settings.noteSettings', this.plugin.settings.language) });

    // 笔记路径模板
    new Setting(containerEl)
      .setName(t('settings.notePathTemplate', this.plugin.settings.language))
      .setDesc(t('settings.notePathTemplateDesc', this.plugin.settings.language))
      .addText(text => text
        .setPlaceholder('StarVault')
        .setValue(this.plugin.settings.notePathTemplate)
        .onChange(async (value) => {
          this.plugin.settings.notePathTemplate = value || 'StarVault';
          await this.plugin.saveSettings();
        }));

    // 笔记名称模板
    new Setting(containerEl)
      .setName(t('settings.noteNameTemplate', this.plugin.settings.language))
      .setDesc(t('settings.noteNameTemplateDesc', this.plugin.settings.language))
      .addText(text => text
        .setPlaceholder('{{repo}}')
        .setValue(this.plugin.settings.noteNameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.noteNameTemplate = value || '{{repo}}';
          await this.plugin.saveSettings();
        }));

    // 笔记内容模板
    new Setting(containerEl)
      .setName(t('settings.noteContentTemplate', this.plugin.settings.language))
      .setDesc(t('settings.noteContentTemplateDesc', this.plugin.settings.language))
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

    containerEl.createEl('h3', { text: t('settings.dataManagement', this.plugin.settings.language) });

    // 删除数据库
    new Setting(containerEl)
      .setName(t('settings.deleteAllRepos', this.plugin.settings.language))
      .setDesc(t('settings.deleteAllReposDesc', this.plugin.settings.language))
      .addButton(button => button
        .setButtonText(t('settings.deleteRepoDataBtn', this.plugin.settings.language))
        .setWarning()
        .onClick(async () => {
          const confirmed = window.confirm(
            t('settings.confirmDeleteRepos', this.plugin.settings.language)
          );
          
          if (!confirmed) return;
          
          try {
            button.setButtonText(t('settings.deleting', this.plugin.settings.language));
            button.setDisabled(true);
            
            // 清空数据库
            await db.repos.clear();
            
            // 重建搜索索引
            await searchService.buildIndex();
            
            // 更新侧边栏
            if (this.plugin.sidebarView) {
              await this.plugin.sidebarView.loadReposFromDB();
              this.plugin.sidebarView.updateRepos([]);
            }
            
            new Notice(t('notices.allReposDeleted', this.plugin.settings.language));
          } catch (error) {
            new Notice(t('notices.deleteFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
          } finally {
            button.setButtonText(t('settings.deleteRepoDataBtn', this.plugin.settings.language));
            button.setDisabled(false);
          }
        }));
  }

  /**
   * 打开用户管理弹窗（多用户支持）
   */
  async openUserManagementModal(): Promise<void> {
    const users = await db.getAllUsers();
    const currentUserId = this.plugin.currentUserId;

    const modal = document.createElement('div');
    modal.className = 'starvault-user-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    `;

    const content = document.createElement('div');
    content.className = 'starvault-user-modal-content';
    content.style.cssText = `
      background: var(--background-primary);
      border-radius: 12px;
      padding: 0;
      width: 500px;
      max-width: 90%;
      max-height: 85vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      animation: slideUp 0.3s ease-out;
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: var(--background-secondary);
      border-bottom: 1px solid var(--background-modifier-border);
    `;
    
    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    
    const headerIcon = document.createElement('div');
    headerIcon.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: var(--interactive-accent);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    headerIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    
    const title = document.createElement('h2');
    title.textContent = t('userManagement.title', this.plugin.settings.language);
    title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
    
    headerLeft.appendChild(headerIcon);
    headerLeft.appendChild(title);
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.title = t('common.close', this.plugin.settings.language);
    closeBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    closeBtn.onmouseenter = () => closeBtn.style.background = 'var(--background-modifier-hover)';
    closeBtn.onmouseleave = () => closeBtn.style.background = 'none';
    closeBtn.onclick = () => modal.remove();
    
    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // 用户列表容器
    const userList = document.createElement('div');
    userList.style.cssText = `
      padding: 16px;
      max-height: 50vh;
      overflow-y: auto;
    `;

    if (users.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 20px;
        color: var(--text-faint);
      `;
      emptyState.innerHTML = `
        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--background-secondary); display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <p style="margin: 0; font-size: 14px;">${t('userManagement.emptyState', this.plugin.settings.language).split('。')[0]}。</p>
        <p style="margin: 4px 0 0 0; font-size: 12px;">${t('userManagement.emptyState', this.plugin.settings.language).split('。')[1]}</p>
      `;
      userList.appendChild(emptyState);
    } else {
      for (const user of users) {
        const userCard = document.createElement('div');
        userCard.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: var(--background-secondary);
          border-radius: 8px;
          margin-bottom: 8px;
          border: 2px solid ${user.id === currentUserId ? 'var(--interactive-accent)' : 'transparent'};
          transition: all 0.2s ease;
        `;
        userCard.onmouseenter = () => {
          if (user.id !== currentUserId) {
            userCard.style.background = 'var(--background-modifier-hover)';
          }
        };
        userCard.onmouseleave = () => {
          userCard.style.background = 'var(--background-secondary)';
        };

        const userInfo = document.createElement('div');
        userInfo.style.cssText = 'display: flex; align-items: center; gap: 12px; flex: 1;';

        // 头像容器（带在线状态指示）
        const avatarContainer = document.createElement('div');
        avatarContainer.style.cssText = 'position: relative;';
        
        const avatarImg = document.createElement('img');
        avatarImg.src = user.avatarUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/%3E%3Ccircle cx="12" cy="7" r="4"/%3E%3C/svg%3E';
        avatarImg.alt = user.login || user.name;
        avatarImg.style.cssText = `
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          background: var(--background-modifier-border);
        `;
        
        // 当前用户指示器
        if (user.id === currentUserId) {
          const activeIndicator = document.createElement('div');
          activeIndicator.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--interactive-accent);
            border: 2px solid var(--background-secondary);
          `;
          avatarContainer.appendChild(activeIndicator);
        }
        avatarContainer.appendChild(avatarImg);

        const userText = document.createElement('div');
        userText.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

        const userName = document.createElement('span');
        userName.textContent = user.name + (user.id === currentUserId ? ' ' + t('userManagement.currentUser', this.plugin.settings.language) : '');
        userName.style.cssText = 'font-weight: 600; font-size: 14px; color: var(--text-normal);';

        const userLogin = document.createElement('span');
        userLogin.textContent = user.login ? `@${user.login}` : t('userManagement.notLoggedIn', this.plugin.settings.language);
        userLogin.style.cssText = 'font-size: 12px; color: var(--text-faint);';

        userText.appendChild(userName);
        userText.appendChild(userLogin);

        userInfo.appendChild(avatarContainer);
        userInfo.appendChild(userText);

        const userActions = document.createElement('div');
        userActions.style.cssText = 'display: flex; gap: 6px;';

        // 切换用户按钮
        if (user.id !== currentUserId) {
          const switchBtn = document.createElement('button');
          switchBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8L22 12L18 16"/><path d="M2 12h20"/></svg>';
          switchBtn.title = t('userManagement.switchUser', this.plugin.settings.language);
          switchBtn.style.cssText = `
            background: var(--interactive-accent);
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s;
          `;
          switchBtn.onmouseenter = () => switchBtn.style.background = 'var(--interactive-accent-hover)';
          switchBtn.onmouseleave = () => switchBtn.style.background = 'var(--interactive-accent)';
          switchBtn.onclick = async () => {
            try {
              await db.switchActiveUser(user.id);
              this.plugin.currentUserId = user.id;
              this.plugin.settings.githubToken = user.token;
              await this.plugin.saveSettings();
              this.plugin.initOctokit();
              
              // 刷新数据
              await this.plugin.sidebarView?.loadReposFromDB();
              if (this.plugin.sidebarView) {
                const repos = this.plugin.sidebarView.repos;
                this.plugin.sidebarView.updateRepos(repos);
              }
              
              // 更新侧边栏用户信息显示
              this.plugin.settings.username = user.login || '';
              this.plugin.settings.userAvatar = user.avatarUrl || '';
              await this.plugin.saveSettings();
              this.plugin.sidebarView?.updateUserInfo();
              
              new Notice(t('notices.userSwitched', this.plugin.settings.language) + ': ' + user.name);
              modal.remove();
              this.display();
            } catch (error) {
              new Notice(t('notices.switchFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
            }
          };
          userActions.appendChild(switchBtn);
        }

        // 编辑按钮
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
        editBtn.title = t('userManagement.editUser', this.plugin.settings.language);
        editBtn.style.cssText = `
          background: var(--background-modifier-border);
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        `;
        editBtn.onmouseenter = () => {
          editBtn.style.background = 'var(--background-modifier-hover)';
          editBtn.style.color = 'var(--text-normal)';
        };
        editBtn.onmouseleave = () => {
          editBtn.style.background = 'var(--background-modifier-border)';
          editBtn.style.color = 'var(--text-muted)';
        };
        editBtn.onclick = () => {
          this.openEditUserModal(user, async (updates) => {
            await db.updateUser(user.id, updates);
            new Notice(t('notices.userUpdated', this.plugin.settings.language));
            modal.remove();
            this.openUserManagementModal();
          });
        };
        userActions.appendChild(editBtn);

        // 导出按钮
        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
        exportBtn.title = t('userManagement.exportUserData', this.plugin.settings.language);
        exportBtn.style.cssText = `
          background: var(--background-modifier-border);
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        `;
        exportBtn.onmouseenter = () => {
          exportBtn.style.background = 'var(--background-modifier-hover)';
          exportBtn.style.color = 'var(--text-normal)';
        };
        exportBtn.onmouseleave = () => {
          exportBtn.style.background = 'var(--background-modifier-border)';
          exportBtn.style.color = 'var(--text-muted)';
        };
        exportBtn.onclick = async () => {
          try {
            const data = await db.exportUserData(user.id);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `starvault-user-${user.name}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            new Notice(t('notices.userDataExported', this.plugin.settings.language));
          } catch (error) {
            new Notice(t('notices.exportFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
          }
        };
        userActions.appendChild(exportBtn);

        // 删除按钮（不能删除当前用户，不能删除默认用户）
        if (user.id !== currentUserId && user.id !== 'default') {
          const deleteBtn = document.createElement('button');
          deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
          deleteBtn.title = t('userManagement.deleteUser', this.plugin.settings.language);
          deleteBtn.style.cssText = `
            background: var(--background-modifier-border);
            border: none;
            padding: 6px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            color: var(--text-warning);
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s;
          `;
          deleteBtn.onmouseenter = () => deleteBtn.style.background = 'rgba(239, 68, 68, 0.1)';
          deleteBtn.onmouseleave = () => deleteBtn.style.background = 'var(--background-modifier-border)';
          deleteBtn.onclick = async () => {
            const confirmed = window.confirm(t('userManagement.confirmDelete', this.plugin.settings.language).replace('{name}', user.name));
            if (!confirmed) return;
            try {
              await db.deleteUser(user.id);
              new Notice(t('notices.userDeleted', this.plugin.settings.language));
              modal.remove();
              this.openUserManagementModal();
            } catch (error) {
              new Notice(t('notices.deleteFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
            }
          };
          userActions.appendChild(deleteBtn);
        }

        userCard.appendChild(userInfo);
        userCard.appendChild(userActions);
        userList.appendChild(userCard);
      }
    }

    content.appendChild(userList);

    // 底部操作栏
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 16px;
      border-top: 1px solid var(--background-modifier-border);
      display: flex;
      gap: 8px;
    `;

    // 添加用户按钮
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
    addBtn.style.cssText = `
      flex: 1;
      background: var(--interactive-accent);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    `;
    addBtn.onmouseenter = () => addBtn.style.background = 'var(--interactive-accent-hover)';
    addBtn.onmouseleave = () => addBtn.style.background = 'var(--interactive-accent)';
    addBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg> ' + t('userManagement.addUser', this.plugin.settings.language);
    addBtn.onclick = () => {
      this.openEditUserModal(null, async (data) => {
        try {
          await db.addUser({
            id: crypto.randomUUID(),
            name: data.name,
            token: data.token,
            isActive: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            login: '',
            avatarUrl: '',
          });
          
          // 如果有 Token，同步数据
          if (data.token) {
            const users = await db.getAllUsers();
            const newUser = users.find(u => u.name === data.name);
            if (newUser) {
              this.plugin.currentUserId = newUser.id;
              this.plugin.settings.githubToken = data.token;
              await this.plugin.saveSettings();
              this.plugin.initOctokit();
              
              // 切换到新用户并同步
              await db.switchActiveUser(newUser.id);
              
              // 刷新数据
              await this.plugin.sidebarView?.loadReposFromDB();
              if (this.plugin.sidebarView) {
                const repos = this.plugin.sidebarView.repos;
                this.plugin.sidebarView.updateRepos(repos);
              }
            }
            
            new Notice(t('notices.userAddedAndSwitched', this.plugin.settings.language));
          } else {
            new Notice(t('notices.userAdded', this.plugin.settings.language));
          }
          
          modal.remove();
          this.openUserManagementModal();
        } catch (error) {
          new Notice(t('notices.addFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
        }
      });
    };
    footer.appendChild(addBtn);

    // 导入用户数据按钮
    const importBtn = document.createElement('button');
    importBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ' + t('userManagement.importUser', this.plugin.settings.language);
    importBtn.style.cssText = `
      padding: 10px 16px;
      background: var(--background-secondary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    `;
    importBtn.onmouseenter = () => {
      importBtn.style.background = 'var(--background-modifier-hover)';
      importBtn.style.color = 'var(--text-normal)';
    };
    importBtn.onmouseleave = () => {
      importBtn.style.background = 'var(--background-secondary)';
      importBtn.style.color = 'var(--text-muted)';
    };
    importBtn.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          await db.importUserData(text);
          new Notice(t('notices.userDataImported', this.plugin.settings.language));
          modal.remove();
          this.openUserManagementModal();
        } catch (error) {
          new Notice(t('notices.importFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
        }
      };
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    };
    footer.appendChild(importBtn);

    // 关闭按钮
    const closeFooterBtn = document.createElement('button');
    closeFooterBtn.textContent = t('common.close', this.plugin.settings.language);
    closeFooterBtn.style.cssText = `
      padding: 10px 20px;
      background: var(--background-secondary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      color: var(--text-muted);
      transition: all 0.2s;
    `;
    closeFooterBtn.onmouseenter = () => {
      closeFooterBtn.style.background = 'var(--background-modifier-hover)';
      closeFooterBtn.style.color = 'var(--text-normal)';
    };
    closeFooterBtn.onmouseleave = () => {
      closeFooterBtn.style.background = 'var(--background-secondary)';
      closeFooterBtn.style.color = 'var(--text-muted)';
    };
    closeFooterBtn.onclick = () => modal.remove();
    footer.appendChild(closeFooterBtn);

    content.appendChild(footer);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 添加动画样式
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { 
          opacity: 0; 
          transform: translateY(20px); 
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
    `;
    document.head.appendChild(styleSheet);

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // 清理样式
    modal.addEventListener('remove', () => {
      styleSheet.remove();
    });
  }

  /**
   * 打开编辑/添加用户弹窗
   */
  openEditUserModal(
    user: { id: string; name: string; token: string } | null,
    onSave: (data: { name: string; token: string }) => Promise<void>
  ): void {
    const modal = document.createElement('div');
    modal.className = 'starvault-edit-user-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: var(--background-primary);
      border-radius: 8px;
      padding: 20px;
      width: 400px;
      max-width: 90%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    // 标题
    const title = document.createElement('h2');
    title.textContent = user ? t('userManagement.editUser', this.plugin.settings.language) : t('userManagement.addUser', this.plugin.settings.language);
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px;';
    content.appendChild(title);

    // 名称输入
    const nameLabel = document.createElement('label');
    nameLabel.textContent = t('userManagement.userName', this.plugin.settings.language);
    nameLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-muted);';
    content.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = user?.name || '';
    nameInput.placeholder = t('userManagement.userNamePlaceholder', this.plugin.settings.language);
    nameInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--background-secondary);
      color: var(--text-normal);
      margin-bottom: 16px;
      box-sizing: border-box;
    `;
    content.appendChild(nameInput);

    // Token 输入
    const tokenLabel = document.createElement('label');
    tokenLabel.textContent = t('userManagement.githubToken', this.plugin.settings.language);
    tokenLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-muted);';
    content.appendChild(tokenLabel);

    const tokenInput = document.createElement('input');
    tokenInput.type = 'password';
    tokenInput.value = user?.token || '';
    tokenInput.placeholder = t('userManagement.githubTokenPlaceholder', this.plugin.settings.language);
    tokenInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      background: var(--background-secondary);
      color: var(--text-normal);
      margin-bottom: 8px;
      box-sizing: border-box;
    `;
    content.appendChild(tokenInput);

    // 提示
    const hint = document.createElement('p');
    hint.innerHTML = t('userManagement.tokenHint', this.plugin.settings.language);
    hint.style.cssText = 'font-size: 11px; color: var(--text-faint); margin: 0 0 16px 0;';
    hint.querySelector('a')?.style.setProperty('color', 'var(--interactive-accent)');
    content.appendChild(hint);

    // 按钮
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = t('common.cancel', this.plugin.settings.language);
    cancelBtn.style.cssText = `
      padding: 8px 16px;
      background: var(--background-secondary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      cursor: pointer;
    `;
    cancelBtn.onclick = () => modal.remove();
    btnGroup.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = t('common.save', this.plugin.settings.language);
    saveBtn.style.cssText = `
      padding: 8px 16px;
      background: var(--interactive-accent);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    saveBtn.onclick = async () => {
      const name = nameInput.value.trim();
      const token = tokenInput.value.trim();
      
      if (!name) {
        new Notice(t('notices.pleaseEnterName', this.plugin.settings.language));
        return;
      }
      
      saveBtn.disabled = true;
      saveBtn.textContent = t('notices.saving', this.plugin.settings.language);
      
      try {
        await onSave({ name, token });
        modal.remove();
      } catch (error) {
        new Notice(t('notices.saveFailed', this.plugin.settings.language) + (error instanceof Error ? error.message : 'Unknown error'));
        saveBtn.disabled = false;
        saveBtn.textContent = t('common.save', this.plugin.settings.language);
      }
    };
    btnGroup.appendChild(saveBtn);

    content.appendChild(btnGroup);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
