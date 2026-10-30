"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "kosh_bharatcode_token";

export function useLocalStorageToken() {
  const [token, setTokenState] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTokenState(stored);
      }
    } catch (e) {
      console.warn("Could not read BharatCode token from localStorage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveToken = (newToken: string) => {
    setTokenState(newToken);
    try {
      if (newToken.trim()) {
        localStorage.setItem(STORAGE_KEY, newToken.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error("Could not write token to localStorage", e);
    }
  };

  const clearToken = () => {
    setTokenState("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Could not remove token from localStorage", e);
    }
  };

  return { token, saveToken, clearToken, isLoaded };
}
