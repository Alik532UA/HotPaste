import { storage } from '../services/storage';
import { ALL_CHECKS, BETA_TABS, type BetaTab } from './checks';

/**
 * Відповіді тестувальника: чотири стани, версія в кожній позначці.
 *
 * ЧОМУ ВЕРСІЯ (§ 3.1, `BETA-VERSION-STAMP`). Без неї галочка «працює»,
 * поставлена сорок комітів тому, виглядає точно так само, як сьогоднішня, і
 * список поступово стає звітом про минуле, який читають як звіт про теперішнє.
 * Позначка з іншої збірки не зникає — вона все ще щось означає, — але
 * підписується й не рахується в «зроблено на цій».
 */

export type Vote = 'fail' | 'weird' | 'ok';

export interface Mark {
	vote: Vote;
	version: string;
}

export type Marks = Record<string, Mark>;

/** Версія з ЄДИНОГО джерела проєкту (§ 8.5): те саме, що читає вікно оновлення. */
export const VERSION: string = __APP_VERSION__;

const STORAGE_KEY = 'beta_marks';

const VOTES: readonly string[] = ['fail', 'weird', 'ok'];

const isMark = (value: unknown): value is Mark => {
	if (typeof value !== 'object' || value === null) return false;
	const mark = value as Record<string, unknown>;
	return VOTES.includes(mark.vote as string) && typeof mark.version === 'string';
};

const KNOWN: ReadonlySet<string> = new Set(ALL_CHECKS.map((check) => check.id));

/**
 * Прочитане зі сховища — НЕДОВІРЕНИЙ ввід (§ 8.6, `BETA-MARKS-UNTRUSTED`).
 *
 * Ключ переживає і зміну чеклиста, і зміну формату позначки, і сусідні
 * застосунки на тому самому origin. Найчастіший випадок безневинний і
 * найгірший: пункт прибрали з чеклиста, а позначка лишилася — вона рахується в
 * поступі, і сторінка показує «40 / 37», число, яке не означає нічого й не має
 * де виправитися.
 */
export function trusted(raw: unknown, known: ReadonlySet<string> = KNOWN): Marks {
	if (typeof raw !== 'object' || raw === null) return {};
	const out: Marks = {};
	for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
		if (known.has(id) && isMark(value)) out[id] = value;
	}
	return out;
}

/**
 * Читання й запис ідуть ЧЕРЕЗ TRY/CATCH, хоч фасад сховища в проєкті є.
 *
 * `services/storage` не ловить нічого: він просто кличе `localStorage`. У
 * звичайному вікні це не видно, а у вбудованому перегляді зі заблокованим
 * стороннім сховищем звернення КИДАЄ — і сторінка чеклиста падає цілком, тобто
 * інструмент перевірки ламається там, де перевіряють саме крайні випадки.
 * Тут це коштує шість рядків; правити фасад — окрема робота з іншим радіусом.
 */
function readRaw(): unknown {
	try {
		return storage.getJSON<unknown>(STORAGE_KEY);
	} catch {
		return null;
	}
}

function writeRaw(marks: Marks): void {
	try {
		storage.setJSON(STORAGE_KEY, marks);
	} catch {
		// Сховище недоступне: позначки живуть до перезавантаження, і це краще,
		// ніж падіння сторінки на першому ж натисканні.
	}
}

class BetaMarks {
	marks = $state<Marks>({});

	/** Чи зведена кнопка стирання (§ 6.3): перше натискання лише заряджає її. */
	clearArmed = $state(false);

	private armTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Читання відкладене до монтування, а не в конструкторі.
	 *
	 * `localStorage` існує не тільки в браузері (§ 7.4), і читання в
	 * конструкторі модуля-синглтона виконується під час імпорту — тобто перш
	 * ніж хтось вирішив, що сторінку взагалі показують.
	 */
	load(): void {
		this.marks = trusted(readRaw());
	}

