import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createKeySequence, isEditableTarget } from './keySequence';

describe('HotPaste keySequence (DEBUGGING-v10 § 3)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('triggers callback when threshold is reached', () => {
		const onComplete = vi.fn();
		const seq = createKeySequence({
			code: 'KeyV',
			threshold: 5,
			onComplete
		});

		for (let i = 0; i < 4; i++) {
			seq.handle({ code: 'KeyV' } as KeyboardEvent);
			expect(onComplete).not.toHaveBeenCalled();
		}

		seq.handle({ code: 'KeyV' } as KeyboardEvent);
		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(seq.count).toBe(0);
	});

	it('1. ignores event.repeat', () => {
		const onComplete = vi.fn();
		const seq = createKeySequence({
			code: 'KeyV',
			threshold: 5,
			onComplete
		});

		seq.handle({ code: 'KeyV', repeat: true } as KeyboardEvent);
		expect(seq.count).toBe(0);
	});

	it('2. ignores editable targets without resetting count', () => {
		const onComplete = vi.fn();
		const seq = createKeySequence({
			code: 'KeyV',
			threshold: 5,
			onComplete
		});

		seq.handle({ code: 'KeyV' } as KeyboardEvent);
		expect(seq.count).toBe(1);

		const fakeInput = {
			closest: (selector: string) => (selector.includes('input') ? {} : null)
		};
		seq.handle({ code: 'KeyV', target: fakeInput } as any);
		expect(seq.count).toBe(1); // not incremented, but not reset!
	});

	it('3. resets count after window timeout', () => {
		const onComplete = vi.fn();
		const seq = createKeySequence({
			code: 'KeyV',
			threshold: 5,
			windowMs: 2000,
			onComplete
		});

		seq.handle({ code: 'KeyV' } as KeyboardEvent);
		expect(seq.count).toBe(1);

		vi.advanceTimersByTime(2500);
		expect(seq.count).toBe(0);
	});

	it('4. resets count on other key', () => {
		const onComplete = vi.fn();
		const seq = createKeySequence({
			code: 'KeyV',
			threshold: 5,
			onComplete
		});

		seq.handle({ code: 'KeyV' } as KeyboardEvent);
		expect(seq.count).toBe(1);

		seq.handle({ code: 'KeyA' } as KeyboardEvent);
		expect(seq.count).toBe(0);
	});
});
