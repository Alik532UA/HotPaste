import { describe, it, expect, beforeEach } from 'vitest';
import { logService, maskText, scrubUrl } from './logService.svelte';
import { debugMode } from './debugMode.svelte';

describe('HotPaste logService and debugMode', () => {
	beforeEach(() => {
		logService.clear();
	});

	it('tracks errorCount and limits entries', () => {
		expect(logService.errorCount).toBe(0);

		logService.info('app', 'test info message');
		expect(logService.errorCount).toBe(0);

		logService.error('app', 'test error message');
		expect(logService.errorCount).toBe(1);
	});

	it('scrubs PII such as email and url credentials', () => {
		const masked = maskText('Contact admin at user@example.com for help');
		expect(masked).not.toContain('user@example.com');
		expect(masked).toContain('***@***.***');

		const scrubbed = scrubUrl('https://example.com/api?token=secret123&safe=1');
		expect(scrubbed).not.toContain('secret123');
		expect(scrubbed).toContain('REDACTED');
		expect(scrubbed).toContain('safe=1');
	});

	it('debugMode toggles state correctly', () => {
		const initial = debugMode.enabled;
		const next = debugMode.toggle();
		expect(next).toBe(!initial);
		expect(debugMode.enabled).toBe(next);
	});
});