	/**
	 * Повторне натискання того самого стану знімає позначку (§ 3.3).
	 *
	 * Кнопок три, а станів чотири: «не перевірено» не має власної кнопки й не
	 * мусить її мати — рядок на чотири кнопки не влазить у вузьке вікно.
	 *
	 * УМОВА ПРО ВЕРСІЮ НЕ ДЕКОРАТИВНА: без неї повторне натискання на позначці
	 * З ІНШОЇ збірки СТИРАЛО б її, тобто людина, яка приходить підтвердити
	 * торішнє «працює», натомість його втрачає.
	 */
	vote(id: string, next: Vote): void {
		const current = this.marks[id];
		const marks = { ...this.marks };
		if (current?.vote === next && current.version === VERSION) delete marks[id];
		else marks[id] = { vote: next, version: VERSION };
		this.marks = marks;
		writeRaw(marks);
	}

	/**
	 * Стирання у ДВА кроки (§ 6.3): перший виклик лише зводить кнопку.
	 *
	 * Це єдина незворотна дія на сторінці, і стоїть вона поруч зі «Скопіювати
	 * звіт», до якого тягнуться щоразу. Ціна помилки несиметрична: година
	 * роботи проти одного зайвого кліка.
	 *
	 * Не `confirm()`: нативний діалог блокує потік, виглядає чужим у будь-якій
	 * темі, не перекладається й у headless вимагає окремого обробника.
	 */
	requestClear(): boolean {
		if (!this.clearArmed) {
			this.clearArmed = true;
			this.rearm();
			return false;
		}
		this.clear();
		return true;
	}

	/**
	 * Зведення знімається САМО через п’ять секунд (§ 6.3.1, `BETA-CLEAR-DISARM`).
	 *
	 * Кнопка, яка лишилася зведеною, — та сама пастка з іншого боку: наступний
	 * прихід на сторінку починається з того, що між усією роботою і порожнім
	 * списком стоїть ОДНЕ натискання, а вигляд кнопки про це вже не кричить.
	 */
	private rearm(): void {
		clearTimeout(this.armTimer);
		this.armTimer = setTimeout(() => (this.clearArmed = false), 5000);
	}

	/** Знімає зведення, нічого не стираючи. Кличе сторінка при розмонтуванні. */
	disarmClear(): void {
		clearTimeout(this.armTimer);
		this.clearArmed = false;
	}

	clear(): void {
		this.marks = {};
		clearTimeout(this.armTimer);
		this.clearArmed = false;
		writeRaw({});
	}

	/** Позначка ЦІЄЇ збірки або `null`: саме вона фарбує кнопку й рахується. */
	fresh(id: string): Mark | null {
		const mark = this.marks[id];
		return mark && mark.version === VERSION ? mark : null;
	}

	/** Позначка з ІНШОЇ збірки — не помилка, попередження. */
	stale(id: string): boolean {
		const mark = this.marks[id];
		return mark !== undefined && mark.version !== VERSION;
	}

	/**
	 * Поступ ОКРЕМОЇ вкладки (§ 8.1, `BETA-TAB-PROGRESS`).
	 *
	 * Загальне «17 / 41» не відповідає на єдине питання, яке тестувальник собі
	 * ставить: чи закінчена ЦЯ вкладка. Вкладок сім, проходять їх по одній.
	 */
	doneIn(tab: BetaTab): number {
		return tab.checks.filter((check) => this.fresh(check.id) !== null).length;
	}

	get done(): number {
		return BETA_TABS.reduce((sum, tab) => sum + this.doneIn(tab), 0);
	}

	get total(): number {
		return ALL_CHECKS.length;
	}

	/** Скільки позначок лишилося з інших збірок — видно поруч із поступом. */
	get staleCount(): number {
		return ALL_CHECKS.filter((check) => this.stale(check.id)).length;
	}
}

export const betaMarks = new BetaMarks();
