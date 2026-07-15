import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export function useLocalStorageState<T>(key: string, defaultValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  // 1. On initialise le state en lisant le localStorage (si une valeur existe)
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        return JSON.parse(storedValue) as T;
      }
    } catch (error) {
      console.error(`Erreur lors de la lecture de la clé "${key}" depuis le localStorage:`, error);
    }
    // Si rien n'est trouvé, on utilise la valeur par défaut
    return defaultValue instanceof Function ? defaultValue() : defaultValue;
  });

  // 2. On sauvegarde dans le localStorage à chaque fois que la valeur change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Erreur lors de l'écriture de la clé "${key}" dans le localStorage:`, error);
    }
  }, [key, state]);

  return [state, setState];
}