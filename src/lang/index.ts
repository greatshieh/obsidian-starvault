import en from './en';
// 临时注释掉中文语言包导入，等待文件创建
import zh from './zh';

export type Language = 'en' | 'zh';

export interface Translation {
  // 通用
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    export: string;
    import: string;
    close: string;
    confirm: string;
    yes: string;
    no: string;
  };

  // 设置页面
  settings: {
    title: string;
    userManagement: string;
    userManagementDesc: string;
    backupRestore: string;
    exportAllData: string;
    exportAllDataDesc: string;
    importData: string;
    importDataDesc: string;
    syncSettings: string;
    syncOnStartup: string;
    syncOnStartupDesc: string;
    autoSyncInterval: string;
    autoSyncIntervalDesc: string;
    displaySettings: string;
    defaultSort: string;
    defaultSortDesc: string;
    language: string;
    languageDesc: string;
    reset: string;
    // GitHub Token
    githubToken: string;
    githubTokenDesc: string;
    logout: string;
    login: string;
    loggingIn: string;
    // 显示设置
    showArchived: string;
    showArchivedDesc: string;
    // 排序选项
    sortStarsDesc: string;
    sortStarsAsc: string;
    sortUpdatedDesc: string;
    sortUpdatedAsc: string;
    sortNameAsc: string;
    sortNameDesc: string;
    // 笔记设置
    noteSettings: string;
    notePathTemplate: string;
    notePathTemplateDesc: string;
    noteNameTemplate: string;
    noteNameTemplateDesc: string;
    noteContentTemplate: string;
    noteContentTemplateDesc: string;
    // 数据管理
    dataManagement: string;
    deleteAllRepos: string;
    deleteAllReposDesc: string;
    deleteRepoDataBtn: string;
    confirmDeleteRepos: string;
    deleting: string;
  };

  // 用户管理
  userManagement: {
    title: string;
    addUser: string;
    editUser: string;
    deleteUser: string;
    currentUser: string;
    inactiveUser: string;
    userName: string;
    userNamePlaceholder: string;
    githubToken: string;
    githubTokenPlaceholder: string;
    tokenHint: string;
    switchUser: string;
    exportUserData: string;
    importUser: string;
    emptyState: string;
    confirmDelete: string;
    notLoggedIn: string;
  };

  // 命令
  commands: {
    syncStars: string;
    syncStarsDesc: string;
    openSidebar: string;
    openSidebarDesc: string;
  };

  // 通知
  notices: {
    syncSuccess: string;
    syncFailed: string;
    syncInProgress: string;
    userAdded: string;
    userAddedAndSwitched: string;
    userUpdated: string;
    userDeleted: string;
    userSwitched: string;
    dataExported: string;
    dataImported: string;
    dataImportedRestart: string;
    exportFailed: string;
    importFailed: string;
    addFailed: string;
    deleteFailed: string;
    languageChanged: string;
    pleaseEnterToken: string;
    loggedOut: string;
    loginSuccess: string;
    loginFailed: string;
    switchFailed: string;
    userDataExported: string;
    userDataImported: string;
    allReposDeleted: string;
    pleaseEnterName: string;
    saving: string;
    saveFailed: string;
    noteCreated: string;
    unstarSuccess: string;
    restoreSuccess: string;
  };

  // 侧边栏
  sidebar: {
    title: string;
    sync: string;
    searchPlaceholder: string;
    filterLanguage: string;
    filterTag: string;
    sortStars: string;
    sortUpdated: string;
    sortName: string;
    noRepos: string;
    noSearchResults: string;
    repos: string;
    notLoggedIn: string;
    syncButton: string;
    sort: string;
    moreOptions: string;
    all: string;
    archived: string;
    tags: string;
    moreTags: string;
    emptySearch: string;
    emptyNoRepos: string;
    emptyHint: string;
    selected: string;
    timeMinutesAgo: string;
    timeHoursAgo: string;
    timeDaysAgo: string;
    sortStarsDesc: string;
    sortStarsAsc: string;
    sortUpdatedDesc: string;
    sortUpdatedAsc: string;
    sortNameAsc: string;
    sortNameDesc: string;
    sortedBy: string;
    settings: string;
    exportStars: string;
    refresh: string;
    openInObsidian: string;
    copyCloneUrl: string;
    copiedToClipboard: string;
    customTags: string;
    createNote: string;
    sortedByNotification: string;
    syncFailed: string;
    pleaseSelectRepo: string;
    createNoteFailed: string;
    noTags: string;
    noOtherTags: string;
    tagsSaved: string;
    starsExported: string;
    repoListNotInitialized: string;
  };

  // 详情视图
  detailView: {
    title: string;
    description: string;
    topics: string;
    repoInfo: string;
    createdAt: string;
    lastPush: string;
    stars: string;
    forks: string;
    language: string;
    status: string;
    archived: string;
    customTags: string;
    noTags: string;
    editTag: string;
    addTag: string;
    links: string;
    viewOnGithub: string;
    viewOnZread: string;
    viewOnDeepwiki: string;
    copyCloneUrl: string;
    copiedToClipboard: string;
    cancelStar: string;
    restore: string;
    operationFailed: string;
    restoreFailed: string;
    confirmDelete: string;
    deleted: string;
    notesTitle: string;
    noNotes: string;
    createNote: string;
    linkNote: string;
    notesCount: string;
    readme: string;
    openInGithub: string;
    viewSource: string;
    addNote: string;
    editNote: string;
    deleteNote: string;
    noteTitle: string;
    noteContent: string;
    orphanedNote: string;
    confirmDeleteNote: string;
    selectRepo: string;
    noRepoSelected: string;
  };

  // 错误消息
  errors: {
    unknown: string;
  };
}

const translations: Record<Language, Translation> = {
  en,
  zh,
};

export function t(key: string, lang: Language): string {
  const keys = key.split('.');
  let result: any = translations[lang];
  for (const k of keys) {
    result = result?.[k];
    if (!result) return key;
  }
  return result;
}

export function getDefaultLanguage(): Language {
  // 获取浏览器语言
  const navLang = navigator.language;
  if (navLang.startsWith('zh')) return 'zh';
  return 'en';
}