import { useState, useMemo } from 'react';

export function useSearch<T>(data: T[], searchKeys: (keyof T)[]) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) {
      return data;
    }

    const lowerCaseTerm = searchTerm.toLowerCase().trim();

    return data.filter((item) => {
      return searchKeys.some((key) => {
        const value = item[key];
        if (value === null || value === undefined) {
          return false;
        }
        return String(value).toLowerCase().includes(lowerCaseTerm);
      });
    });
  }, [data, searchTerm, searchKeys]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
  };
}
