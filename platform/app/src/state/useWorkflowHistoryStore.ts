import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Represents a workflow history item.
 */
export interface WorkflowItem {
  id: string;
  title: string;
  description: string;
  iconName: string;
  timestamp: string;
}

/**
 * State shape for the Workflow History store.
 */
type WorkflowHistoryStore = {
  /**
   * Stores the workflow history items.
   */
  workflowHistory: WorkflowItem[];

  /**
   * Adds a new item to the workflow history.
   *
   * @param item - The workflow item to add.
   */
  addWorkflowItem: (item: Omit<WorkflowItem, 'id' | 'timestamp'>) => void;

  /**
   * Clears all workflow history items.
   */
  clearWorkflowHistory: () => void;
};

/**
 * Creates the Workflow History store.
 *
 * @param set - The zustand set function.
 * @returns The Workflow History store state and actions.
 */
const createWorkflowHistoryStore = (set): WorkflowHistoryStore => ({
  workflowHistory: [],

  /**
   * Adds a new item to the workflow history.
   */
  addWorkflowItem: (item) =>
    set(
      (state) => ({
        workflowHistory: [
          {
            ...item,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleString(),
          },
          ...state.workflowHistory,
        ],
      }),
      false,
      'addWorkflowItem'
    ),

  /**
   * Clears all workflow history items.
   */
  clearWorkflowHistory: () =>
    set({ workflowHistory: [] }, false, 'clearWorkflowHistory'),
});

/**
 * Creates the store with or without devtools middleware based on DEBUG_STORE flag.
 */
const DEBUG_STORE = false;
const useWorkflowHistoryStore = DEBUG_STORE
  ? create<WorkflowHistoryStore>(devtools(createWorkflowHistoryStore))
  : create<WorkflowHistoryStore>(createWorkflowHistoryStore);

export default useWorkflowHistoryStore;