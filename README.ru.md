# BlastRadius

**Пойми последствия изменения. Найди код, который оно оставило без потребителей.**

[English](README.md) · [Архитектура](docs/ARCHITECTURE.md) · [Настройка MCP](docs/MCP_SETUP.md) · [Полное ТЗ](docs/TECHNICAL_SPEC.ru.md)

> **Предварительная версия разработки, не релиз v0.1.0.** Подготовлены исходники, CLI, заготовка MCP/Skill и локальные тесты. Не все требования и приёмочные проверки из ТЗ завершены. Инструмент не должен автоматически удалять найденный код.

BlastRadius — локальный анализатор для TypeScript, JavaScript, React и Next.js. Он отвечает на два вопроса: какие компоненты, роуты и тесты **потенциально** затронет изменение и какие экспорты стали недостижимыми **именно после текущего изменения**. Работа с кодом остаётся на машине разработчика, в облако ничего не отправляется.

## Как попробовать

Требуется Node.js 22.13+ и установленный npm. Репозиторий [levencode-labs/blastradius](https://github.com/levencode-labs/blastradius) публичный, но это **предварительная версия разработки**, а не релиз npm.

```sh
git clone https://github.com/levencode-labs/blastradius.git
cd blastradius
npm install
npm run build
node dist/packages/cli/src/main.js index --root /absolute/path/to/project --json
node dist/packages/cli/src/main.js impact src/hooks/useAuth.ts#useAuth --root /absolute/path/to/project --json
node dist/packages/cli/src/main.js diff --base HEAD --root /absolute/path/to/project --json
```

`--root` — абсолютный путь до исследуемого проекта. Селектор файла внутри `impact` — относительный. По умолчанию Git diff сравнивает `HEAD` и рабочее дерево, включая незакоммиченные tracked/untracked файлы; с `--staged` используется Git index. Для повторного объяснения находки `F001` вызовите `explain --id F001` после `diff`.

`init` создаёт `blastradius.config.json`, не перезаписывая существующий файл. Добавьте `.blastradius/` в `.gitignore` проекта. Актуальные примеры подключения к Codex, Claude Code и Cursor — в [MCP_SETUP.md](docs/MCP_SETUP.md).

## Чем полезен агенту

**Перед изменением:** агент вызывает `br_impact`, изучает реальных потребителей, затронутые экраны и связанные тесты. При необходимости `br_resolve_symbol` уточняет символ.

**После изменения:** `br_analyze_diff` ищет новые осиротевшие экспорты, поломанные ссылки и случаи `NOW_TEST_ONLY`/`NOW_STORY_ONLY`. `br_explain` показывает цепочку из графа, почему символ был достижим до изменения.

**При неизвестных связях:** динамические импорты, spread-пропсы, публичный API, потенциальные побочные эффекты и неполная индексация запрещают безусловную рекомендацию удаления. `verified` означает подтверждённую статическую связь в поддерживаемой модели, а не гарантию runtime-безопасности.

## Текущий статус

Есть работающий TypeScript AST-граф, пути tsconfig, named/default exports, базовые re-exports, JSX и props, роуты Next.js, SQLite-кэш, Git-снимки, CLI, обработчики пяти MCP-инструментов и Skill. **77/77 локальных тестов** прошли на текущем этапе: анализ графа, регрессии и строгая проверка MCP-контрактов. Исправлены ложная достижимость констант, сломанные импорты, фильтрация Git-снимков и `index --force`; добавлены маршруты/тесты в итог diff и привязка `br_explain` к snapshot. Отдельно остаются семантический TypeChecker, 30 эталонных golden-fixtures, реальный прогон MCP по официальному SDK, Windows/macOS CI, сравнение с Knip и публикация npm. Тест живого MCP-stdio обязателен во всех ячейках CI. Локальная попытка закончилась `ERR_MODULE_NOT_FOUND` до начала проверок протокола: отсутствует SDK и недоступен npm Registry. Результат MCP остаётся непроверенным. [Отчёт о продолжении разработки](docs/IMPLEMENTATION_UPDATE_2026-11-22.md) и [статус публикации и CI](docs/PUBLICATION_STATUS.md). Проект пока не позиционируется как готовый MVP.

## Лицензия

Исходный код проекта — MIT; перед публикацией npm нужна проверка всех зависимостей и платформ.
