/**
 * ПЕРЕВІРКИ НАД `dist/`, А НЕ НАД ДЖЕРЕЛАМИ.
 *
 * Запускати після `npm run build`: `node scripts/check-build.mjs`.
 *
 * Усе, що тут перевіряється, у `src/` не видно в принципі. Маніфест і service
 * worker генерує плагін зі свого конфігу, і головні тутешні дефекти — це коли
 * плагін зробив НЕ ТЕ, що написано в наміри:
 *
 *  * `skipWaiting()` БЕЗУМОВНИЙ у воркері. Прапорець приходить із конфігу
 *    плагіна, а не з нашого коду, тож джерела виглядають правильно. А наслідок
 *    важкий: новий воркер забирає відкриту вкладку під себе й прибирає старі
 *    чанки з передкешу — сторінка, яка тримає їхні адреси, падає на першому ж
 *    лінивому імпорті. Тут це ще й робить мертвим готовий `ReloadPrompt`:
 *    `needRefresh` не стає `true` ЖОДНОГО разу, бо воркер не чекає ніколи;
 *
 *  * іконки, названі в маніфесті, у збірці відсутні. Маніфест із адресою, за
 *    якою 404, не ламає сайт — він ламає лише встановлення, і браузер про це
 *    мовчить;
 *
 *  * адреси в маніфесті розійшлися з `base`.
 *
 * Жодне з трьох не дає видимого симптому на відкритій сторінці.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
let failures = 0;
let checks = 0;

/** @param {string} name @param {boolean} ok @param {string} why */
function check(name, ok, why) {
	checks += 1;
	if (ok) return;
	failures += 1;
	console.error(`FAIL  ${name}\n      ${why}`);
}

if (!existsSync(DIST)) {
	console.error('dist/ немає — спершу `npm run build`, інакше перевіряти нема чого.');
	process.exit(2);
}

const read = (file) => readFileSync(join(DIST, file), 'utf8');

// ─── Service worker ──────────────────────────────────────────────────────────

check('воркер зібраний', existsSync(join(DIST, 'sw.js')), 'файл sw.js у dist/ відсутній');

const sw = read('sw.js');

/*
 * `skipWaiting()` У ВІДПОВІДЬ НА ПОВІДОМЛЕННЯ — це не те саме, що безумовний.
 *
 * Перший потрібен: саме ним `updateServiceWorker(true)` застосовує оновлення,
 * коли людина натиснула кнопку. Другий означає, що рішення ухвалює воркер.
 *
 * Тому перевіряється не наявність виклику, а те, що ПОЗА обробником
 * повідомлення його немає.
 */
const swWithoutMessageHandler = sw.replace(
	/self\.addEventListener\("message"[\s\S]{0,200}?skipWaiting\(\)\}?\)?/g,
	''
);
check(
	'воркер не забирає відкриту вкладку',
	!/skipWaiting\(\)/.test(swWithoutMessageHandler),
	'у зібраному sw.js є безумовний skipWaiting(): новий воркер перехопить ' +
		'відкриту сторінку, а ReloadPrompt стане мертвим кодом — needRefresh не ' +
		'стане true жодного разу'
);

check(
	'воркер слухає SKIP_WAITING',
	/SKIP_WAITING/.test(sw),
	'без цього обробника кнопка «Оновити» не має чим застосувати оновлення: ' +
		'новий воркер лишиться в waiting назавжди'
);

// ─── Маніфест ────────────────────────────────────────────────────────────────

check(
	'маніфест зібраний',
	existsSync(join(DIST, 'manifest.webmanifest')),
	'manifest.webmanifest у dist/ відсутній — застосунок не встановиться'
);

const manifest = JSON.parse(read('manifest.webmanifest'));

/*
 * Відносні адреси, бо `base: './'`. Зашитий `/HotPaste/` (як було) обіцяє одну
 * адресу, а сторінка віддається з іншої: встановлений застосунок відкривається
 * на чужому шляху.
 */
for (const field of ['scope', 'start_url', 'id']) {
	check(
		`маніфест: ${field} відносний`,
		manifest[field] === './',
		`${field} = ${JSON.stringify(manifest[field])}; при base './' тут має бути './', ` +
			'інакше маніфест обіцяє адресу, з якої сторінка не віддається'
	);
}

const icons = manifest.icons ?? [];
check('маніфест називає іконки', icons.length > 0, 'без іконок застосунок не встановлюється');

/*
 * Растр обов'язковий. Один лише SVG браузери для встановлення приймають не
 * скрізь, а в списку застосунків система показує саме растр.
 */
check(
	'серед іконок є растр не менше 192px',
	icons.some((icon) => {
		const size = Number.parseInt(String(icon.sizes).split('x')[0], 10);
		return icon.type === 'image/png' && size >= 192;
	}),
	'у маніфесті немає PNG від 192px: саме його система бере в список застосунків'
);

for (const icon of icons) {
	check(
		`іконка ${icon.src} існує`,
		existsSync(join(DIST, icon.src)),
		'маніфест називає файл, якого у збірці немає. Сайт від цього не ламається — ' +
			'ламається лише встановлення, і браузер про це мовчить'
	);
}

/*
 * `maskable` — обіцянка про поле безпеки по краях малюнка. Якщо його немає,
 * система обріже іконку по колу, і це гірше за відсутність обіцянки: без неї
 * вона додасть поле сама.
 */
check(
	'maskable не заявлений без підготовленої іконки',
	!icons.some((icon) => String(icon.purpose ?? '').includes('maskable')),
	'заявлено purpose: maskable. Якщо іконку справді підготували з полем безпеки — ' +
		'приберіть цю перевірку разом із комітом, у якому з\'явився файл'
);

// ─── Оболонка ────────────────────────────────────────────────────────────────

const html = read('index.html');

check(
	'оболонка посилається на маніфест',
	/rel="manifest"/.test(html),
	'у index.html немає <link rel="manifest">: маніфест зібрався й нікому не потрібен'
);

check(
	'версія доступна з мережі',
	existsSync(join(DIST, 'app-version.json')),
	'app-version.json відсутній — запасний шлях перевірки оновлень не має що читати'
);

console.log(`check:build: ${checks} перевірок, невдач ${failures}`);
process.exit(failures > 0 ? 1 : 0);
