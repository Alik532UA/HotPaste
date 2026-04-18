import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from './storage';

const PREFIX = 'hotpaste_';

describe('StorageService', () => {
    let mockStorage: Record<string, string>;

    beforeEach(() => {
        mockStorage = {};
        
        const localStorageMock = {
            getItem: vi.fn((key: string) => mockStorage[key] || null),
            setItem: vi.fn((key: string, value: string) => {
                mockStorage[key] = value;
            }),
            removeItem: vi.fn((key: string) => {
                delete mockStorage[key];
            }),
            clear: vi.fn(() => {
                for (let key in mockStorage) {
                    delete mockStorage[key];
                }
            }),
            key: vi.fn((index: number) => Object.keys(mockStorage)[index] || null),
            get length() {
                return Object.keys(mockStorage).length;
            }
        };
        
        vi.stubGlobal('localStorage', localStorageMock);
    });

    it('should set and get a value with prefix', () => {
        storage.set('test_key', 'test_value');
        expect(localStorage.setItem).toHaveBeenCalledWith(PREFIX + 'test_key', 'test_value');
        
        const value = storage.get('test_key');
        expect(localStorage.getItem).toHaveBeenCalledWith(PREFIX + 'test_key');
        expect(value).toBe('test_value');
    });

    it('should remove a value with prefix', () => {
        storage.set('test_key', 'test_value');
        storage.remove('test_key');
        expect(localStorage.removeItem).toHaveBeenCalledWith(PREFIX + 'test_key');
        expect(storage.get('test_key')).toBeNull();
    });

    it('should clear only keys with prefix', () => {
        // Arrange
        localStorage.setItem('other_key', 'other_value'); // without prefix
        storage.set('test_key1', 'test_value1');          // with prefix
        storage.set('test_key2', 'test_value2');          // with prefix

        // Act
        storage.clear();

        // Assert
        expect(localStorage.getItem('other_key')).toBe('other_value'); // should survive
        expect(storage.get('test_key1')).toBeNull();                   // should be deleted
        expect(storage.get('test_key2')).toBeNull();                   // should be deleted
    });

    it('should handle JSON correctly', () => {
        const obj = { a: 1, b: 'two' };
        storage.setJSON('test_json', obj);
        
        const parsed = storage.getJSON<{ a: number, b: string }>('test_json');
        expect(parsed).toEqual(obj);
    });

    it('should return null for invalid JSON', () => {
        storage.set('bad_json', '{ bad format');
        const parsed = storage.getJSON('bad_json');
        expect(parsed).toBeNull();
    });
});
