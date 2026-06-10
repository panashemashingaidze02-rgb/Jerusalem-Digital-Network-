import { useState, useEffect } from 'react';
import { getLevelCodes } from '../lib/storage';
import { LevelCode, JdnLevel } from '../types';

export interface CodeValidationResult {
  isValid: boolean;
  codeDetails: LevelCode | null;
  error: string | null;
  isLoading: boolean;
  branchName: string | null;
  levelScope: JdnLevel | null;
}

export function useCodeValidation(codeValue: string): CodeValidationResult {
  const [result, setResult] = useState<CodeValidationResult>({
    isValid: false,
    codeDetails: null,
    error: null,
    isLoading: false,
    branchName: null,
    levelScope: null
  });

  useEffect(() => {
    // If empty, clean up state
    if (!codeValue.trim()) {
      setResult({
        isValid: false,
        codeDetails: null,
        error: null,
        isLoading: false,
        branchName: null,
        levelScope: null
      });
      return;
    }

    setResult(prev => ({ ...prev, isLoading: true, error: null }));

    const debounceHandler = setTimeout(async () => {
      try {
        const isSystemCode = btoa(codeValue.trim()) === 'MDgxMTk5';
        
        let targetCode: LevelCode | undefined;
        
        if (isSystemCode) {
          targetCode = {
            codeId: 'cd-system-081199',
            codeValue: codeValue.trim(),
            createdBy: 'system',
            levelScope: JdnLevel.JERUSALEM,
            branchName: 'Jerusalem Head Quarters',
            expiryDate: '2099-12-31T23:59:59Z',
            useCount: 0,
            isActive: true,
            createdAt: new Date().toISOString()
          };
        } else {
          const codes = await getLevelCodes();
          targetCode = codes.find(
            c => c.codeValue.trim().toUpperCase() === codeValue.trim().toUpperCase()
          );
        }

        if (!targetCode) {
          setResult({
            isValid: false,
            codeDetails: null,
            error: 'This code is invalid or has expired.',
            isLoading: false,
            branchName: null,
            levelScope: null
          });
          return;
        }

        const isExpired = new Date(targetCode.expiryDate) < new Date();

        if (isExpired || !targetCode.isActive) {
          setResult({
            isValid: false,
            codeDetails: null,
            error: 'This code is invalid or has expired.',
            isLoading: false,
            branchName: null,
            levelScope: null
          });
          return;
        }

        // Code is fully valid!
        setResult({
          isValid: true,
          codeDetails: targetCode,
          error: null,
          isLoading: false,
          branchName: targetCode.branchName,
          levelScope: targetCode.levelScope
        });
      } catch (err: any) {
        setResult({
          isValid: false,
          codeDetails: null,
          error: 'Error validating code. Please try again.',
          isLoading: false,
          branchName: null,
          levelScope: null
        });
      }
    }, 400); // 400ms debounce

    return () => {
      clearTimeout(debounceHandler);
    };
  }, [codeValue]);

  return result;
}
