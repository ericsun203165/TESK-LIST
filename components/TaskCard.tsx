
import React from 'react';
import { Task, Priority, TaskStatus, TASK_CATEGORIES, SYSTEM_OPTIONS } from '../types';

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onUpdate: (id: string, field: keyof Task, value: any) => void;
  onSyncCalendar: (task: Task) => void;
  onSyncSheet: (task: Task) => void;
  onOpenReport: (task: Task) => void;
  onDelete: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onStatusChange,
  onUpdate,
  onSyncCalendar, 
  onSyncSheet,
  onOpenReport,
  onDelete
}) => {
  
  const statusColors: Record<TaskStatus, string> = {
    '未開始': 'bg-slate-100 text-slate-600',
    '進行中': 'bg-blue-100 text-blue-700',
    '等待中': 'bg-yellow-100 text-yellow-700',
    '已完成': 'bg-green-100 text-green-700',
  };

  const getDueStatus = () => {
    if (!task.targetDate || task.status === '已完成') return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(task.targetDate);
    due.setHours(0,0,0,0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (86400000));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays >= 0 && diffDays <= 3) return 'due-soon';
    return null;
  };

  const dueStatus = getDueStatus();

  // Determine card border based on status
  let cardBorderClass = 'border-slate-200 hover:shadow-md';
  if (dueStatus === 'overdue') {
    cardBorderClass = 'border-red-300 ring-1 ring-red-50 shadow-red-50';
  } else if (dueStatus === 'due-soon') {
    cardBorderClass = 'border-amber-200 hover:shadow-md';
  }

  return (
    <div className={`group bg-white rounded-xl p-0 shadow-sm border transition-all duration-200 overflow-hidden ${cardBorderClass} ${task.status === '已完成' ? 'opacity-75' : ''}`}>
      
      {/* Card Header: Meta Info & Delete Button */}
      <div className={`px-4 py-2 border-b flex items-center justify-between text-xs ${dueStatus === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'} text-slate-500`}>
        <div className="flex items-center space-x-2">
          <span className="font-mono font-medium">{task.taskNumber}</span>
          
          {/* Priority Badge */}
          {task.priority === Priority.HIGH && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold border border-red-200">High</span>}
          {task.priority === Priority.MEDIUM && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-bold border border-yellow-200">Med</span>}
          
          {/* Due Status Badges with Icons */}
          {dueStatus === 'overdue' && (
            <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm font-bold animate-pulse">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              已逾期
            </span>
          )}
          {dueStatus === 'due-soon' && (
            <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 font-bold">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
              即將到期
            </span>
          )}
          
          <span className="hidden xs:inline border-l border-slate-300 pl-2 ml-1">{task.assignedDate}</span>
        </div>
        
        {/* Top-Right Delete Button */}
        <div className="flex items-center">
           <button 
             onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} 
             title="刪除任務"
             className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors p-1.5 rounded-full"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
           </button>
        </div>
      </div>

      <div className="p-4">
        {/* System & Category Row */}
        <div className="flex items-center gap-2 mb-3">
          <select
            value={task.system}
            onChange={(e) => onUpdate(task.id, 'system', e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 focus:ring-1 focus:ring-blue-500 outline-none"
          >
             {SYSTEM_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Editable Category Dropdown */}
          <select
            value={task.category}
            onChange={(e) => onUpdate(task.id, 'category', e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded border border-purple-200 bg-purple-50 text-purple-700 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
          >
             {TASK_CATEGORIES.map(cat => (
                 <option key={cat} value={cat}>{cat}</option>
             ))}
          </select>
        </div>

        {/* Main Content */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
            {task.content}
          </h3>
        </div>

        {/* Notes Section (Multi-line) */}
        <div className="mb-4">
             <textarea
                value={task.notes || ''}
                onChange={(e) => onUpdate(task.id, 'notes', e.target.value)}
                placeholder="備註..."
                className="w-full text-xs bg-blue-50 border-0 border-l-2 border-blue-200 rounded-r py-2 px-3 focus:ring-1 focus:ring-blue-500 min-h-[60px] resize-y placeholder-slate-400 text-slate-600"
             />
        </div>

        {/* People & Date Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">交辦人 &rarr; 承辦人</span>
                <span className="font-medium text-slate-700 text-xs">{task.assigner} &rarr; {task.assignee}</span>
            </div>
          <div className="text-right flex flex-col items-end">
             <span className="text-[10px] text-slate-400 mb-0.5">指定完成日</span>
             {/* Editable Date Input */}
             <input 
                type="date"
                value={task.targetDate || ''}
                onChange={(e) => onUpdate(task.id, 'targetDate', e.target.value)}
                className={`text-xs font-medium bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none text-right w-24 p-0 ${
                   dueStatus === 'overdue' ? 'text-red-600 font-bold' : dueStatus === 'due-soon' ? 'text-orange-600 font-bold' : 'text-slate-700'
                }`}
             />
          </div>
          <div className="col-span-2 border-t border-slate-100 mt-2 pt-2 flex justify-between items-center">
             <span className="text-[10px] text-slate-400">實際完成</span>
             <input 
                type="date"
                value={task.actualCompletedDate || ''}
                onChange={(e) => onUpdate(task.id, 'actualCompletedDate', e.target.value)}
                className="text-xs font-medium bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none text-right w-24 p-0 text-green-700"
             />
          </div>
        </div>
        
        {/* Progress Bar Preview */}
        <div className="mb-4">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>進度</span>
                <span>{task.progress || 0}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div 
                    className={`h-1.5 rounded-full ${task.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                    style={{ width: `${task.progress || 0}%` }}
                ></div>
            </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          
          {/* Status Dropdown */}
          <select 
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className={`text-xs font-medium py-1.5 px-3 rounded-md border-0 ring-1 ring-inset focus:ring-2 focus:ring-inset focus:ring-blue-600 w-24 ${statusColors[task.status]}`}
          >
            <option value="未開始">未開始</option>
            <option value="進行中">進行中</option>
            <option value="等待中">等待中</option>
            <option value="已完成">已完成</option>
          </select>

          <div className="flex space-x-1">
             <button
              onClick={() => onOpenReport(task)}
              title="填寫回報"
              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
               </svg>
            </button>

             <button
              onClick={() => onSyncCalendar(task)}
              title="加入行事曆 (若有設定同步網址則自動背景加入，否則開啟網頁)"
              className={`p-1.5 rounded-md transition-colors ${
                task.syncedCalendar
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
            </button>

             <button
              onClick={() => onSyncSheet(task)}
              title="複製/同步到 Google Sheet"
              className={`p-1.5 rounded-md transition-colors ${
                task.syncedSheet
                  ? 'text-green-600 bg-green-50'
                  : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
              }`}
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
