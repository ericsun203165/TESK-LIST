
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { processTaskInput } from './services/geminiService';
import TaskCard from './components/TaskCard';
import TaskReportModal from './components/TaskReportModal';
import SettingsModal from './components/SettingsModal';
import { Task, Priority, ProcessingStatus, ParsedTaskResponse, TaskStatus, TASK_CATEGORIES, SYSTEM_OPTIONS, ReportEntry } from './types';

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/195o6B-ZeKl2Y69LZ73OWqUnnhL0ZitarwFLcg4oNxR8/edit?usp=sharing";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, message: '' });
  const [error, setError] = useState<string | null>(null);

  // Report Modal State
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Google Sheet Link State
  const [googleSheetUrl, setGoogleSheetUrl] = useState(DEFAULT_SHEET_URL);

  // Manual Input States
  const [manualSystem, setManualSystem] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualAssigner, setManualAssigner] = useState('');
  const [manualAssignee, setManualAssignee] = useState('');
  const [manualAssignedDate, setManualAssignedDate] = useState('');
  const [manualTargetDate, setManualTargetDate] = useState('');
  const [manualPriority, setManualPriority] = useState<Priority>(Priority.MEDIUM);

  // Filter & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('default');

  // Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Hidden File Input for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Google Sheet URL from localStorage on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('googleSheetUrl');
    if (savedUrl !== null) {
      setGoogleSheetUrl(savedUrl);
    } else {
      localStorage.setItem('googleSheetUrl', DEFAULT_SHEET_URL);
    }
  }, []);

  // Load Tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
        setTasks(parsed);
      } catch (e) {
        console.error("Failed to parse saved tasks", e);
      }
    }
  }, []);

  // Save Tasks to localStorage on change
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleSheetUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setGoogleSheetUrl(url);
    localStorage.setItem('googleSheetUrl', url);
  };

  const handleClearDatabase = () => {
    if (window.confirm('確定要清空所有任務資料嗎？此動作無法復原！')) {
        setTasks([]);
        setSelectedTaskIds(new Set());
        localStorage.removeItem('tasks');
    }
  };

  const handleExportDatabase = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    link.href = url;
    link.download = `tasks_backup_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          if (window.confirm(`即將匯入 ${parsed.length} 筆任務，這將覆蓋目前的資料。確定嗎？`)) {
            setTasks(parsed);
            alert("資料庫還原成功！");
          }
        } else {
          alert("檔案格式錯誤：內容不是有效的任務列表。");
        }
      } catch (err) {
        console.error(err);
        alert("匯入失敗：檔案損毀或格式不正確。");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getTaskDueStatus = (targetDate?: string, status?: TaskStatus) => {
    if (!targetDate || status === '已完成') return 'normal';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(targetDate);
    due.setHours(0, 0, 0, 0);
    
    // Difference in days
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays >= 0 && diffDays <= 3) return 'due-soon';
    return 'normal';
  };

  // --- Filtering Logic ---
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set(tasks.map(t => t.assignee).filter(Boolean));
    return Array.from(assignees).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // 1. Global Search
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(t => 
            t.content.toLowerCase().includes(query) ||
            t.assignee.toLowerCase().includes(query) ||
            t.system.toLowerCase().includes(query) ||
            t.assigner.toLowerCase().includes(query) ||
            t.taskNumber.toLowerCase().includes(query) ||
            (t.notes && t.notes.toLowerCase().includes(query))
        );
    }

    // 2. Filter by Assignee
    if (filterAssignee !== 'all') {
      result = result.filter(t => t.assignee === filterAssignee);
    }

    // 3. Filter by Status
    if (filterStatus === 'unfinished') {
      result = result.filter(t => t.status !== '已完成');
    } else if (filterStatus === 'finished') {
      result = result.filter(t => t.status === '已完成');
    }

    // 4. Sort
    result = [...result].sort((a, b) => {
      if (sortOrder === 'date_asc') {
        if (!a.targetDate) return 1;
        if (!b.targetDate) return -1;
        return a.targetDate.localeCompare(b.targetDate);
      } else if (sortOrder === 'date_desc') {
        if (!a.targetDate) return 1;
        if (!b.targetDate) return -1;
        return b.targetDate.localeCompare(a.targetDate);
      }
      return b.taskNumber.localeCompare(a.taskNumber);
    });

    return result;
  }, [tasks, searchQuery, filterAssignee, filterStatus, sortOrder]);

  // --- Statistics Logic ---
  const assigneeStats = useMemo(() => {
    const stats: Record<string, { overdue: number; dueSoon: number; total: number }> = {};
    
    tasks.forEach(task => {
        // Only consider unfinished tasks for urgency stats
        if (task.status === '已完成' || !task.assignee) return;

        if (!stats[task.assignee]) {
            stats[task.assignee] = { overdue: 0, dueSoon: 0, total: 0 };
        }

        const dueStatus = getTaskDueStatus(task.targetDate, task.status);
        stats[task.assignee].total += 1;
        
        if (dueStatus === 'overdue') {
            stats[task.assignee].overdue += 1;
        } else if (dueStatus === 'due-soon') {
            stats[task.assignee].dueSoon += 1;
        }
    });

    // Convert to array and sort by urgency (overdue count desc)
    return Object.entries(stats)
        .filter(([, s]) => s.overdue > 0 || s.dueSoon > 0) // Only show if there's something urgent
        .sort(([, a], [, b]) => b.overdue - a.overdue || b.dueSoon - a.dueSoon);
  }, [tasks]);

  const overdueCount = tasks.filter(t => getTaskDueStatus(t.targetDate, t.status) === 'overdue').length;
  const dueSoonCount = tasks.filter(t => getTaskDueStatus(t.targetDate, t.status) === 'due-soon').length;

  // --- Sheet Sync Logic (Hoisted) ---
  const formatTaskForSheet = (task: Task) => {
    // 欄位: 編號, 交辦日期, 系統, 類別, 交辦人, 工作內容, 承辦人, 指定完成, 優先級, 進度%, 狀態, 實際完成
    const cols = [
      task.taskNumber,
      task.assignedDate.replace(/-/g, '/'),
      task.system,
      task.category,
      task.assigner,
      task.content,
      task.assignee,
      task.targetDate ? task.targetDate.replace(/-/g, '/') : '',
      task.priority,
      `${task.progress}%`,
      task.status,
      task.actualCompletedDate ? task.actualCompletedDate.replace(/-/g, '/') : ''
    ];
    return cols.join('\t');
  };

  const handleSyncSheet = async (taskOrTasks: Task | Task[], isSilent = false) => {
    const targets = Array.isArray(taskOrTasks) ? taskOrTasks : [taskOrTasks];
    if (targets.length === 0) return;

    // Data for Cloud Sync (Array)
    const rowsForCloud = targets.map(t => [
      t.taskNumber,
      t.assignedDate.replace(/-/g, '/'),
      t.system,
      t.category,
      t.assigner,
      t.content,
      t.assignee,
      t.targetDate ? t.targetDate.replace(/-/g, '/') : '',
      t.priority,
      `${t.progress}%`,
      t.status,
      t.actualCompletedDate ? t.actualCompletedDate.replace(/-/g, '/') : ''
    ]);

    // Data for Clipboard (Tab separated)
    const textForClipboard = targets.map(formatTaskForSheet).join('\n');

    const scriptUrl = localStorage.getItem('googleAppsScriptUrl');

    if (scriptUrl) {
        if(!scriptUrl.includes('script.google.com')) {
          if (!isSilent) alert('Apps Script 網址格式不正確，請檢查設定。');
          return;
        }

        if (!isSilent) setStatus({ isProcessing: true, message: `正在同步 ${targets.length} 筆資料到 Google Sheet...` });
        
        try {
            const payload = JSON.stringify({ 
                action: 'sheet',
                rows: rowsForCloud
            });

            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ payload }).toString()
            });

            // Mark as synced locally
            const ids = new Set(targets.map(t => t.id));
            setTasks(prev => prev.map(t => ids.has(t.id) ? { ...t, syncedSheet: true } : t));
            
            if (!isSilent) alert(`同步請求已發送！\n請稍後檢查您的 Google Sheet。`);
        } catch (e) {
            console.error(e);
            if (!isSilent) alert("同步請求發送失敗，請檢查網路連線。");
        } finally {
            if (!isSilent) setStatus({ isProcessing: false, message: '' });
        }
    } else {
        if (isSilent) return; // Do nothing if silent and no script configured

        try {
            await navigator.clipboard.writeText(textForClipboard);
            
            const ids = new Set(targets.map(t => t.id));
            setTasks(prev => prev.map(t => ids.has(t.id) ? { ...t, syncedSheet: true } : t));

            if (googleSheetUrl) {
                window.open(googleSheetUrl, '_blank');
            } else {
                alert("已複製到剪貼簿！(請設定 Google Sheet 連結以自動開啟)");
            }
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert('複製失敗');
        }
    }
  };

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    setStatus({ isProcessing: true, message: 'Gemini 正在分析專案內容...' });
    setError(null);

    try {
      const parsedData: ParsedTaskResponse | null = await processTaskInput(inputValue);

      if (parsedData) {
        const finalSystem = manualSystem || parsedData.system || '其他';
        const finalCategory = manualCategory || parsedData.category || '待辦';
        const finalAssigner = manualAssigner || parsedData.assigner || '待確認';
        const finalAssignee = manualAssignee || parsedData.assignee || '待確認';
        const finalAssignedDate = manualAssignedDate || new Date().toISOString().split('T')[0];
        const finalTargetDate = manualTargetDate || parsedData.targetDate || undefined;
        const finalPriority = manualPriority || (parsedData.priority as Priority) || Priority.MEDIUM;

        const newTask: Task = {
          id: crypto.randomUUID(),
          taskNumber: generateTaskNumber(),
          assignedDate: finalAssignedDate,
          system: finalSystem,
          category: finalCategory,
          assigner: finalAssigner,
          assignee: finalAssignee,
          content: parsedData.content,
          targetDate: finalTargetDate,
          status: '未開始',
          priority: finalPriority,
          tags: parsedData.tags || [],
          progress: 0,
          reports: [],
          notes: '',
          syncedCalendar: false,
          syncedSheet: false,
          actualCompletedDate: '',
        };

        setTasks(prev => [newTask, ...prev]);
        setInputValue('');

        // Auto Sync silently
        handleSyncSheet(newTask, true);

      } else {
        setError('無法辨識內容，請嘗試更完整的描述。');
      }
    } catch (err) {
      setError('處理時發生錯誤，請檢查網路連線或 API Key。');
      console.error(err);
    } finally {
      setStatus({ isProcessing: false, message: '' });
    }
  };

  const generateTaskNumber = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = `${mm}${dd}`;
    const dailyCount = tasks.filter(t => t.taskNumber.startsWith(prefix)).length + 1;
    return `${prefix}-${dailyCount}`;
  };

  const handleUpdateTask = (id: string, field: keyof Task, value: any) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      
      let updatedTask = { ...t, [field]: value };
      
      // Logic: Status '已完成' -> Progress 100% & Set Date
      if (field === 'status') {
         if (value === '已完成') {
             updatedTask.progress = 100;
             updatedTask.actualCompletedDate = new Date().toISOString().split('T')[0];
         } else if (t.status === '已完成' && value !== '已完成') {
             updatedTask.actualCompletedDate = '';
         }
      }

      // Logic: Progress 100 -> Status '已完成' & Set Date
      if (field === 'progress') {
         if (value === 100) {
             updatedTask.status = '已完成';
             updatedTask.actualCompletedDate = new Date().toISOString().split('T')[0];
         } else if (value < 100 && t.progress === 100) {
             updatedTask.status = '進行中';
             updatedTask.actualCompletedDate = '';
         }
      }

      // Logic: Manual Date Entry -> Progress 100% & Status '已完成'
      if (field === 'actualCompletedDate') {
          if (value) {
              updatedTask.progress = 100;
              updatedTask.status = '已完成';
          } else {
              // If date is cleared, revert status if it was completed
              if (updatedTask.status === '已完成') {
                  updatedTask.status = '進行中';
              }
          }
      }

      return updatedTask;
    }));
  };

  const handleStatusChange = (id: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      
      const isComplete = newStatus === '已完成';
      return { 
          ...t, 
          status: newStatus, 
          progress: isComplete ? 100 : t.progress,
          actualCompletedDate: isComplete ? new Date().toISOString().split('T')[0] : (t.status === '已完成' ? '' : t.actualCompletedDate)
      };
    }));
  };

  const handleDeleteTask = (id: string) => {
    if (window.confirm('確定要刪除此任務嗎？')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  const handleSyncCalendar = async (task: Task) => {
      const scriptUrl = localStorage.getItem('googleAppsScriptUrl');
      
      if (scriptUrl) {
          if (!task.targetDate) {
              alert("請先設定「指定完成日」才能加入行事曆。");
              return;
          }

          if(!scriptUrl.includes('script.google.com')) {
            alert('Apps Script 網址格式不正確，請檢查設定。');
            return;
          }

          setStatus({ isProcessing: true, message: '正在同步到行事曆...' });
          try {
            const payload = JSON.stringify({ 
                action: 'calendar',
                title: `[${task.system}] ${task.content} - ${task.assignee}`,
                date: task.targetDate,
                description: `編號: ${task.taskNumber}\n系統: ${task.system}\n交辦人: ${task.assigner}\n內容: ${task.content}`
            });

            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                 headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ payload }).toString()
            });
            
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, syncedCalendar: true } : t));
            alert("已發送行事曆建立請求！");
          } catch (e) {
              console.error(e);
              alert("同步行事曆失敗。");
          } finally {
              setStatus({ isProcessing: false, message: '' });
          }
      } 
      else {
        if (!task.targetDate) {
            alert("請先設定「指定完成日」才能加入行事曆。");
            return;
        }

        const title = encodeURIComponent(`[${task.system}] ${task.content} - ${task.assignee}`);
        const details = encodeURIComponent(`編號: ${task.taskNumber}\n系統: ${task.system}\n交辦人: ${task.assigner}\n內容: ${task.content}`);
        const dateStr = task.targetDate.replace(/-/g, '');
        const dates = `${dateStr}/${dateStr}`;

        const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
        
        window.open(calendarUrl, '_blank');
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, syncedCalendar: true } : t));
      }
  };

  const handleExportList = () => {
    const tasksToExport = selectedTaskIds.size > 0 
        ? tasks.filter(t => selectedTaskIds.has(t.id))
        : filteredTasks;
    
    handleSyncSheet(tasksToExport);
  };

  const handleSaveReport = (taskId: string, progress: number, reportContent: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      
      const newReport: ReportEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        reporter: t.assignee, 
        content: reportContent,
        progress: progress,
        timestamp: Date.now()
      };

      const updatedReports = reportContent ? [...t.reports, newReport] : t.reports;
      
      let newStatus = t.status;
      let newActualDate = t.actualCompletedDate;

      if (progress === 100) {
          newStatus = '已完成';
          newActualDate = new Date().toISOString().split('T')[0];
      }
      else if (progress > 0 && newStatus === '未開始') {
          newStatus = '進行中';
          if (t.progress === 100) newActualDate = ''; // Reset if moving back from 100
      } else if (progress < 100 && t.progress === 100) {
           newActualDate = ''; // Reset if moving back from 100
      }

      return {
        ...t,
        progress,
        status: newStatus,
        actualCompletedDate: newActualDate,
        reports: updatedReports
      };
    }));
  };

  // Notification Banner Component
  const NotificationBanner = () => {
    if (overdueCount === 0 && dueSoonCount === 0) return null;

    return (
      <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r shadow-sm flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-orange-700">
            <span className="font-bold">任務提醒</span>
            <br />
            您有 <span className="font-bold text-red-600">{overdueCount} 筆逾期任務</span> 和 <span className="font-bold text-orange-600">{dueSoonCount} 筆即將到期任務</span>，請盡快處理。
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* Hidden File Input for Import */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleImportDatabase}
        accept=".json"
        className="hidden" 
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-blue-200 shadow-md">
              G
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Smart Project Sync
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
             {/* Google Sheet URL Input */}
             <div className="hidden md:flex items-center bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-500 transition-all w-64 lg:w-96">
                <svg className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10zm-1-15h2v6h-2V7zm0 8h2v2h-2v-2z" fillOpacity="0"/><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 16H5V5h14v14zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="#0F9D58"/></svg>
                <input 
                  type="text" 
                  value={googleSheetUrl}
                  onChange={handleSheetUrlChange}
                  placeholder="貼上 Google Sheet 網址..."
                  className="bg-transparent border-none text-xs text-slate-600 w-full focus:ring-0 placeholder-slate-400"
                />
             </div>

             <button 
               onClick={() => setIsSettingsOpen(true)}
               className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
               title="設定"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Section 1: Task Creation */}
        <section className="mb-10">
          <div className="flex items-center mb-4">
             <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mr-2">1</div>
             <h2 className="text-lg font-bold text-slate-800">任務建立</h2>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             
             {/* Manual Input Toolbar - LIGHT BLUE THEME */}
             <div className="bg-blue-100 p-3 border-b border-blue-200 grid grid-cols-2 md:grid-cols-6 lg:grid-cols-7 gap-2">
                 <select 
                    value={manualSystem} 
                    onChange={e => setManualSystem(e.target.value)}
                    className="text-xs bg-white border border-blue-200 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                 >
                    <option value="">自動判斷系統</option>
                    {SYSTEM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>

                 <select 
                    value={manualCategory} 
                    onChange={e => setManualCategory(e.target.value)}
                    className="text-xs bg-white border border-blue-200 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                 >
                    <option value="">自動判斷類別</option>
                    {TASK_CATEGORIES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>

                 <select
                    value={manualPriority}
                    onChange={e => setManualPriority(e.target.value as Priority)}
                     className="text-xs bg-white border border-blue-200 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                 >
                     <option value={Priority.LOW}>Low</option>
                     <option value={Priority.MEDIUM}>Medium</option>
                     <option value={Priority.HIGH}>High</option>
                 </select>

                 <input 
                    type="text" 
                    placeholder="交辦人" 
                    value={manualAssigner}
                    onChange={e => setManualAssigner(e.target.value)}
                    className="text-xs bg-white border border-blue-200 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder-slate-400"
                 />
                 <input 
                    type="text" 
                    placeholder="承辦人" 
                    value={manualAssignee}
                    onChange={e => setManualAssignee(e.target.value)}
                    className="text-xs bg-white border border-blue-200 text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder-slate-400"
                 />
                 
                 <div className="flex items-center bg-white border border-blue-200 rounded px-2 py-1.5">
                     <span className="text-[10px] text-slate-400 mr-1 flex-shrink-0">交辦</span>
                     <input 
                        type="date" 
                        value={manualAssignedDate}
                        onChange={e => setManualAssignedDate(e.target.value)}
                        className="text-xs bg-transparent text-slate-700 focus:outline-none w-full"
                    />
                 </div>

                 <div className="flex items-center bg-white border border-blue-200 rounded px-2 py-1.5">
                     <span className="text-[10px] text-slate-400 mr-1 flex-shrink-0">完成</span>
                     <input 
                        type="date" 
                        value={manualTargetDate}
                        onChange={e => setManualTargetDate(e.target.value)}
                        className="text-xs bg-transparent text-slate-700 focus:outline-none w-full"
                    />
                 </div>
             </div>

             {/* Main Input Area - LIGHT BLUE THEME */}
             <div className="relative">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="請輸入工作事項 (例如：孫經理交辦王小明關於空調的圖面整理，明天完成)..."
                  className="w-full h-32 p-6 text-lg bg-blue-50 text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none resize-none transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                />
                <div className="absolute bottom-4 right-4 flex space-x-2">
                    <button
                        onClick={() => handleAddTask()}
                        disabled={status.isProcessing || !inputValue.trim()}
                        className={`p-3 rounded-xl shadow-lg transition-all transform hover:scale-105 ${
                        status.isProcessing 
                            ? 'bg-slate-200 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                        }`}
                    >
                        {status.isProcessing ? (
                        <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        )}
                    </button>
                </div>
             </div>

             {/* Footer Status - LIGHT BLUE THEME */}
             <div className="bg-blue-50 px-6 py-3 border-t border-blue-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">AI 自動擷取：系統、類別、交辦人、承辦人、日期</span>
                {error && <span className="text-red-500 font-medium bg-red-50 px-2 py-1 rounded">{error}</span>}
                {status.message && !error && <span className="text-blue-600 font-medium animate-pulse">{status.message}</span>}
             </div>
          </div>
        </section>

        {/* Section 2: Task Tracking */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mr-2">2</div>
              <h2 className="text-lg font-bold text-slate-800">任務追蹤</h2>
            </div>
            
            {/* Filter & Action Toolbar */}
            <div className="flex items-center space-x-2">
                {/* Search Bar - Light Blue Theme */}
                <div className="relative group hidden sm:block">
                     <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜尋..."
                        className="pl-9 pr-4 py-1.5 text-sm bg-blue-50 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 w-48 transition-all text-slate-700 placeholder-blue-300"
                     />
                     <svg className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                     </svg>
                </div>

                <select 
                    value={filterAssignee} 
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-100 focus:border-slate-300 shadow-sm"
                >
                    <option value="all">所有承辦人</option>
                    {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-100 focus:border-slate-300 shadow-sm"
                >
                    <option value="all">所有狀態</option>
                    <option value="unfinished">未完成事項</option>
                    <option value="finished">已完成事項</option>
                </select>

                 <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-slate-100 focus:border-slate-300 shadow-sm"
                >
                    <option value="default">預設排序</option>
                    <option value="date_asc">日期 (近->遠)</option>
                    <option value="date_desc">日期 (遠->近)</option>
                </select>

                 <button
                    onClick={handleExportList}
                    className="flex items-center px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm text-sm font-medium transition-colors"
                 >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {selectedTaskIds.size > 0 ? `匯出選取 (${selectedTaskIds.size})` : '匯出列表'}
                 </button>
            </div>
          </div>

          <NotificationBanner />

          {/* Grid Layout: Main Content + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Left Column: Task List (Table/Cards) - Spans 3 columns */}
              <div className="lg:col-span-3 space-y-4">
                
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-400">尚無任務，請在上方建立新任務</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-3 py-3 text-left">
                                           <input 
                                              type="checkbox" 
                                              onChange={handleSelectAll}
                                              checked={selectedTaskIds.size > 0 && selectedTaskIds.size === filteredTasks.length}
                                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                           />
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">編號</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">交辦日期</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">系統</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">類別</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">交辦人</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/3">工作內容</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">承辦人</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">指定完成</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">優先級</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">進度</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">實際完成</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {filteredTasks.map((task) => {
                                        const dueStatus = getTaskDueStatus(task.targetDate, task.status);
                                        return (
                                        <tr key={task.id} className={`hover:bg-slate-50 transition-colors ${selectedTaskIds.has(task.id) ? 'bg-blue-50' : ''}`}>
                                            <td className="px-3 py-4 whitespace-nowrap">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedTaskIds.has(task.id)}
                                                    onChange={() => handleToggleSelect(task.id)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs font-mono text-slate-500">{task.taskNumber}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500">{task.assignedDate}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700">
                                                <select
                                                    value={task.system}
                                                    onChange={(e) => handleUpdateTask(task.id, 'system', e.target.value)}
                                                    className="bg-indigo-50 border-0 text-indigo-700 text-xs rounded focus:ring-1 focus:ring-indigo-500 py-1 pl-2 pr-8 font-medium cursor-pointer"
                                                >
                                                    {SYSTEM_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700">
                                                <select
                                                    value={task.category}
                                                    onChange={(e) => handleUpdateTask(task.id, 'category', e.target.value)}
                                                    className="bg-transparent border-none text-xs focus:ring-0 cursor-pointer text-slate-700 font-medium"
                                                >
                                                    {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700">{task.assigner}</td>
                                            <td className="px-3 py-4 text-xs text-slate-800 max-w-xs group relative">
                                                <div className="truncate cursor-help" title={task.content}>{task.content}</div>
                                                {task.notes && (
                                                    <div className="text-[10px] text-slate-400 mt-1 truncate">{task.notes}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs font-bold text-slate-700">{task.assignee}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs">
                                                <div className="flex items-center">
                                                    {dueStatus === 'overdue' && <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>}
                                                    {dueStatus === 'due-soon' && <span className="w-2 h-2 rounded-full bg-orange-400 mr-2"></span>}
                                                    <input 
                                                        type="date"
                                                        value={task.targetDate || ''}
                                                        onChange={(e) => handleUpdateTask(task.id, 'targetDate', e.target.value)}
                                                        className={`bg-transparent border-none text-xs focus:ring-0 p-0 w-24 ${
                                                            dueStatus === 'overdue' ? 'text-red-600 font-bold' : 
                                                            dueStatus === 'due-soon' ? 'text-orange-600 font-bold' : 'text-slate-500'
                                                        }`}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs">
                                                <select
                                                    value={task.priority}
                                                    onChange={(e) => handleUpdateTask(task.id, 'priority', e.target.value)}
                                                    className={`rounded border-0 text-xs py-1 pl-2 pr-6 ring-1 ring-inset ${
                                                        task.priority === Priority.HIGH ? 'bg-red-50 text-red-700 ring-red-200' :
                                                        task.priority === Priority.MEDIUM ? 'bg-yellow-50 text-yellow-700 ring-yellow-200' :
                                                        'bg-slate-50 text-slate-600 ring-slate-200'
                                                    }`}
                                                >
                                                    <option value={Priority.LOW}>Low</option>
                                                    <option value={Priority.MEDIUM}>Med</option>
                                                    <option value={Priority.HIGH}>High</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs">
                                                <div className="flex items-center">
                                                    <span className="mr-2 text-slate-600">{task.progress}%</span>
                                                    <div className="w-12 bg-slate-100 rounded-full h-1.5">
                                                        <div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${task.progress}%`}}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs">
                                                 <input 
                                                    type="date"
                                                    value={task.actualCompletedDate || ''}
                                                    onChange={(e) => handleUpdateTask(task.id, 'actualCompletedDate', e.target.value)}
                                                    className="bg-transparent border-none text-xs focus:ring-0 p-0 w-24 text-green-600 font-medium"
                                                />
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-xs text-right font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <button 
                                                        onClick={() => setSelectedTaskForReport(task)}
                                                        className="text-indigo-600 hover:text-indigo-900"
                                                        title="回報"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleSyncCalendar(task)}
                                                        title="加入行事曆"
                                                        className="text-blue-500 hover:text-blue-700"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteTask(task.id)}
                                                        className="text-slate-400 hover:text-red-600"
                                                        title="刪除"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile/Grid Card View */}
                        <div className="grid grid-cols-1 md:hidden gap-4">
                            {filteredTasks.map((task) => (
                                <TaskCard 
                                    key={task.id} 
                                    task={task} 
                                    onStatusChange={handleStatusChange}
                                    onUpdate={handleUpdateTask}
                                    onSyncCalendar={handleSyncCalendar}
                                    onSyncSheet={handleSyncSheet}
                                    onOpenReport={setSelectedTaskForReport}
                                    onDelete={handleDeleteTask}
                                />
                            ))}
                        </div>
                    </>
                )}
              </div>

              {/* Right Column: Statistics Sidebar */}
              <div className="lg:col-span-1">
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-24">
                    <div className="flex items-center mb-4 text-slate-800">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="font-bold">承辦人狀態儀表板</h3>
                    </div>

                    {assigneeStats.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">目前沒有急迫任務</p>
                    ) : (
                        <div className="space-y-4">
                            {assigneeStats.map(([name, stats]) => (
                                <div key={name} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-slate-700 text-sm">{name}</span>
                                        <span className="text-xs text-slate-400">共 {stats.total} 件</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {stats.overdue > 0 && (
                                            <div className="flex-1 bg-red-50 rounded px-2 py-1 flex items-center justify-between text-xs text-red-700 border border-red-100">
                                                <span>逾期</span>
                                                <span className="font-bold">{stats.overdue}</span>
                                            </div>
                                        )}
                                        {stats.dueSoon > 0 && (
                                            <div className="flex-1 bg-orange-50 rounded px-2 py-1 flex items-center justify-between text-xs text-orange-700 border border-orange-100">
                                                <span>即將</span>
                                                <span className="font-bold">{stats.dueSoon}</span>
                                            </div>
                                        )}
                                        {stats.overdue === 0 && stats.dueSoon === 0 && (
                                             <div className="flex-1 bg-green-50 rounded px-2 py-1 text-center text-xs text-green-700">
                                                 進度良好
                                             </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
                 
                 <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg overflow-hidden relative group cursor-pointer" onClick={() => setIsSettingsOpen(true)}>
                     <div className="relative z-10">
                        <div className="text-xs font-medium opacity-80 mb-1">資料庫統計</div>
                        <div className="text-2xl font-bold">{tasks.length} <span className="text-sm font-normal">筆任務</span></div>
                        <div className="text-[10px] mt-2 opacity-60">點擊管理資料庫或備份</div>
                     </div>
                     <div className="absolute right-0 top-0 h-full w-16 bg-white opacity-10 transform skew-x-12 translate-x-4"></div>
                 </div>
              </div>

          </div>
        </section>

      </main>
      
      {/* Modals */}
      {selectedTaskForReport && (
        <TaskReportModal 
          task={selectedTaskForReport}
          isOpen={!!selectedTaskForReport}
          onClose={() => setSelectedTaskForReport(null)}
          onSave={handleSaveReport}
        />
      )}

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onExportDB={handleExportDatabase}
        onImportDB={() => fileInputRef.current?.click()}
      />

    </div>
  );
}
