import { describe, expect, it } from 'vitest';
import { CHECK_EVERY_MS, MIN_GAP_MS, createUpdateSchedule } from './lib/services/updateCheck';

/**
 * РОЗКЛАД ПЕРЕВІРКИ ОНОВЛЕНЬ.
 *
 * ## Чому перевірка з'явилася лише тепер
 *
 * Логіка працювала правильно, але жила в замиканні всередині
 * `onRegisteredSW` у `ReloadPrompt.svelte` — дістатися до неї можна було
 * тільки змонтувавши компонент, зареєструвавши справжній service worker і
 * посунувши час. Тобто вона не перевірялася ніяк.
 *
 * Ціна цього не гіпотетична. Правило «повернення до вікна піднімає ДВІ події,
 * тож між запитами потрібен спільний проміжок» неочевидне рівно настільки, щоб
 * його спростили при наступній правці. А ламається воно ТИХО: пропозиція
 * оновитися просто перестає з'являтися, і дізнатися про це можна лише через
 * тижні, коли хтось помітить стару версію.
 *
 * ## Чому час і мережа приходять ззовні
 *
 * Щоб перевіряти РІШЕННЯ, а не годинник. Модуль не знає ні про `Date.now()`,
 * ні про `navigator.onLine`, ні про `registration` — усе це `UpdateHost`.
 */

function host(start = 0) {
	const calls: number[] = [];
	let now = start;
	let online = true;
	return {
		calls,
		set(at: number) {
			now = at;
		},
		offline() {
			online = false;
		},
		back() {
			online = true;
		},
		api: {
			now: () => now,
			online: () => online,
			update: () => void calls.push(now)
		}
	};
}

describe('розклад перевірки оновлень', () => {
	it('перший тік завжди йде', () => {
		const h = host(1_000);
		const schedule = createUpdateSchedule(h.api);

		expect(schedule.tick()).toBe(true);
		expect(h.calls).toEqual([1_000]);
	});

	it('повернення до вікна не дає двох запитів поспіль', () => {
		/*
		 * САМЕ ЦЕЙ ВИПАДОК І Є ПРИЧИНОЮ МОДУЛЯ. Одне переключення вікна
		 * піднімає `visibilitychange` І `focus`; обидва слухачі кличуть той
		 * самий `tick`, і без спільного проміжку сервер отримує два однакові
		 * запити з різницею в мілісекунди.
		 */
		const h = host(0);
		const schedule = createUpdateSchedule(h.api);

		expect(schedule.tick()).toBe(true);
		h.set(5);
		expect(schedule.tick(), 'другий запит пішов через 5 мс').toBe(false);
		expect(h.calls).toHaveLength(1);
	});

	it('після проміжку питає знову', () => {
		const h = host(0);
		const schedule = createUpdateSchedule(h.api);

		schedule.tick();
		h.set(MIN_GAP_MS + 1);
		expect(schedule.tick()).toBe(true);
		expect(h.calls).toEqual([0, MIN_GAP_MS + 1]);
	});

	it('офлайн не питає взагалі', () => {
		// Відповіді не буде, а невдалий запит ще й засвітився б у журналі як
		// помилка мережі — тобто шум там, де нічого не сталося.
		const h = host(0);
		h.offline();
		const schedule = createUpdateSchedule(h.api);

		expect(schedule.tick()).toBe(false);
		expect(h.calls).toEqual([]);
	});

	it('офлайн не з’їдає проміжок', () => {
		/*
		 * Тонкість, яку легко зламати спрощенням: невдалий через офлайн тік НЕ
		 * мусить оновлювати позначку часу. Інакше мережа, що зникла й одразу
		 * повернулася, відкладала б справжню перевірку ще на хвилину — і так
		 * по колу в поганому звʼязку.
		 */
		const h = host(0);
		h.offline();
		const schedule = createUpdateSchedule(h.api);

		schedule.tick();
		h.back();
		expect(schedule.tick(), 'перший справжній запит відкладено дарма').toBe(true);
		expect(h.calls).toEqual([0]);
	});

	it('проміжок менший за період опитування', () => {
		// Інакше таймер бив би частіше, ніж дозволяє проміжок, і кожен другий
		// тік мовчки пропадав — тобто період у коді не означав би нічого.
		expect(MIN_GAP_MS).toBeLessThan(CHECK_EVERY_MS);
	});
});
