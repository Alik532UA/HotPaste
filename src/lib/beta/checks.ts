/**
 * Чеклист бета-тестування як ДАНІ (BETA-CHECKLIST § 2).
 *
 * ## Навіщо він тут
 *
 * У проєкті чотири файли автоматичних перевірок, і всі вони дивляться на те,
 * що вміє перевірити машина: чи зареєстрований воркер, чи не питає оновлення
 * двічі, чи не згадується `__TAURI_INTERNALS__` там, де має стояти `isTauri()`.
 * Половини роботи вони не роблять і не зроблять: чи копіюється сніпет двома
 * натисканнями, чи не з’їхала розкладка клавіатури на чужому екрані, чи чутно
 * різницю між темами, чи справді вікно ховається по `Escape`.
 *
 * Ця половина не мала власника. Тепер має: сторінка `?beta-test-checklists`.
 *
 * ## Чому дані, а не `QA.md`
 *
 * Текстовий чеклист ніхто не звіряє з кодом: він застаріває мовчки й починає
 * казати «перевірено» про те, чого вже немає. Тут за кожним полем стоїть
 * інваріант у `src/beta-checklist.test.ts` — найдорожчий із них вимагає, щоб
 * пункт, який просить НАТИСНУТИ, називав локатор, який справді є в розмітці.
 *
 * ## Чим цей профіль відрізняється від решти реалізацій канону
 *
 * Це не сайт: маршрутів немає, `robots.txt` і sitemap немає, індексувати нічого.
 * Тому § 4 (noindex, sitemap, `Disallow`) і § 5.5 (скрипт над `build/`) тут
 * незастосовні цілком, і замість «маршрутів» вкладка називає ЕКРАНИ — верхні
 * компоненти, які малює `App.svelte`. Перелік екранів так само лежить на диску
 * й так само не може відстати непоміченим (§ 5.1).
 */

export type Coverage = 'manual' | 'testable' | 'covered';

export interface Localized {
	uk: string;
	en: string;
}

export interface BetaCheck {
	/**
	 * Стабільний НАЗАВЖДИ: це ключ прогресу в сховищі (§ 2.2). Перейменувати
	 * `cards_3` означає стерти людині позначку. Нові пункти дописуються з новим
	 * номером; перенумеровувати наявні не можна навіть тоді, коли порядок
	 * змінився — номер, який видно на екрані, малює сторінка з позиції.
	 */
	id: string;
	/** Розділ усередині вкладки. Непорожній двома мовами. */
	category: Localized;
	text: Localized;
	coverage: Coverage;
	/** Обов’язковий для `covered`, заборонений для решти. Файл мусить існувати. */
	test?: string;
	/** Обов’язковий там, де в тексті є «натисніть». Мусить бути в розмітці. */
	testid?: string;
	/**
	 * Клавіша, яку пункт просить натиснути, — у формі `KeyboardEvent.code`
	 * (§ 5.3.1, `BETA-SHORTCUT-CLAIMED`).
	 *
	 * `testid` закриває «натисніть кнопку» й нічого не каже про «натисніть
	 * пробіл», а це той самий пункт із тією самою хворобою: комбінацію
	 * перевісили, пункт лишився, і тестувальник тисне те, чого немає. Інваріант
	 * звіряє це поле з ОБРОБНИКАМИ у `hotkeyState.svelte.ts`, а не з переліком,
	 * який ведуть поруч, — перелік розійшовся б так само, як пункт.
	 */
	key?: string;
	/** Перевірка МЕЖІ: «не мусить». Найдорожчі дефекти тихі. */
	negative?: true;
}

export interface BetaTab {
	id: string;
	title: Localized;
	/**
	 * Екрани, за які відповідає вкладка, — назви компонентів, які `App.svelte`
	 * малює на верхньому рівні.
	 *
	 * Це аналог «маршрутів» § 5.1 для застосунку без маршрутів, і працює він з
	 * тієї самої причини: перелік екранів уже є на диску (`App.svelte`), і його
	 * ніхто не забуде поповнити — без нього екрана просто не буде. Другий
	 * список, який тримають узгодженим руками, розійшовся б із першим на
	 * першому ж новому вікні.
	 */
	screens: readonly string[];
	checks: readonly BetaCheck[];
}

