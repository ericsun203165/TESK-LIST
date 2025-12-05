
export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export type TaskStatus = '未開始' | '進行中' | '等待中' | '已完成';

export const TASK_CATEGORIES = ['圖面', '報告', '計畫', '現場', '會議', '行政', '待辦', '其它'];

export const SYSTEM_OPTIONS = ['空調', '電氣', '消防', '給排水', '弱電', '裝修', '土建', '其它'];

export interface ReportEntry {
  id: string;
  date: string;
  reporter: string; // 填寫人
  content: string; // 回報內容
  progress: number; // 當下進度
  timestamp: number;
}

export interface Task {
  id: string;
  taskNumber: string; // e.g. 0529-1
  assignedDate: string; // 交辦日期
  system: string; // 系統 (空調, 電氣...)
  category: string; // 類別 (圖面, 報告...)
  assigner: string; // 交辦人
  assignee: string; // 承辦人
  content: string; // 工作內容
  targetDate?: string; // 指定完成
  actualCompletedDate?: string; // 實際完成日 (New Field)
  status: TaskStatus; // 目前狀況
  priority: Priority;
  tags: string[];
  
  // Progress & Reports
  progress: number; // 實際完成 % (0-100)
  reports: ReportEntry[];

  // Notes
  notes?: string;

  // Sync states
  syncedCalendar: boolean;
  syncedSheet: boolean;
}

export interface ParsedTaskResponse {
  system: string;
  category: string;
  assigner: string;
  assignee: string;
  content: string;
  targetDate: string | null;
  priority: string;
  tags: string[];
  shouldSyncCalendar: boolean;
  shouldSyncSheet: boolean;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  message: string;
}
