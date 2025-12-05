import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ParsedTaskResponse } from "../types";

const parseTaskTool: FunctionDeclaration = {
  name: "extract_project_task_details",
  description: "Extracts structured project management details from natural language input. Identifies system type, work category, people involved (assigner/assignee), and deadlines.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: "The core description of the work content (工作內容)."
      },
      system: {
        type: Type.STRING,
        description: "The system involved, e.g., '空調' (AC), '電氣' (Electrical), '消防' (Fire), '弱電', '裝修'. Defaults to '一般' if not specified."
      },
      category: {
        type: Type.STRING,
        description: "The type of work, e.g., '圖面' (Drawing), '報告' (Report), '計畫' (Plan), '現場' (Site), '會議' (Meeting). Defaults to '待辦' if not specified."
      },
      assigner: {
        type: Type.STRING,
        description: "The person assigning the task (交辦人). If 'I' or 'me' is implied, use '我' or leave empty."
      },
      assignee: {
        type: Type.STRING,
        description: "The person responsible for the task (承辦人). If not specified, assume it is for the user."
      },
      targetDate: {
        type: Type.STRING,
        description: "The due date in YYYY-MM-DD format (指定完成日)."
      },
      priority: {
        type: Type.STRING,
        enum: ["Low", "Medium", "High"],
        description: "The priority level inferred from context."
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Additional keywords."
      },
      shouldSyncCalendar: {
        type: Type.BOOLEAN,
        description: "True if a specific date is mentioned."
      },
      shouldSyncSheet: {
        type: Type.BOOLEAN,
        description: "Always true for this project tracker as we want to log everything."
      }
    },
    required: ["content", "system", "category", "priority"]
  }
};

export const processTaskInput = async (input: string): Promise<ParsedTaskResponse | null> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const today = new Date().toISOString().split('T')[0];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Current Date: ${today}. Parse this construction/project management log entry: "${input}"
      
      Examples:
      Input: "孫家治交辦廖文凡關於空調系統的圖面整理上線，明天要好"
      Output: { system: "空調", category: "圖面", assigner: "孫家治", assignee: "廖文凡", content: "圖面整理上線", targetDate: "YYYY-MM-DD" (tomorrow) }
      
      Input: "電氣室CCTV ECN表單提送"
      Output: { system: "電氣", category: "報告", content: "CCTV ECN表單提送" }
      `,
      config: {
        tools: [{ functionDeclarations: [parseTaskTool] }],
        systemInstruction: "You are a project management secretary. Extract specific fields for a construction log sheet. Infer System and Category from context if possible (e.g., CCTV -> 弱電/電氣, Drawing -> 圖面).",
        temperature: 0.1,
      },
    });

    const call = response.functionCalls?.[0];
    
    if (call && call.name === "extract_project_task_details") {
      const args = call.args as unknown as ParsedTaskResponse;
      return args;
    }

    return null;
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw error;
  }
};