/**
 * Екрани, яким пункт не потрібен, — явним переліком, а не відсутністю рядка:
 * відсутність не відрізнити від забудькуватості (§ 5.1).
 */
export const BETA_UNCOVERED_SCREENS: readonly string[] = [
	// Слухач налагоджувальних подій: нічого не малює й вмикається комбінацією,
	// якої тестувальник не знає.
	'DebugListener',
	// Обгортки, а не екрани: вони лише ловлять помилку дочірнього дерева.
	'GlobalErrorFallback',
	// Спільний елемент керування, який малюють інші екрани.
	'SegmentedToggle'
];

export const BETA_TABS: readonly BetaTab[] = [
	{
		id: 'start',
		title: { uk: 'Перший запуск', en: 'First run' },
		screens: ['EmptyState'],
		checks: [
			{
				id: 'start_1',
				category: { uk: 'Перший екран', en: 'First screen' },
				text: {
					uk: 'Відкрийте застосунок без підключеної теки. Мусить показатися вітальний екран із заголовком «HotPaste», трьома кроками «вкладка → картка → скопійовано» і кнопкою підключення — а не порожнє сіре поле.',
					en: 'Open the app with no folder connected. A welcome screen must appear with the «HotPaste» heading, three steps «tab → card → copied» and a connect button — not an empty grey field.'
				},
				coverage: 'manual',
				testid: 'empty-state'
			},
			{
				id: 'start_2',
				category: { uk: 'Підключення теки', en: 'Connecting a folder' },
				text: {
					uk: 'Натисніть «Обрати теку» й виберіть будь-яку теку з текстовими файлами. Вікно вибору мусить відкритися, а після вибору вітальний екран — зникнути й поступитися вкладкам із картками.',
					en: 'Press «Choose a folder» and pick any folder with text files. A picker must open, and after the choice the welcome screen must give way to tabs with cards.'
				},
				coverage: 'manual',
				testid: 'btn-connect-directory'
			},
			{
				id: 'start_3',
				category: { uk: 'Підключення теки', en: 'Connecting a folder' },
				text: {
					uk: 'Підключіть теку, у якій немає жодного текстового файла. Застосунок НЕ мусить показати помилку чи порожнє вікно без пояснення — має бути видно вкладку й підказку, що додати.',
					en: 'Connect a folder with no text files at all. The app must NOT show an error or a blank window without explanation — a tab and a hint about what to add must be visible.'
				},
				coverage: 'manual',
				negative: true
			},
			{
				id: 'start_4',
				category: { uk: 'Повернення до теки', en: 'Resuming a folder' },
				text: {
					uk: 'Закрийте застосунок із підключеною текою й відкрийте наново. Мусить або одразу відкритися та сама тека, або з’явитися кнопка з її назвою — шукати теку вдруге не мусить бути потреби.',
					en: 'Close the app with a folder connected and reopen it. Either the same folder must open at once, or a button with its name must appear — there must be no need to look for the folder again.'
				},
				coverage: 'manual',
				testid: 'btn-resume-directory'
			},
			{
				id: 'start_5',
				category: { uk: 'Оболонка застосунку', en: 'App shell' },
				text: {
					uk: 'У браузері на вітальному екрані НЕ мусить бути кнопки «Почати з типовою текою»: вона має сенс лише у віконному застосунку, де тека береться з диска.',
					en: 'In the browser the welcome screen must NOT offer «Start with the default folder»: it only makes sense in the desktop app, where the folder comes from disk.'
				},
				coverage: 'testable',
				negative: true
			}
		]
	},
	{
		id: 'tabs',
		title: { uk: 'Вкладки', en: 'Tabs' },
		screens: ['TabBar'],
		checks: [
			{
				id: 'tabs_1',
				category: { uk: 'Перемикання', en: 'Switching' },
				text: {
					uk: 'Натисніть цифру 1, потім 2 на основному ряду клавіатури. Мусить перемкнутися вкладка — та сама, номер якої підписаний зліва на самій вкладці.',
					en: 'Press 1, then 2 on the main keyboard row. The tab must switch — the one whose number is printed on the left of the tab itself.'
				},
				coverage: 'manual',
				testid: 'tab-button-*',
				key: 'Digit1'
			},
			{
				id: 'tabs_2',
				category: { uk: 'Перемикання', en: 'Switching' },
				text: {
					uk: 'Натисніть стрілку вправо кілька разів поспіль. Вкладки мусять іти по колу: після останньої знову перша, без зупинки на краю.',
					en: 'Press the right arrow several times in a row. Tabs must cycle: after the last one comes the first again, with no stop at the edge.'
				},
				coverage: 'manual',
				key: 'ArrowRight'
			},
			{
				id: 'tabs_3',
				category: { uk: 'Лічильник карток', en: 'Card counter' },
				text: {
					uk: 'Подивіться на число праворуч на кожній вкладці. Воно мусить дорівнювати кількості карток, які видно, коли ця вкладка відкрита.',
					en: 'Look at the number on the right of each tab. It must equal the number of cards visible when that tab is open.'
				},
				coverage: 'manual',
				testid: 'tab-count-*'
			},
			{
				id: 'tabs_4',
				category: { uk: 'Межа нумерації', en: 'Numbering limit' },
				text: {
					uk: 'Якщо теки більше ніж десять, натисніть 0 і перевірте одинадцяту. Цифрою вона відкритися НЕ мусить — цифр рівно десять, і одинадцята вкладка відкривається лише мишкою або стрілками.',
					en: 'If there are more than ten folders, press 0 and check the eleventh. It must NOT open by a digit — there are exactly ten digits, and the eleventh tab opens only by mouse or arrows.'
				},
				coverage: 'manual',
				key: 'Digit0',
				negative: true
			},
			{
				id: 'tabs_5',
				category: { uk: 'Нова вкладка', en: 'A new tab' },
				text: {
					uk: 'Натисніть «плюс» у кінці смужки вкладок і назвіть нову теку. Вкладка мусить з’явитися одразу, а тека — на диску поруч із рештою.',
					en: 'Press the plus at the end of the tab strip and name a new folder. The tab must appear at once, and the folder on disk next to the rest.'
				},
				coverage: 'manual',
				testid: 'btn-add-tab'
			},
			{
				id: 'tabs_6',
				category: { uk: 'Оновлення', en: 'Refresh' },
				text: {
					uk: 'Створіть файл у підключеній теці провідником, тоді натисніть кнопку оновлення у шапці. Нова картка мусить з’явитися без перезапуску застосунку.',
					en: 'Create a file in the connected folder from the file manager, then press the refresh button in the header. The new card must appear without restarting the app.'
				},
				coverage: 'manual',
				testid: 'btn-refresh-tabs'
			}
		]
	},
	{
		id: 'cards',
		title: { uk: 'Картки', en: 'Cards' },
		screens: ['CardGrid', 'SnippetCard', 'AddSnippetCard', 'BatchActionBar'],
		checks: [
			{
				id: 'cards_1',
				category: { uk: 'Копіювання', en: 'Copying' },
				text: {
					uk: 'Натисніть цифру потрібної вкладки, тоді літеру, підписану на картці. Текст мусить опинитися в буфері обміну, а внизу з’явитися повідомлення про копіювання — разом це рівно два натискання.',
					en: 'Press the digit of the tab you need, then the letter printed on the card. The text must land in the clipboard and a message about copying must appear at the bottom — two keystrokes in total.'
				},
				coverage: 'manual',
				testid: 'toast-notification',
				key: 'KeyQ'
			},
			{
				id: 'cards_2',
				category: { uk: 'Копіювання', en: 'Copying' },
				text: {
					uk: 'Скопіюйте картку й вставте текст у будь-який редактор. Він мусить збігтися з тим, що показує картка, — без зайвих порожніх рядків на початку чи в кінці.',
					en: 'Copy a card and paste the text into any editor. It must match what the card shows — with no extra blank lines at the start or the end.'
				},
				coverage: 'manual'
			},
			{
				id: 'cards_3',
				category: { uk: 'Редагування', en: 'Editing' },
				text: {
					uk: 'Натисніть олівець на картці, змініть текст і натисніть «Зберегти». Картка мусить показати новий текст, а файл на диску — теж змінитися.',
					en: 'Press the pencil on a card, change the text and press «Save». The card must show the new text, and the file on disk must change too.'
				},
				coverage: 'manual',
				testid: 'btn-edit-save'
			},
			{
				id: 'cards_4',
				category: { uk: 'Редагування', en: 'Editing' },
				text: {
					uk: 'Почніть редагувати картку, змініть текст і натисніть «Скасувати». Файл на диску змінитися НЕ мусить, а картка — показати старий текст.',
					en: 'Start editing a card, change the text and press «Cancel». The file on disk must NOT change, and the card must show the old text.'
				},
				coverage: 'manual',
				testid: 'btn-edit-cancel',
				negative: true
			},
			{
				id: 'cards_5',
				category: { uk: 'Гарячі клавіші під час набору', en: 'Hotkeys while typing' },
				text: {
					uk: 'Увійдіть у редагування картки й наберіть у тексті літеру, якою підписана інша картка. Та картка скопіюватися НЕ мусить — поки курсор у полі, літери просто друкуються.',
					en: 'Enter card editing and type a letter that labels another card. That card must NOT be copied — while the cursor is in a field, letters are simply typed.'
				},
				coverage: 'manual',
				negative: true
			},
			{
				id: 'cards_6',
				category: { uk: 'Вигляд списку', en: 'List view' },
				text: {
					uk: 'Натисніть перемикач вигляду в шапці. Картки мусять перешикуватися з сітки в список і назад, а вибраний вигляд — пережити перезапуск застосунку.',
					en: 'Press the view switch in the header. Cards must rearrange from a grid into a list and back, and the chosen view must survive an app restart.'
				},
				coverage: 'manual',
				testid: 'btn-view-list'
			},
			{
				id: 'cards_7',
				category: { uk: 'Груповий вибір', en: 'Batch selection' },
				text: {
					uk: 'Натисніть кнопку вибору у шапці й позначте дві картки. Унизу мусить з’явитися смужка з їхньою кількістю та діями «перенести» й «видалити».',
					en: 'Press the selection button in the header and mark two cards. A bar must appear at the bottom with their count and the «move» and «delete» actions.'
				},
				coverage: 'manual',
				testid: 'btn-selection-toggle'
			},
			{
				id: 'cards_8',
				category: { uk: 'Довгий текст', en: 'Long text' },
				text: {
					uk: 'Відкрийте картку з текстом на кілька екранів. Картка НЕ мусить розтягнути сітку на всю висоту — текст має обрізатися, а повністю читатися при редагуванні.',
					en: 'Open a card whose text is several screens long. The card must NOT stretch the grid to full height — the text must be clipped and read in full while editing.'
				},
				coverage: 'manual',
				negative: true
			}
		]
	},
	{
		id: 'keyboard',
		title: { uk: 'Екран клавіатури', en: 'Keyboard screen' },
		screens: ['StartMenu', 'ProgramPickerModal'],
		checks: [
			{
				id: 'keyboard_1',
				category: { uk: 'Розкладка', en: 'Layout' },
				text: {
					uk: 'Відкрийте вкладку з клавіатурою. Намальована розкладка мусить збігатися з вашою фізичною: ті самі ряди, той самий цифровий блок, ті самі клавіші навігації.',
					en: 'Open the keyboard tab. The drawn layout must match your physical one: the same rows, the same numeric block, the same navigation keys.'
				},
				coverage: 'manual',
				testid: 'keyboard-body'
			},
			{
				id: 'keyboard_2',
				category: { uk: 'Призначення програми', en: 'Assigning a program' },
				text: {
					uk: 'Натисніть будь-яку намальовану клавішу й виберіть програму. На клавіші мусить з’явитися її позначка — піктограма, підпис або обидва, залежно від налаштування.',
					en: 'Press any drawn key and choose a program. Its mark must appear on the key — an icon, a caption, or both, depending on the setting.'
				},
				coverage: 'manual',
				testid: 'key-*'
			},
			{
				id: 'keyboard_3',
				category: { uk: 'Вузьке вікно', en: 'Narrow window' },
				text: {
					uk: 'Звузьте вікно застосунку до половини екрана. Клавіатура мусить зменшитися цілком, а не обрізатися: правий край останньої клавіші має лишитися видимим.',
					en: 'Narrow the app window to half the screen. The keyboard must shrink as a whole rather than being cut off: the right edge of the last key must stay visible.'
				},
				coverage: 'manual'
			},
			{
				id: 'keyboard_4',
				category: { uk: 'Порожня клавіша', en: 'An unassigned key' },
				text: {
					uk: 'Подивіться на клавіші, яким нічого не призначено. На них НЕ мусить бути ні піктограми, ні підпису — порожня клавіша має виглядати порожньою.',
					en: 'Look at the keys with nothing assigned. They must show neither icon nor caption — an unassigned key must look unassigned.'
				},
				coverage: 'manual',
				negative: true
			}
		]
	},
	{
		id: 'hotkeys',
		title: { uk: 'Гарячі клавіші', en: 'Hotkeys' },
		screens: ['HotkeyPickerModal', 'HotkeyConflictModal'],
		checks: [
			{
				id: 'hotkeys_1',
				category: { uk: 'Згортання', en: 'Minimal mode' },
				text: {
					uk: 'Натисніть пробіл. Шапка й смужка вкладок мусять зникнути, лишивши самі картки; повторний пробіл — повернути їх назад.',
					en: 'Press the space bar. The header and the tab strip must disappear, leaving only the cards; a second space must bring them back.'
				},
				coverage: 'manual',
				key: 'Space'
			},
			{
				id: 'hotkeys_2',
				category: { uk: 'Приховати вікно', en: 'Hiding the window' },
				text: {
					uk: 'У віконному застосунку натисніть Escape. Вікно мусить сховатися, а не закритися: застосунок лишається в лотку й відкривається своєю глобальною клавішею.',
					en: 'In the desktop app press Escape. The window must hide rather than close: the app stays in the tray and opens again by its global hotkey.'
				},
				coverage: 'manual',
				key: 'Escape'
			},
			{
				id: 'hotkeys_3',
				category: { uk: 'Швидка вставка', en: 'Quick paste' },
				text: {
					uk: 'Скопіюйте будь-який текст у іншій програмі й натисніть Ctrl+V у HotPaste. Мусить з’явитися нова картка з цим текстом.',
					en: 'Copy any text in another program and press Ctrl+V inside HotPaste. A new card with that text must appear.'
				},
				coverage: 'manual',
				key: 'KeyV'
			},
			{
				id: 'hotkeys_4',
				category: { uk: 'Власна клавіша виклику', en: 'The global hotkey' },
				text: {
					uk: 'Відкрийте налаштування, натисніть поле гарячої клавіші виклику й задайте свою комбінацію. Після збереження вікно мусить з’являтися саме по ній із будь-якої програми.',
					en: 'Open the settings, press the global hotkey field and set your own combination. After saving, the window must appear by exactly that combination from any program.'
				},
				coverage: 'manual',
				testid: 'btn-custom-hotkey-display'
			},
			{
				id: 'hotkeys_5',
				category: { uk: 'Модальне вікно', en: 'A modal window' },
				text: {
					uk: 'Відкрийте будь-яке вікно налаштувань і натисніть літеру, якою підписана картка. Картка скопіюватися НЕ мусить: поки відкрите вікно, клавіші застосунку не діють.',
					en: 'Open any settings window and press a letter that labels a card. The card must NOT be copied: while a window is open the app hotkeys are off.'
				},
				coverage: 'manual',
				key: 'KeyQ',
				negative: true
			},
			{
				id: 'hotkeys_6',
				category: { uk: 'Конфлікт клавіш', en: 'A hotkey conflict' },
				text: {
					uk: 'Призначте картці літеру, яку вже зайняла інша картка тієї самої вкладки. Мусить з’явитися вікно про конфлікт, а не мовчазна заміна.',
					en: 'Assign a card a letter already taken by another card on the same tab. A conflict window must appear rather than a silent replacement.'
				},
				coverage: 'manual',
				testid: 'btn-card-hotkey-picker'
			}
		]
	},
	{
		id: 'settings',
		title: { uk: 'Налаштування', en: 'Settings' },
		screens: [
			'GlobalSettingsModal',
			'CardSettingsModal',
			'TabSettingsModal',
			'IconPickerModal',
			'ActionConfirmationModal',
			'PromptModal'
		],
		checks: [
			{
				id: 'settings_1',
				category: { uk: 'Теми', en: 'Themes' },
				text: {
					uk: 'Натисніть перемикач теми в шапці чотири рази. Кольори мусять пройти чотири різні набори й повернутися до початкового, а вибраний — пережити перезапуск.',
					en: 'Press the theme switch in the header four times. The colours must pass through four different sets and return to the first, and the chosen one must survive a restart.'
				},
				coverage: 'manual',
				testid: 'segmented-opt-theme-*'
			},
			{
				id: 'settings_2',
				category: { uk: 'Теми', en: 'Themes' },
				text: {
					uk: 'Перезапустіть застосунок на темній темі й пильно подивіться на перший кадр. Світлого спалаху перед темним тлом бути НЕ мусить.',
					en: 'Restart the app on a dark theme and watch the first frame closely. There must be NO white flash before the dark background.'
				},
				coverage: 'manual',
				negative: true
			},
			{
				id: 'settings_3',
				category: { uk: 'Фон', en: 'The background' },
				text: {
					uk: 'Перемкніть фон на всі чотири варіанти. Частинки, хвилі й фігури мусять рухатися, а варіант «без фону» — не лишати жодної анімації.',
					en: 'Switch the background through all four options. Particles, waves and shapes must move, and the «no background» option must leave no animation at all.'
				},
				coverage: 'manual'
			},
			{
				id: 'settings_4',
				category: { uk: 'Масштаб', en: 'Scale' },
				text: {
					uk: 'Натисніть «плюс» біля числа масштабу кілька разів. Картки мусять збільшуватися, а число — зупинитися на 200% і далі не рости.',
					en: 'Press the plus next to the scale number several times. The cards must grow, and the number must stop at 200% and grow no further.'
				},
				coverage: 'manual',
				testid: 'btn-scale-increase',
				negative: true
			},
			{
				id: 'settings_5',
				category: { uk: 'Масштаб', en: 'Scale' },
				text: {
					uk: 'Натисніть на саме число масштабу. Воно мусить повернутися до 100% з одного натискання.',
					en: 'Press the scale number itself. It must return to 100% in a single press.'
				},
				coverage: 'manual',
				testid: 'scale-value'
			},
			{
				id: 'settings_6',
				category: { uk: 'Мова', en: 'Language' },
				text: {
					uk: 'Перемкніть мову на English. Написи в шапці, у вкладках і у вікнах налаштувань мусять стати англійськими — назви ваших тек і текст карток лишаються як були.',
					en: 'Switch the language to Ukrainian. The header, the tabs and the settings windows must turn Ukrainian — your folder names and card texts stay as they were.'
				},
				coverage: 'manual'
			},
			{
				id: 'settings_7',
				category: { uk: 'Очищення', en: 'Clearing' },
				text: {
					uk: 'Натисніть «Очистити кеш» у налаштуваннях. Мусить з’явитися підтвердження, а не миттєве стирання, і після підтвердження вибір теми й масштабу повернеться до типового.',
					en: 'Press «Clear cache» in the settings. A confirmation must appear rather than an instant wipe, and after it the theme and scale return to their defaults.'
				},
				coverage: 'manual',
				testid: 'btn-clear-cache'
			}
		]
	},
	{
		id: 'common',
		title: { uk: 'Спільне', en: 'Site-wide' },
		screens: ['Toast', 'ContextMenu', 'DynamicBackground', 'UpdateModal', 'ReloadPrompt', 'LogCopyButton'],
		checks: [
			{
				id: 'common_1',
				category: { uk: 'Контекстне меню', en: 'The context menu' },
				text: {
					uk: 'Клацніть правою кнопкою по картці. Мусить відкритися меню застосунку з діями над карткою, а не типове меню браузера.',
					en: 'Right-click a card. The app menu with card actions must open, not the browser default menu.'
				},
				coverage: 'manual'
			},
			{
				id: 'common_2',
				category: { uk: 'Повідомлення', en: 'Notifications' },
				text: {
					uk: 'Скопіюйте картку й порахуйте повільно до п’яти. Повідомлення про копіювання мусить зникнути саме, не чекаючи натискання.',
					en: 'Copy a card and count slowly to five. The copy notification must disappear by itself, without waiting for a press.'
				},
				coverage: 'manual',
				testid: 'toast-notification'
			},
			{
				id: 'common_3',
				category: { uk: 'Читабельність', en: 'Readability' },
				text: {
					uk: 'Пройдіть очима всі чотири теми з увімкненим рухомим фоном. Жоден напис не мусить зникати, зливаючись із тлом, — особливо підписи клавіш на картках.',
					en: 'Look through all four themes with the animated background on. No caption must vanish into the background — especially the key labels on the cards.'
				},
				coverage: 'testable'
			},
			{
				id: 'common_4',
				category: { uk: 'Оновлення', en: 'Updates' },
				text: {
					uk: 'Дочекайтеся пропозиції оновитися й натисніть «Пізніше». Застосунок мусить лишитися відкритим і не питати вдруге до наступного запуску.',
					en: 'Wait for the update prompt and press «Later». The app must stay open and not ask again until the next launch.'
				},
				coverage: 'covered',
				test: 'src/updateCheck.test.ts',
				testid: 'btn-update-skip'
			},
			{
				id: 'common_5',
				category: { uk: 'Оновлення', en: 'Updates' },
				text: {
					uk: 'Після виходу нової версії у браузері мусить з’явитися пропозиція перезавантажити сторінку. Сторінка НЕ мусить перезавантажитися сама посеред роботи — рішення лишається за людиною.',
					en: 'After a new version ships, the browser must offer to reload the page. The page must NOT reload by itself in the middle of your work — the decision stays with the person.'
				},
				coverage: 'covered',
				test: 'src/pwa.test.ts',
				negative: true
			},
			{
				id: 'common_6',
				category: { uk: 'Журнал', en: 'The log' },
				text: {
					uk: 'Натисніть кнопку копіювання журналу в куті вікна. Текст журналу мусить опинитися в буфері обміну — це те, що прикладають до скарги.',
					en: 'Press the log copy button in the corner of the window. The log text must land in the clipboard — that is what gets attached to a bug report.'
				},
				coverage: 'manual',
				testid: 'log-copy-fab'
			},
			{
				id: 'common_7',
				category: { uk: 'Дві оболонки', en: 'Two shells' },
				text: {
					uk: 'Відкрийте той самий застосунок у браузері. Вікно мусить працювати так само, окрім того, що потребує вікна системи: запуску програм і глобальної клавіші виклику.',
					en: 'Open the same app in a browser. It must behave the same, except for what needs the operating system: launching programs and the global hotkey.'
				},
				coverage: 'covered',
				test: 'src/runtime.test.ts'
			}
		]
	}
];

export const ALL_CHECKS: readonly BetaCheck[] = BETA_TABS.flatMap((tab) => tab.checks);

/** Порядок показу рівнів — не косметика, а § 3: спершу те, чого машина не вміє. */
export const LEVELS: readonly Coverage[] = ['manual', 'testable', 'covered'];

/** Пункти вкладки одного рівня, у порядку оголошення (він тематичний). */
export const byLevel = (tab: BetaTab, level: Coverage): BetaCheck[] =>
	tab.checks.filter((check) => check.coverage === level);

/**
 * `id` пункта → дискримінатор локатора: `cards_3` → `cards-3`.
 *
 * Підкреслень у локаторах немає (TESTID-AND-NAMING § 1.2), а `id` має форму
 * `{вкладка}_{номер}` (§ 2.2). Заміна однозначна в обидва боки, тож локатор
 * лишається ПОХІДНИМ від `id`, а не другим іменем, яке треба узгоджувати.
 */
export const tidOf = (id: string): string => id.replace(/_/g, '-');
