import { useState, useCallback } from 'react';

export function useOptimistic<T>(initialData: T[]) {
  const [data, setData] = useState<T[]>(initialData);
  const [optimisticData, setOptimisticData] = useState<T[]>([]);

  const addOptimistic = useCallback((item: T) => {
    setOptimisticData(prev => [...prev, item]);
  }, []);

  const removeOptimistic = useCallback((predicate: (item: T) => boolean) => {
    setOptimisticData(prev => prev.filter(item => !predicate(item)));
  }, []);

  const commitOptimistic = useCallback(() => {
    setData(prev => [...prev, ...optimisticData]);
    setOptimisticData([]);
  }, [optimisticData]);

  const rollbackOptimistic = useCallback(() => {
    setOptimisticData([]);
  }, []);

  const updateData = useCallback((newData: T[]) => {
    setData(newData);
  }, []);

  return {
    data: [...data, ...optimisticData],
    actualData: data,
    optimisticData,
    addOptimistic,
    removeOptimistic,
    commitOptimistic,
    rollbackOptimistic,
    updateData
  };
}
