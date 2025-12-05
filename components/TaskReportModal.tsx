import React, { useState } from 'react';
import { Task, ReportEntry } from '../types';

interface TaskReportModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, progress: number, reportContent: string) => void;
}

const TaskReportModal: React.FC<TaskReportModalProps> = ({ task, isOpen, onClose, onSave }) => {
  const [progress, setProgress] = useState(task.progress || 0);
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!content.trim() && progress === task.progress) {
        onClose();
        return;
    }
    onSave(task.id, progress, content);
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <div className="text-xs font-mono text-slate-400 mb-1">{task.taskNumber}</div>
            <h3 className="text-lg font-bold text-slate-800">任務回報</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Task Summary */}
          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm text-slate-700">
            <div className="font-semibold text-blue-800 mb-1">{task.content}</div>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>承辦: {task.assignee}</span>
              <span>期限: {task.targetDate || '未定'}</span>
            </div>
          </div>

          {/* Progress Slider */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
              <span>目前進度</span>
              <span className={`font-bold ${progress === 100 ? 'text-green-600' : 'text-blue-600'}`}>{progress}%</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5"
              value={progress} 
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Report Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">執行說明 / 異常回報</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="請填寫今日執行狀況、遇到的困難或預計完成時間..."
              className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder-slate-400"
            />
          </div>

          {/* History Timeline */}
          {task.reports && task.reports.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">回報紀錄</h4>
              <div className="space-y-4">
                {task.reports.slice().reverse().map((report) => (
                  <div key={report.id} className="relative pl-4 border-l-2 border-slate-200 pb-1 last:pb-0">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                    <div className="flex justify-between items-start text-xs mb-1">
                      <span className="font-semibold text-slate-700">{report.date}</span>
                      <span className="text-slate-400">{report.progress}%</span>
                    </div>
                    <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">{report.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            儲存回報
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskReportModal;