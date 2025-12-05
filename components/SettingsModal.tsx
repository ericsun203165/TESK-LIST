
import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportDB?: () => void;
  onImportDB?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onExportDB, onImportDB }) => {
  const [scriptUrl, setScriptUrl] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('googleAppsScriptUrl');
    const savedCalId = localStorage.getItem('googleCalendarId');
    if (savedUrl) setScriptUrl(savedUrl);
    if (savedCalId) setCalendarId(savedCalId);
  }, []);

  const handleSave = () => {
    localStorage.setItem('googleAppsScriptUrl', scriptUrl.trim());
    localStorage.setItem('googleCalendarId', calendarId.trim());
    onClose();
  };

  const handleCopyCode = () => {
    const code = `/**
 * Google Apps Script for Smart Project Sync
 * v3.0: Permission Fix Edition
 *
 * ⚠️ IMPORTANT / 重要:
 * After pasting this code, you MUST run the function 'testAuth' manually once
 * in the editor to grant Calendar permissions!
 * 貼上代碼後，請務必手動執行一次 'testAuth' 函數以開通權限！
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    // 1. Parse Data (Support x-www-form-urlencoded for stability)
    var data;
    if (e.parameter && e.parameter.payload) {
      data = JSON.parse(e.parameter.payload);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return ContentService.createTextOutput("Error: No data found");
    }

    var action = data.action;

    // --- ACTION: SHEET UPDATE (Generic) ---
    if (action === 'sheet') {
       return handleSheetUpdate(data.rows);
    }

    // --- ACTION: CALENDAR (Generic) ---
    else if (action === 'calendar') {
       return handleCalendarCreate(data);
    }

    // --- ACTION: SMART SYNC (Sheet + Calendar in one Go) ---
    else if (action === 'add_task_smart') {
       var sheetResult = handleSheetUpdate([data.sheetRow]);
       var calResult = "Skipped";
       
       if (data.calendarData) {
         calResult = handleCalendarCreate(data.calendarData);
       }
       
       return ContentService.createTextOutput("Smart Sync: " + sheetResult.getContent() + " | Calendar: " + calResult.getContent());
    }

    return ContentService.createTextOutput("Unknown Action");

  } catch (err) {
    // Write error to sheet if possible so user sees it
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName("專案任務");
      if(sheet) sheet.appendRow(["ERROR LOG", new Date(), err.toString()]);
    } catch(e) {}
    
    return ContentService.createTextOutput("Error: " + err.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * ⚠️ 關鍵函數：請手動執行此函數一次以授權權限 ⚠️
 * ⚠️ RUN THIS FUNCTION MANUALLY ONCE TO AUTHORIZE PERMISSIONS ⚠️
 */
function testAuth() {
  console.log("Requesting permissions...");
  // This lines force Google to ask for Calendar & Sheet permissions
  CalendarApp.getDefaultCalendar();
  SpreadsheetApp.getActiveSpreadsheet();
  console.log("Permissions granted! You can now Deploy.");
}

// --- HELPER FUNCTIONS ---

function handleSheetUpdate(rowsToSync) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("專案任務");
  if (!sheet) {
    sheet = ss.insertSheet("專案任務");
    sheet.appendRow(["編號", "交辦日期", "系統", "類別", "交辦人", "工作內容", "承辦人", "指定完成", "優先級", "進度", "狀態", "實際完成日"]);
  }

  if (!rowsToSync || rowsToSync.length === 0) {
    return ContentService.createTextOutput("No rows to sync");
  }

  var lastRow = sheet.getLastRow();
  var idMap = new Map();

  if (lastRow > 1) {
    // getDisplayValues reads what user sees (avoiding date object or number issues)
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      var rawId = values[i][0];
      // Regex remove all spaces to ensure "1205-1 " equals "1205-1"
      var cleanId = rawId.toString().replace(/\\s/g, "");
      if (cleanId && !idMap.has(cleanId)) {
         idMap.set(cleanId, i + 2); // Store row number (1-based)
      }
    }
  }

  rowsToSync.forEach(function(row) {
    var rawInputId = row[0];
    var cleanInputId = rawInputId.toString().replace(/\\s/g, "");

    if (idMap.has(cleanInputId)) {
      var rowIndex = idMap.get(cleanInputId);
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      idMap.set(cleanInputId, sheet.getLastRow()); 
    }
  });

  return ContentService.createTextOutput("Synced " + rowsToSync.length + " rows");
}

function handleCalendarCreate(data) {
    var rawTitle = data.title;
    var dateStr = data.date; // YYYY-MM-DD
    var description = data.description;
    var calId = data.calendarId ? data.calendarId.trim() : "";
    
    if (!rawTitle || !dateStr) return ContentService.createTextOutput("Missing Title or Date");

    var title = "[專案任務] " + rawTitle;
    var cal;
    var logMsg = "";

    // 1. Try Specific Calendar ID if provided
    if (calId) {
        try {
            cal = CalendarApp.getCalendarById(calId);
            if (!cal) {
                logMsg += "Specific Cal ID not found/accessible. ";
                throw new Error("Calendar not found");
            }
        } catch(e) {
            // 2. Fallback to Default
            cal = CalendarApp.getDefaultCalendar();
            title += " (Backup)";
            logMsg += "Fallback to Default (" + e.toString() + "). ";
        }
    } else {
        cal = CalendarApp.getDefaultCalendar();
    }

    if (cal) {
        // Fix Timezone: Parse YYYY-MM-DD manually
        var parts = dateStr.split('-');
        var dateObj = new Date(parts[0], parts[1] - 1, parts[2]);

        cal.createAllDayEvent(title, dateObj, { description: description });
        
        return ContentService.createTextOutput("Success: " + title + ". " + logMsg);
    } else {
        return ContentService.createTextOutput("Error: No Calendar available.");
    }
}`;
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleClear = () => {
      if (window.confirm("警告：這將清除瀏覽器中的所有任務資料！確定嗎？")) {
          localStorage.removeItem('tasks');
          window.location.reload();
      }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">系統設定</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Section: Local DB Management */}
          <div className="space-y-4 border-b border-slate-100 pb-6">
            <h4 className="font-medium text-slate-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                本機資料庫管理
            </h4>
            <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 space-y-3">
                <p>您的資料預設儲存在此瀏覽器中。您可以備份成檔案，以便在其他電腦還原。</p>
                <div className="flex space-x-3">
                    <button onClick={onExportDB} className="flex items-center px-3 py-2 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 transition-colors">
                        <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        備份資料庫 (.json)
                    </button>
                    <button onClick={onImportDB} className="flex items-center px-3 py-2 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 transition-colors">
                        <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        還原資料庫
                    </button>
                    <button onClick={handleClear} className="flex items-center px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded shadow-sm hover:bg-red-100 transition-colors ml-auto">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        清空所有資料
                    </button>
                </div>
            </div>
          </div>

          {/* Section: Cloud Sync */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                Google 雲端同步 (進階)
            </h4>
            
            <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-700">步驟 1: 更新並部署 Google Apps Script</h4>
                <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-2 text-xs text-red-700">
                    <strong>⚠️ 權限修復 (v3.0)：</strong> 為了啟用行事曆，貼上代碼後，您必須在編輯器上方選單選擇 <code>testAuth</code> 函數並按 <strong>「執行 (Run)」</strong>，才能觸發 Google 的授權視窗！
                </div>
                <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2 ml-2">
                <li>開啟您的 Google Sheet，點選上方選單 <strong>擴充功能 &gt; Apps Script</strong>。</li>
                <li>
                    複製下方 <strong>新版 v3.0</strong> 程式碼並覆蓋編輯器內容：
                    <button 
                    onClick={handleCopyCode}
                    className="ml-2 px-2 py-0.5 text-xs bg-slate-200 hover:bg-slate-300 rounded text-slate-700 transition-colors"
                    >
                    {isCopied ? '已複製！' : '複製新版程式碼 (v3.0)'}
                    </button>
                </li>
                <li><strong>手動執行：</strong> 在編輯器上方下拉選單選 <code>testAuth</code>，按執行，並允許權限。</li>
                <li>點選 <strong>部署 &gt; 管理部署作業</strong>。</li>
                <li>點擊上方 <strong>筆(編輯)</strong> 圖示，版本選擇 <strong>「建立新版本」</strong>。</li>
                <li>點選部署。</li>
                </ol>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">步驟 2: 貼上網頁應用程式網址</label>
                <input 
                type="text" 
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
                />

                <label className="block text-sm font-medium text-slate-700 mb-2">步驟 3: Google 行事曆 ID (選填)</label>
                <input 
                type="text" 
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="例如: xxxx@group.calendar.google.com"
                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">若留空或權限不足，系統將自動寫入您的預設行事曆並標註 (Backup)。</p>
            </div>
          </div>

        </div>

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg">
            取消
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">
            儲存設定
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
