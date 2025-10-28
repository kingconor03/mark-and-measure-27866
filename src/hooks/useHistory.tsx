import { useState, useCallback, useRef, useEffect } from 'react';

export type HistoryAction = 
  | { type: 'ADD_PILE'; pile: any }
  | { type: 'DELETE_PILE'; pile: any }
  | { type: 'UPDATE_PILE'; oldPile: any; newPile: any }
  | { type: 'ADD_FOOTING'; footing: any }
  | { type: 'DELETE_FOOTING'; footing: any }
  | { type: 'UPDATE_FOOTING'; oldFooting: any; newFooting: any }
  | { type: 'DELETE_MULTIPLE_PILES'; piles: any[] }
  | { type: 'DELETE_MULTIPLE_FOOTINGS'; footings: any[] };

export function useHistory() {
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // Use ref to avoid stale closures
  const currentIndexRef = useRef(currentIndex);
  
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const addToHistory = useCallback((action: HistoryAction) => {
    console.log('📝 Adding to history:', action.type, 'Current index before:', currentIndexRef.current);
    
    setHistory(prev => {
      // Remove any "future" actions if we're not at the end
      const newHistory = prev.slice(0, currentIndexRef.current + 1);
      const updatedHistory = [...newHistory, action];
      console.log('📝 History updated - Length:', updatedHistory.length);
      return updatedHistory;
    });
    
    // Update index to point to the newly added item
    setCurrentIndex(prev => {
      const newIndex = prev + 1;
      console.log('📝 Current index updated to:', newIndex);
      return newIndex;
    });
  }, []); // No dependencies - uses ref instead

  const undo = useCallback(() => {
    console.log('⏪ Undo called - CurrentIndex:', currentIndex, 'History length:', history.length);
    if (currentIndex >= 0 && history.length > 0) {
      const action = history[currentIndex];
      console.log('⏪ Undoing action:', action?.type, 'at index', currentIndex);
      setCurrentIndex(prev => prev - 1);
      return action;
    }
    console.log('⏪ Cannot undo - currentIndex:', currentIndex, 'history length:', history.length);
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    console.log('⏩ Redo called - CurrentIndex:', currentIndex, 'History length:', history.length);
    if (currentIndex < history.length - 1) {
      const nextIndex = currentIndex + 1;
      const action = history[nextIndex];
      console.log('⏩ Redoing action:', action?.type, 'at index', nextIndex);
      setCurrentIndex(nextIndex);
      return action;
    }
    console.log('⏩ Cannot redo - currentIndex:', currentIndex, 'history length:', history.length);
    return null;
  }, [currentIndex, history]);

  const canUndo = currentIndex >= 0 && history.length > 0;
  const canRedo = currentIndex < history.length - 1;

  const clearHistory = useCallback(() => {
    console.log('🗑️ Clearing history');
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    addToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
