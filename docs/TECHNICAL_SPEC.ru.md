# Техническое задание: BlastRadius

**Версия документа:** 1.0  
**Целевая версия продукта:** 0.1.0 MVP  
**Тип проекта:** Open Source / Developer Tooling  
**Форматы поставки:** CLI + MCP Server + Agent Skill  
**Языки анализируемого кода:** TypeScript, JavaScript, TSX, JSX  
**Основные фреймворки:** React, Next.js  
**Дополнительные:** React Router, Vite, Vitest, Jest, Storybook  
**Планируемая продолжительность MVP:** 15 рабочих дней  
**Приоритеты:** P0 — обязательно для MVP; P1 — следующий релиз; P2 — долгосрочное развитие.

---

# 1. Назначение продукта

## 1.1. Описание

BlastRadius — локальный инструмент статического анализа исходного кода, предназначенный для определения последствий изменений и обнаружения неиспользуемого кода в TypeScript/JavaScript-проектах.

Инструмент строит инкрементально обновляемый граф зависимостей на уровне файлов, экспортируемых символов, импортов, React-компонентов и точек входа приложения.

На основе этого графа BlastRadius предоставляет две основные функции:

**Impact Analysis (Blast Radius)**

Определение потенциально затронутых частей приложения при изменении или удалении конкретного файла, функции, компонента, хука, экспортируемого символа или React-пропса.

**Differential Dead Code Analysis**

Обнаружение экспортов и файлов, которые стали недостижимыми после конкретного изменения, включая изменения в рабочем дереве Git.

Главное отличие от обычных анализаторов неиспользуемого кода — привязка результатов к конкретному изменению и предоставление доказательной цепочки зависимостей.

## 1.2. Целевая аудитория

Основные пользователи:

- Кодинг-агенты: Claude Code, Codex, Cursor и другие MCP-совместимые системы.
- Разработчики, выполняющие крупные рефакторинги.
- Команды, удаляющие устаревшие фичи.
- Разработчики монорепозиториев.
- Автоматизированные системы code review.

Главный потребитель информации — ИИ-агент, а не человек.

Поэтому инструмент должен отдавать компактные, структурированные и проверяемые ответы, пригодные для машинной обработки.

## 1.3. Основные пользовательские сценарии

**Сценарий A: безопасный рефакторинг**

Разработчик или агент планирует изменить `useAuth()`.

BlastRadius должен определить:

1. Какие модули импортируют `useAuth`.
2. Какие функции и компоненты непосредственно используют хук.
3. Какие компоненты потенциально затронуты транзитивно.
4. Какие маршруты приложения достигают этих компонентов.
5. Какие тесты статически связаны с затронутыми модулями.
6. Какие зависимости установлены точно, а какие предположительно.

**Сценарий B: удаление фичи**

Агент удаляет экран `LegacyDashboard`.

После изменения BlastRadius должен обнаружить, например:

- `useLegacyMetrics` больше не достигается из production entry points.
- `LegacyChart` остался только в Storybook.
- `legacyFormatter` больше не имеет известных потребителей.
- `LegacyDashboard.test.tsx` ссылается на удалённый экспорт.
- `LegacyWidget` может использоваться динамически и требует проверки.

Результат должен описывать именно последствия текущего изменения, а не весь накопленный технический долг репозитория.

**Сценарий C: изменение API компонента**

Агент планирует удалить проп `variant` из `Button`.

BlastRadius должен найти статически разрешимые JSX-вызовы, обращения к пропсу внутри компонента, связанные типы и тесты.

При использовании `...props`, HOC или динамических свойств инструмент обязан явно указывать ограничения анализа.

## 1.4. Что продукт не должен обещать

BlastRadius не является формальным доказателем отсутствия использования кода.

Статический анализ не способен гарантированно обнаружить все зависимости, возникающие через reflection, runtime registry, плагины, внешних потребителей npm-пакетов и произвольные динамические импорты.

Поэтому:

- «Не обнаружено использование» не равнозначно «безопасно удалить».
- Blast Radius — потенциальная область влияния, а не доказательство изменения поведения.
- Статическая связь теста с модулем не равнозначна фактическому покрытию тестами.
- Неполный анализ не должен маскироваться высокой уверенностью.

В MVP инструмент не должен самостоятельно удалять исходный код.

---

# 2. Объём MVP

## 2.1. Обязательные возможности P0

| ID | Функциональность | Приоритет |
|---|---|---|
| F-001 | Обнаружение TS/JS-проектов и workspace-пакетов | P0 |
| F-002 | Построение графа файлов и экспортируемых символов | P0 |
| F-003 | Разрешение статических импортов | P0 |
| F-004 | Поддержка named/default exports | P0 |
| F-005 | Поддержка barrel/re-export | P0 |
| F-006 | Разрешение tsconfig paths | P0 |
| F-007 | Reverse dependency traversal | P0 |
| F-008 | Анализ влияния файла или символа | P0 |
| F-009 | Определение связанных тестов | P0 |
| F-010 | Определение Next.js routes | P0 |
| F-011 | Анализ Git HEAD → working tree | P0 |
| F-012 | Поиск newly orphaned exports | P0 |
| F-013 | Разделение production/test/story usage | P0 |
| F-014 | Инкрементальное обновление индекса | P0 |
| F-015 | Постоянный локальный кэш | P0 |
| F-016 | CLI с JSON-выводом | P0 |
| F-017 | MCP Server через stdio | P0 |
| F-018 | Компактный формат результатов с evidence | P0 |
| F-019 | Agent Skill | P0 |
| F-020 | Набор автоматических тестовых fixtures | P0 |

## 2.2. Функциональность P1

- Точный анализ React props с использованием TypeChecker.
- Расширенный Call Hierarchy.
- Поддержка React Router route objects и JSX routes.
- `import.meta.glob` и framework-specific loaders.
- Watch mode с обновлением индекса.
- Анализ внутренних неэкспортируемых функций.
- Импорт SCIP-индексов.
- Более глубокий анализ package exports.
- Определение связанных тестов через coverage metadata.
- Дополнительные framework adapters.

## 2.3. Функциональность P2

- Нативное Rust-ядро на Oxc.
- Автоматизированные предложения безопасного удаления.
- Визуализация графа.
- CI GitHub Action.
- Анализ изменений публичных API.
- Автоматический выбор минимального набора тестов.
- Межъязыковые зависимости.
- Data-flow и расширенный анализ динамических обращений.

---

# 3. Технологический стек

## 3.1. Выбранная архитектура MVP

**Основной язык:** TypeScript.

**Runtime:** Node.js 22 LTS или новее.

**Парсинг:** TypeScript Compiler API.

**Семантическое разрешение:** TypeScript TypeChecker и Language Service по необходимости.

**Хранилище:** SQLite.

**MCP:** официальный TypeScript SDK Model Context Protocol.

**Git:** локальные read-only вызовы Git через `child_process.spawn`/`execFile`, без shell-интерполяции.

**Тестирование:** Vitest.

**Пакетный менеджер:** pnpm.

**Сборка:** tsup или эквивалентный ESM-compatible bundler.

**Лицензия:** MIT, если не выявлены ограничения выбранных зависимостей.

## 3.2. Почему TypeScript Compiler API

Для первой версии рекомендуется не использовать Oxc в качестве основного движка.

Причины:

1. Необходимо корректно разрешать TypeScript-символы, алиасы и реэкспорты.
2. Нужна поддержка существующей семантики TypeScript.
3. Нельзя строить собственный полноценный resolver типов за 2–3 недели.
4. TypeScript API позволяет реализовать MVP без второго языка и нативного ядра.

При этом TypeChecker не должен запускаться заново для каждого запроса.

Рекомендуемый подход:

- Быстрая синтаксическая индексация через TypeScript AST.
- Построение постоянного графа импортов и экспортов.
- Разрешение модулей через TypeScript module resolution.
- Семантическое уточнение неоднозначных связей через TypeChecker.
- Повторное использование TypeScript Program в рамках активного процесса.
- Сохранение извлечённых фактов в SQLite.

В дальнейшем парсер можно заменить на Oxc, сохранив доменную модель графа.

## 3.3. Требование к абстракции анализатора

Парсер не должен напрямую определять формат хранения или MCP-ответов.

Необходимо ввести интерфейс:

```ts
interface SourceAnalyzer {
  analyzeFile(
    filePath: string,
    source: string,
    context: AnalysisContext
  ): Promise<FileFacts>;

  resolveSymbol(
    selector: SymbolSelector,
    context: AnalysisContext
  ): Promise<ResolvedSymbol>;

  getDiagnostics(): AnalysisDiagnostic[];
}
```

`FileFacts` — нормализованная структура, независимая от конкретного AST-парсера.

Это позволит впоследствии использовать Oxc для синтаксического прохода и TypeChecker только для сложных случаев.

---

# 4. Структура репозитория

Рекомендуется monorepo с разделением ядра, интерфейсов и адаптеров.

```text
blastradius/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── analyzer/
│   │       ├── resolver/
│   │       ├── graph/
│   │       ├── reachability/
│   │       ├── impact/
│   │       ├── dead-code/
│   │       ├── snapshots/
│   │       ├── cache/
│   │       ├── frameworks/
│   │       └── types/
│   │
│   ├── cli/
│   │   └── src/
│   │       ├── commands/
│   │       └── index.ts
│   │
│   └── mcp/
│       └── src/
│           ├── server.ts
│           ├── tools/
│           └── resources/
│
├── skills/
│   └── blastradius/
│       └── SKILL.md
│
├── fixtures/
│   ├── basic-ts/
│   ├── barrel-exports/
│   ├── react-components/
│   ├── next-app-router/
│   ├── next-pages-router/
│   ├── git-diff/
│   └── monorepo/
│
├── benchmarks/
├── docs/
├── examples/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

### Принцип зависимостей

`core` не должен импортировать `cli` или `mcp`.

CLI и MCP должны вызывать один и тот же публичный API ядра.

Не допускается дублирование логики анализа в MCP tools.

---

# 5. Модель графа зависимостей

## 5.1. Общая модель

Необходимо реализовать ориентированный граф:

**G = (V, E)**

Где:

- V — множество файлов, символов, экспортных привязок и точек входа.
- E — множество направленных зависимостей.

Направление основной dependency-связи:

**consumer → provider**

Например:

`Dashboard → useAuth`

Это означает, что `Dashboard` зависит от `useAuth`.

Для Impact Analysis используется обратный обход зависимостей.

Для Dead Code Analysis — достижимость от корневых точек входа по направлению зависимостей.

## 5.2. Типы узлов

Обязательные типы:

| Тип | Описание |
|---|---|
| FILE | Физический исходный файл |
| MODULE_EVAL | Выполнение top-level кода модуля |
| SYMBOL | Функция, класс, переменная, компонент, тип |
| EXPORT_BINDING | Имя, экспортируемое модулем |
| ROUTE | Точка входа маршрута |
| TEST_ENTRY | Тестовый файл |
| STORY_ENTRY | Storybook entry |
| PACKAGE_API | Публичный API пакета |
| UNKNOWN_ENTRY | Неоднозначная динамическая точка входа |

Важно: файл и символ должны быть разными узлами.

Использование одного символа из файла не означает использование всех экспортов этого файла.

## 5.3. Типы связей

```ts
type EdgeKind =
  | "imports"
  | "references"
  | "calls"
  | "renders"
  | "reexports"
  | "type_references"
  | "dynamic_import"
  | "side_effect_import"
  | "prop_access"
  | "prop_pass"
  | "route_entry"
  | "test_dependency"
  | "public_export"
  | "possible_dynamic";
```

Каждая связь должна содержать:

```ts
interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;

  sourceFile: string;
  line: number;
  column: number;

  certainty: "verified" | "inferred" | "unknown";
  resolutionMethod:
    | "typescript_checker"
    | "module_resolver"
    | "ast"
    | "framework_adapter"
    | "heuristic";
}
```

## 5.4. Важное правило: re-export не является использованием

Пример:

```ts
// utils.ts
export function foo() {}
export function bar() {}

// index.ts
export * from "./utils";

// app.ts
import { foo } from "./index";

foo();
```

Ожидаемое поведение:

- `foo` считается используемым.
- `bar` не должен автоматически считаться используемым.
- `index.ts` является промежуточной экспортной привязкой.
- Наличие `export *` само по себе не доказывает использование символа.

Нужно разрешать конкретные экспортируемые имена, включая:

- `export { foo }`
- `export { foo as bar }`
- `export { default as Foo }`
- `export * from "./module"`
- `export * as namespace from "./module"`

Необходимо учитывать неоднозначности при нескольких `export *`, а также то, что обычный `export *` не реэкспортирует `default`.

Если конкретная экспортная привязка не может быть однозначно разрешена, связь маркируется `unknown`.

## 5.5. Использование импортов

Само наличие синтаксической конструкции:

```ts
import { foo } from "./utils";
```

не должно автоматически доказывать использование `foo`.

Необходимо различать:

- Импортированную привязку.
- Реальное обращение к ней.
- Type-only использование.
- Реэкспорт.
- Side-effect import.

Например:

```ts
import "./polyfill";
```

создаёт зависимость от выполнения модуля, даже если не импортируется ни один символ.

А:

```ts
import type { User } from "./types";
```

создаёт зависимость на уровне типов, но не runtime dependency.

Эти случаи нельзя объединять в один тип связи.

## 5.6. Идентификаторы символов

Нельзя использовать номер строки как часть основного идентификатора.

Предлагаемая схема:

`projectId:filePath:lexicalPath:symbolKind:ordinal`

Пример:

`web:src/hooks/useAuth.ts:useAuth:function:0`

Для экспортных привязок:

`web:src/hooks/index.ts:export:useAuth`

Внутренние ID могут быть хешированы для SQLite.

Номера строк и позиции должны храниться отдельно.

Требования:

- Сдвиг строк не должен менять идентификатор.
- Одинаковые имена в разных областях видимости не должны конфликтовать.
- Overloads и declaration merging должны обрабатываться явно.
- Переименование файла или символа может изменить ID.

Для сопоставления двух Git snapshots необходим отдельный механизм matching, использующий Git rename detection, имена экспортов, сигнатуры и fingerprints деклараций.

Если сопоставление неоднозначно, нельзя объявлять символ удалённым или осиротевшим без диагностического предупреждения.

---

# 6. Разрешение модулей и символов

## 6.1. Поддерживаемые конструкции P0

```ts
import Foo from "./Foo";
import { foo } from "./utils";
import { foo as bar } from "./utils";
import * as Utils from "./utils";

export { foo };
export { foo as bar };
export * from "./utils";
export { default as Foo } from "./Foo";

const Component = React.lazy(
  () => import("./Component")
);
```

Также:

- `require("./module")` со строковым литералом.
- `import("./module")` со строковым литералом.
- JSX-использование непосредственно разрешимых компонентов.
- `namespace.foo`, если namespace и свойство разрешаются статически.

## 6.2. Разрешение путей

Необходимо учитывать:

- `baseUrl` и `paths`.
- `moduleResolution`.
- `extends` в tsconfig.
- `package.json` exports.
- Workspace packages.
- NodeNext/Node16/Bundler resolution.
- `.ts`, `.tsx`, `.js`, `.jsx`.
- `index.ts` и `index.tsx`.
- TypeScript project references.

Нельзя реализовывать module resolution исключительно собственными правилами поиска файлов.

Основной механизм — TypeScript `resolveModuleName` с кэшированием результатов.

## 6.3. Несколько tsconfig

Каждый исходный файл должен быть связан с конкретным проектным контекстом.

В монорепозитории возможно наличие нескольких tsconfig с различными правилами разрешения.

При неоднозначности необходимо:

1. Определить владельца файла.
2. Использовать ближайший подходящий tsconfig или явную конфигурацию.
3. Учитывать project references.
4. Сохранить выбранный resolution context в индексе.

Один глобальный TypeScript Program на всё монорепо не требуется и нежелателен.

## 6.4. Динамические импорты

Статически разрешимые:

```ts
import("./Dashboard");
```

должны добавляться в граф.

Неразрешимые:

```ts
import(`./pages/${page}`);
```

должны создавать диагностическую связь `possible_dynamic`.

Такие связи нельзя игнорировать при определении безопасных кандидатов на удаление.

---

# 7. React и frontend-specific анализ

## 7.1. Определение компонентов

В P0 необходимо поддержать типовые варианты:

```tsx
function Header() {
  return <div />;
}

const Header = () => <div />;

export default function Header() {
  return <div />;
}

const Header = React.memo(
  function Header() {
    return <div />;
  }
);
```

Необходимо учитывать:

- JSX-использование компонента.
- Прямой вызов функции.
- Импорт и передачу компонента как значения.
- `React.lazy`.
- `React.memo` для простых разрешимых случаев.

Произвольные HOC не должны автоматически считаться полностью разрешёнными.

## 7.2. React props

В P0 поддерживается базовый анализ:

```tsx
<Button variant="primary" />
```

и:

```tsx
function Button({ variant }: ButtonProps) {
  return <div />;
}
```

Для запроса о `Button.variant` инструмент должен находить явно заданные JSX-атрибуты и непосредственно разрешимые обращения внутри компонента.

Для:

```tsx
<Button {...props} />
```

результат должен содержать:

`POSSIBLE_PROP_USAGE`

Для:

```tsx
const value = props[propName];
```

результат должен содержать:

`DYNAMIC_PROPERTY_ACCESS`

Полноценное отслеживание пропсов через spread, generics, HOC, `forwardRef`, polymorphic components и сложные mapped types относится к P1.

Нельзя сообщать, что проп нигде не используется, если анализ обнаружил неразрешимые передачи пропсов.

## 7.3. Next.js App Router

Необходимо распознавать маршруты из:

- `app/**/page.tsx`
- `app/**/layout.tsx`
- `app/**/template.tsx`
- `app/**/loading.tsx`
- `app/**/error.tsx`
- `app/**/not-found.tsx`
- `app/**/route.ts`

Анализ должен учитывать `src/app` и корневой `app`.

Маршрутные группы `(group)` не должны попадать в URL.

Динамические сегменты `[id]`, `[...slug]` и `[[...slug]]` должны сохраняться в нормализованном route pattern.

Для layout-файлов необходимо определять маршруты-потомки, на которые потенциально влияет изменение.

Route handlers должны классифицироваться отдельно от UI screens.

Необходимо учитывать, что изменение `layout.tsx` может затронуть множество дочерних маршрутов.

## 7.4. Next.js Pages Router

Необходимо распознавать:

- `pages/**/*.tsx`
- `src/pages/**/*.tsx`
- `_app.tsx`
- `_document.tsx`
- `_error.tsx`
- API routes.

Специальные файлы не должны автоматически превращаться в обычные URL-маршруты.

## 7.5. Тесты и Storybook

Тестовые файлы должны определяться по:

- `*.test.ts`
- `*.test.tsx`
- `*.spec.ts`
- `*.spec.tsx`
- `__tests__/**`

Storybook:

- `*.stories.ts`
- `*.stories.tsx`

Дополнительные шаблоны задаются в конфигурации.

Важно различать:

- Production usage.
- Test-only usage.
- Story-only usage.
- Public API usage.
- Unknown dynamic usage.

Тесты не должны делать production-символ автоматически живым в production-контексте.

---

# 8. Алгоритм Impact Analysis

## 8.1. Входные данные

```ts
interface ImpactRequest {
  target: {
    file: string;
    symbol?: string;
    line?: number;
    column?: number;
    prop?: string;
  };

  changeKind:
    | "implementation"
    | "signature"
    | "delete"
    | "prop";

  maxDepth?: number;
  limit?: number;
}
```

Если указаны `line` и `column`, они должны позволять однозначно определить декларацию или использование символа.

Если имя неоднозначно, необходимо вернуть список кандидатов, а не выбирать произвольный.

## 8.2. Алгоритм

1. Разрешить входной target.
2. Найти соответствующий узел графа.
3. Получить обратные зависимости.
4. Разделить непосредственные и транзитивные связи.
5. Пройти граф до заданной глубины.
6. Обнаружить связанные route entry points.
7. Обнаружить связанные тесты.
8. Отметить возможные динамические зависимости.
9. Построить объясняющие цепочки.
10. Отсортировать и ограничить результат.

Для циклических зависимостей необходимо использовать visited set или предварительное разбиение на strongly connected components.

## 8.3. Классификация результатов

**Direct impact**

Символ непосредственно ссылается на изменяемый символ или импортирует его для использования.

**Transitive impact**

Символ или маршрут достижим через последовательность зависимостей.

**Potential impact**

Связь существует, но точное влияние невозможно установить статически.

**Related tests**

Тесты, которые статически зависят от затронутого кода.

Нельзя утверждать, что каждый такой тест действительно проверяет изменяемое поведение.

## 8.4. Объяснение влияния

Пример цепочки:

```text
useAuth
  ← AuthProvider
  ← AppLayout
  ← /dashboard
```

Внутри графа каждая стрелка должна соответствовать конкретному edge с source location.

Инструмент не должен генерировать объяснения при помощи LLM.

Объяснение формируется детерминированно из графа.

---

# 9. Алгоритм Differential Dead Code Analysis

## 9.1. Основная идея

Инструмент должен сравнивать два состояния проекта:

**Baseline snapshot** — состояние до изменения.

**Target snapshot** — состояние после изменения.

По умолчанию:

`HEAD → working tree`

Это включает staged и unstaged изменения.

Untracked файлы могут включаться в target snapshot через отдельную настройку, по умолчанию — включены.

Дополнительные режимы:

- `HEAD → index` — только staged changes.
- `base commit → target commit`.
- `merge-base → working tree` — для анализа изменений относительно ветки.

## 9.2. Формальное определение

Пусть:

`R_before` — множество символов, достижимых из production roots до изменения.

`R_after` — множество символов, достижимых из production roots после изменения.

Тогда:

`NewlyUnreachable = R_before − R_after`

Но для выдачи finding необходимо дополнительно проверить:

- Символ всё ещё существует в target snapshot.
- Символ корректно сопоставлен между snapshots.
- Он не защищён публичным API.
- Его использование не подтверждено через другую категорию roots.
- Не существует неразрешённой динамической зависимости, делающей вывод недостоверным.

Таким образом, `NewlyUnreachable` — исходное множество кандидатов, а не окончательный список безопасного удаления.

## 9.3. Категории находок

| Код | Значение |
|---|---|
| NEW_ORPHAN_EXPORT | Экспорт потерял известных production-потребителей |
| NEW_ORPHAN_FILE | Файл стал недостижимым из production roots |
| NOW_TEST_ONLY | Остались только тестовые потребители |
| NOW_STORY_ONLY | Остались только Storybook-потребители |
| BROKEN_REFERENCE | Сохранившийся код ссылается на удалённый или неразрешимый символ |
| REMOVED_PUBLIC_API | Удалена публичная экспортная привязка |
| POSSIBLE_DYNAMIC_USAGE | Есть неразрешённая динамическая связь |
| PREEXISTING_UNUSED | Неиспользуемый код существовал до изменения |
| ANALYSIS_INCOMPLETE | Невозможно сделать надёжный вывод |

`PREEXISTING_UNUSED` по умолчанию не должен попадать в основной differential report.

## 9.4. Пример

До изменения:

```ts
// dashboard.tsx
import { useLegacyData } from "./useLegacyData";

export function Dashboard() {
  useLegacyData();
  return null;
}
```

После удаления Dashboard:

```ts
// useLegacyData.ts
export function useLegacyData() {
  return fetch("/api/legacy");
}
```

Ожидаемый результат:

```json
{
  "code": "NEW_ORPHAN_EXPORT",
  "symbol": "useLegacyData",
  "file": "src/useLegacyData.ts",
  "before": "production_reachable",
  "after": "unreachable",
  "reason": "LAST_PRODUCTION_CONSUMER_REMOVED",
  "certainty": "verified"
}
```

При этом, если `useLegacyData` экспортируется через публичный API npm-пакета, находка должна быть защищена от рекомендации удаления.

## 9.5. Обнаружение сломанных ссылок

Если удалён сам символ, а его потребитель остался:

```ts
import { removedFunction } from "./utils";
```

это не orphaned export.

Это отдельная категория:

`BROKEN_REFERENCE`

Инструмент должен отличать потерю потребителей от удаления поставщика.

## 9.6. Удаление целой фичи

Если удаляется route entry point, необходимо пересчитать достижимость его зависимостей.

Важно: новый orphan может находиться в файле, который вообще не изменялся в Git diff.

Поэтому запрещается ограничивать поиск orphaned symbols только изменёнными файлами.

Git diff используется для построения новых состояний графа и выявления причин изменений, а не как единственный список проверяемых файлов.

## 9.7. Публичные API

Публичные экспортные привязки должны определяться из:

- `package.json` exports.
- `main`/`module`/`types`, где применимо.
- Явной конфигурации public API.

Если экспорт доступен внешним потребителям, которых нет в репозитории, отсутствие локальных импортов не означает мёртвый код.

Для таких экспортов необходимо возвращать `PUBLIC_API_PROTECTED`.

## 9.8. Side effects

Необходимо учитывать, что импорт модуля может выполнять код верхнего уровня.

Например:

```ts
export const registry = registerPlugin();
```

Даже если `registry` не читается, вызов `registerPlugin()` может иметь побочный эффект.

В MVP такие декларации должны получать защитный флаг `POSSIBLE_SIDE_EFFECT`, если анализ не может доказать отсутствие эффекта.

Автоматическая рекомендация удаления в таком случае запрещена.

---

# 10. Snapshot Engine

## 10.1. Требования

Необходимо поддерживать анализ нескольких состояний одного репозитория без изменения пользовательских файлов.

Основные состояния:

- Git commit snapshot.
- Git index snapshot.
- Working tree snapshot.

Содержимое Git baseline должно читаться через Git object database.

Запрещается делать checkout, reset или stash для анализа.

## 10.2. Получение изменений

Для определения изменённых файлов использовать Git diff с поддержкой:

- Added.
- Modified.
- Deleted.
- Renamed.
- Type changed.

Необходимо корректно обрабатывать пути с пробелами, Unicode и специальными символами.

Рекомендуется использовать NUL-delimited вывод Git.

## 10.3. Сравнение snapshots

Алгоритм:

1. Определить baseline revision.
2. Загрузить или построить baseline graph.
3. Определить изменённые файлы.
4. Создать target graph как overlay над baseline.
5. Переиндексировать изменённые файлы.
6. Обновить зависимые resolution bindings.
7. Пересчитать изменённые области достижимости.
8. Сравнить состояния символов.
9. Построить differential findings.

В MVP допустим полный пересчёт reachability по уже построенному графу, если он укладывается в целевые задержки.

Не требуется реализовывать сложный dynamic reachability algorithm до появления измеренной необходимости.

---

# 11. Инкрементальное кэширование

## 11.1. Хранилище

Рекомендуемый путь:

`.blastradius/cache.sqlite`

Каталог должен добавляться в `.gitignore`.

Для SQLite в MVP допускается `better-sqlite3` с предварительно собранными нативными пакетами.

Требуется проверить совместимость macOS, Linux и Windows.

Нативная зависимость должна быть явно указана как ограничение дистрибуции. Возможность перехода на другой SQLite backend не должна требовать переписывания графа.

## 11.2. Минимальная схема БД

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  export_hash TEXT,
  kind TEXT,
  flags TEXT
);

CREATE TABLE symbols (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  lexical_path TEXT,
  start_line INTEGER,
  start_column INTEGER,
  end_line INTEGER,
  end_column INTEGER
);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  certainty TEXT NOT NULL,
  source_file TEXT,
  line INTEGER,
  column INTEGER
);

CREATE TABLE roots (
  snapshot_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  root_kind TEXT NOT NULL
);
```

Также необходимы таблицы или эквивалентные структуры:

- snapshots.
- projects.
- export_bindings.
- module_resolutions.
- diagnostics.
- schema_metadata.

Обязательные индексы:

- `edges(source_id)`.
- `edges(target_id)`.
- `symbols(file_id, name)`.
- `files(snapshot_id, path)`.
- `roots(snapshot_id, root_kind)`.

Для больших графов необходимо избегать N+1 SQL queries при обходе.

## 11.3. Инвалидация

Ключи кэша должны учитывать:

- Хеш содержимого файла.
- Версию анализатора.
- Версию схемы кэша.
- TypeScript version.
- Эффективную конфигурацию tsconfig.
- Конфигурацию BlastRadius.
- Relevant package resolution metadata.

Если изменился только внутренний код функции без изменения экспортного интерфейса, не нужно пересчитывать разрешение всех импортёров.

Если изменились exports, требуется обновить потребителей и зависимые barrel bindings.

Если изменились tsconfig paths, package exports или project references, необходимо инвалидировать соответствующие resolution contexts.

Если изменились route entry points, требуется обновить roots и reachability.

## 11.4. Атомарность

Обновление индекса должно происходить транзакционно.

Нельзя возвращать граф, в котором часть файлов относится к старому состоянию, а часть — к новому, без явного указания snapshot consistency.

Если обновление прервано, должен оставаться доступен последний консистентный snapshot.

## 11.5. Ограничение памяти

Необходимо предусмотреть:

- Освобождение неиспользуемых TypeScript Programs.
- Отдельные project contexts.
- Ограниченный кэш семантических запросов.
- Отсутствие постоянного хранения полных AST в памяти.
- Lazy TypeChecker initialization.

Целевые ограничения памяти определяются бенчмарками, а не предполагаемой скоростью парсера.

---

# 12. Архитектура внутренних модулей

## 12.1. ProjectDiscovery

Ответственность:

- Поиск workspace packages.
- Поиск tsconfig.
- Определение framework.
- Поиск entry points.
- Исключение generated files.
- Определение package boundaries.

Выход:

`ProjectManifest[]`

## 12.2. SourceIndexer

Ответственность:

- Парсинг TS/JS/TSX.
- Извлечение деклараций.
- Извлечение imports/exports.
- Извлечение статических references.
- Выявление динамических конструкций.
- Формирование FileFacts.

## 12.3. ModuleResolver

Ответственность:

- TypeScript module resolution.
- Aliases.
- Package exports.
- Workspace packages.
- Barrel bindings.
- Кэширование разрешённых путей.

## 12.4. SemanticResolver

Ответственность:

- TypeChecker-backed symbol identity.
- Разрешение неоднозначных ссылок.
- Уточнение namespace imports.
- Уточнение JSX component identity.
- Разрешение типов там, где это необходимо.

Семантический анализ не должен без необходимости пересобирать весь репозиторий при каждом запросе.

## 12.5. GraphStore

Ответственность:

- Хранение узлов и связей.
- Reverse edge lookup.
- Snapshot isolation.
- Graph traversal.
- Индексы.
- Транзакции.

## 12.6. ReachabilityEngine

Ответственность:

- Reachability от production roots.
- Reachability от test roots.
- Reachability от story roots.
- Public API protection.
- Conservative unknown handling.

## 12.7. ImpactEngine

Ответственность:

- Reverse traversal.
- Классификация direct/transitive impact.
- Связанные routes.
- Связанные tests.
- Evidence chains.
- Ограничение и ранжирование результатов.

## 12.8. DiffEngine

Ответственность:

- Git snapshots.
- Snapshot comparison.
- Matching symbols.
- Newly unreachable detection.
- Broken references.
- Differential report.

## 12.9. ReportFormatter

Ответственность:

- Компактный JSON.
- Human-readable CLI.
- Стабильная сортировка.
- Pagination.
- Truncation.
- Диагностика неполного анализа.

---

# 13. CLI-интерфейс

## 13.1. Основные команды

```bash
blastradius init

blastradius index

blastradius status

blastradius impact src/hooks/useAuth.ts

blastradius impact src/hooks/useAuth.ts#useAuth

blastradius diff --base HEAD --target worktree

blastradius orphans --since HEAD

blastradius explain --id F001

blastradius doctor

blastradius mcp --stdio
```

## 13.2. Команда init

Создаёт конфигурационный файл:

`blastradius.config.json`

Должна:

- Определять тип проекта.
- Находить tsconfig.
- Находить workspace packages.
- Предлагать detected entry points.
- Не перезаписывать существующую конфигурацию без подтверждения.

В неинтерактивном режиме необходимо поддержать `--yes`.

## 13.3. Команда index

Строит или обновляет локальный индекс.

Флаги:

- `--force` — полная переиндексация.
- `--project` — ограничение проектом.
- `--json` — машинный вывод.
- `--verbose` — подробная диагностика.

## 13.4. Команда impact

Параметры:

- `--symbol`.
- `--line`.
- `--column`.
- `--prop`.
- `--depth`.
- `--limit`.
- `--json`.
- `--include-tests`.
- `--include-routes`.

По умолчанию выводится компактный human-readable report.

## 13.5. Команда diff

Параметры:

- `--base`.
- `--target`.
- `--staged`.
- `--include-untracked`.
- `--json`.
- `--limit`.
- `--fail-on`.

Команда должна объединять:

- Impact summary.
- Newly orphaned exports.
- Broken references.
- Dynamic warnings.

## 13.6. Exit codes

| Код | Значение |
|---|---|
| 0 | Анализ выполнен |
| 1 | Найдены findings, нарушающие `--fail-on` |
| 2 | Ошибка параметров или конфигурации |
| 3 | Внутренняя ошибка |
| 4 | Анализ неполон при включённом strict mode |

Наличие orphaned exports само по себе не должно приводить к ненулевому exit code без соответствующей политики.

---

# 14. MCP Server

## 14.1. Общие требования

MCP Server должен:

- Работать локально.
- Поддерживать stdio transport.
- Использовать тот же core, что и CLI.
- Не требовать сетевых сервисов.
- Не запускать LLM.
- Не передавать исходный код наружу.
- Не писать логи в stdout.
- Поддерживать JSON Schema для входных параметров.

По умолчанию сервер обслуживает один доверенный workspace root.

Запросы за пределы разрешённого workspace должны отклоняться.

## 14.2. MCP Tool: `br_status`

**Назначение:** получить состояние индекса.

Вход:

```json
{}
```

Выход:

```json
{
  "schemaVersion": 1,
  "status": "ready",
  "indexedFiles": 4280,
  "indexedProjects": 12,
  "graphVersion": "g_abc123",
  "coverage": {
    "skippedFiles": 14,
    "unresolvedImports": 3
  }
}
```

Числа в примере иллюстративные.

## 14.3. MCP Tool: `br_resolve_symbol`

**Назначение:** определить конкретный символ.

Вход:

```json
{
  "file": "src/hooks/useAuth.ts",
  "name": "useAuth"
}
```

Выход:

```json
{
  "status": "resolved",
  "symbol": {
    "id": "sym_123",
    "name": "useAuth",
    "kind": "function",
    "file": "src/hooks/useAuth.ts",
    "line": 12
  }
}
```

Если найдено несколько подходящих деклараций, возвращается `ambiguous` и список кандидатов.

## 14.4. MCP Tool: `br_impact`

**Назначение:** определить Blast Radius.

Вход:

```json
{
  "target": {
    "file": "src/hooks/useAuth.ts",
    "symbol": "useAuth"
  },
  "changeKind": "implementation",
  "maxDepth": 5,
  "limit": 20
}
```

Пример ответа:

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "snapshot": "working_tree:abc123",
  "target": "src/hooks/useAuth.ts#useAuth",
  "summary": {
    "directConsumers": 4,
    "transitiveConsumers": 13,
    "routes": 3,
    "relatedTests": 5,
    "unknownEdges": 1
  },
  "routes": [
    {
      "path": "/dashboard",
      "certainty": "verified",
      "via": [
        "useAuth",
        "AuthProvider",
        "DashboardLayout"
      ]
    }
  ],
  "tests": [
    {
      "file": "src/auth/AuthProvider.test.tsx",
      "relation": "static_dependency"
    }
  ],
  "warnings": [
    {
      "code": "DYNAMIC_USAGE",
      "file": "src/plugins/registry.ts",
      "line": 42
    }
  ],
  "truncated": false
}
```

## 14.5. MCP Tool: `br_analyze_diff`

**Назначение:** анализ текущего изменения.

Вход:

```json
{
  "base": "HEAD",
  "target": "working_tree",
  "mode": "both",
  "limit": 30
}
```

Значения `mode`:

- `impact`.
- `orphans`.
- `both`.

Пример ответа:

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "summary": {
    "changedFiles": 6,
    "newOrphans": 3,
    "brokenReferences": 1,
    "reviewRequired": 2
  },
  "findings": [
    {
      "id": "F001",
      "code": "NEW_ORPHAN_EXPORT",
      "symbol": "useLegacyData",
      "file": "src/hooks/useLegacyData.ts",
      "before": "production_reachable",
      "after": "unreachable",
      "certainty": "verified",
      "reasonCodes": [
        "LAST_PRODUCTION_CONSUMER_REMOVED"
      ],
      "deletionAdvice": "candidate"
    },
    {
      "id": "F002",
      "code": "NOW_TEST_ONLY",
      "symbol": "LegacyChart",
      "file": "src/charts/LegacyChart.tsx",
      "certainty": "verified",
      "deletionAdvice": "review"
    }
  ],
  "truncated": false
}
```

`deletionAdvice: candidate` означает кандидат на ручную проверку, а не гарантию безопасного удаления.

## 14.6. MCP Tool: `br_explain`

**Назначение:** показать доказательную цепочку для конкретного finding.

Вход:

```json
{
  "findingId": "F001",
  "maxPaths": 3
}
```

Выход:

```json
{
  "findingId": "F001",
  "reason": "LAST_PRODUCTION_CONSUMER_REMOVED",
  "before": {
    "chain": [
      {
        "file": "src/app/dashboard/page.tsx",
        "line": 4,
        "relation": "route_entry"
      },
      {
        "file": "src/dashboard/Dashboard.tsx",
        "line": 8,
        "relation": "references"
      },
      {
        "file": "src/hooks/useLegacyData.ts",
        "line": 3,
        "relation": "calls"
      }
    ]
  },
  "after": {
    "knownProductionConsumers": 0,
    "analysisComplete": true
  }
}
```

Все locations должны быть получены из фактического графа.

Нельзя генерировать фиктивные промежуточные узлы ради красивого объяснения.

## 14.7. Общий контракт ответа

Каждый MCP tool должен возвращать:

- `schemaVersion`.
- `status`.
- Идентификатор анализируемого snapshot.
- Основные результаты.
- Диагностику, если она есть.
- Признак неполноты результата.
- Признак truncation.

Для больших результатов необходимо поддержать:

- `limit`.
- `cursor`.
- `nextCursor`.
- `truncated`.

Cursor должен быть привязан к конкретному snapshot, чтобы пагинация не смешивала разные состояния графа.

---

# 15. Формат уверенности и безопасности

## 15.1. Уровни certainty

Не рекомендуется использовать произвольные числа вроде `confidence: 0.97`.

В MVP достаточно трёх уровней:

**verified**

Связь установлена однозначно в рамках поддерживаемой статической модели.

**inferred**

Связь установлена по синтаксическим или framework-specific правилам, но не подтверждена полностью семантически.

**unknown**

Наличие или отсутствие связи невозможно установить надёжно.

Важно: `verified` не означает доказанную безопасность удаления.

## 15.2. Полнота анализа

Необходимо отдельно передавать:

```json
{
  "coverage": {
    "complete": false,
    "unresolvedImports": 2,
    "dynamicEdges": 3,
    "unsupportedFiles": 1
  }
}
```

Если анализ неполон, MCP-клиент должен получить явный сигнал.

Нельзя возвращать `status: ok` с безусловным утверждением «точно не используется», если есть существенные неизвестные зависимости.

## 15.3. Reason codes

Минимальный набор:

```text
NO_KNOWN_CONSUMERS
LAST_PRODUCTION_CONSUMER_REMOVED
ONLY_TEST_CONSUMERS
ONLY_STORY_CONSUMERS
PUBLIC_API_PROTECTED
DYNAMIC_IMPORT_UNRESOLVED
DYNAMIC_PROPERTY_ACCESS
POSSIBLE_SIDE_EFFECT
BARREL_EXPORT_AMBIGUOUS
SYMBOL_MATCH_AMBIGUOUS
INCOMPLETE_PROJECT_INDEX
```

Reason codes должны быть стабильными между patch-релизами.

---

# 16. Оптимизация ответов для LLM

## 16.1. Требования

По умолчанию MCP не должен возвращать:

- Полный AST.
- Полный граф.
- Содержимое всех найденных файлов.
- Сотни однотипных references.
- Длинные stack traces.

Ответ должен быть организован по принципу:

**Summary → Findings → Evidence → Warnings**

## 16.2. Ограничение объёма

Рекомендуемые настройки:

- Максимум 20–30 findings по умолчанию.
- Максимум 3 evidence chains на finding.
- Максимум 5–8 узлов в одной отображаемой цепочке.
- Целевой размер обычного ответа — до 8 KB.
- Жёсткий лимит ответа — конфигурируемый, по умолчанию 32 KB.

При превышении лимита сервер должен возвращать summary и cursor, а не обрезать JSON.

## 16.3. Детерминированность

Для одинакового snapshot и одинаковых параметров запрос должен возвращать логически идентичный результат.

Сортировка:

1. Severity.
2. Production relevance.
3. Direct before transitive.
4. Shortest evidence path.
5. Lexicographic path.
6. Symbol ID.

Необходимо исключить случайный порядок результатов SQLite или обхода hash maps.

---

# 17. MCP Resources

## 17.1. Project status

URI:

`blastradius://project/status`

Содержимое:

- Версия индекса.
- Обнаруженные проекты.
- Поддерживаемые frameworks.
- Количество ошибок разрешения.
- Статус актуальности.

## 17.2. File outline

Ресурс-шаблон:

`blastradius://file/outline/{path}`

Возвращает компактное описание:

- Exports.
- Functions.
- Components.
- Imports.
- Framework role.

Не должен возвращать полный исходный файл по умолчанию.

## 17.3. Graph metadata

URI:

`blastradius://graph/metadata`

Возвращает:

- Graph version.
- Snapshot identity.
- Root categories.
- Coverage.
- Statistics.

MCP Resources — дополнительный интерфейс. Основные сценарии обязаны работать через Tools, поскольку поддержка Resources различается между MCP-клиентами.

---

# 18. Agent Skill

## 18.1. Расположение

Основной файл:

`skills/blastradius/SKILL.md`

При необходимости должны предоставляться инструкции установки для Claude Code, Codex и Cursor.

Skill должен быть совместим с форматом Agent Skills, насколько это поддерживается конкретным агентом.

## 18.2. Назначение Skill

Skill должен обучать агента использовать BlastRadius перед потенциально опасными изменениями.

Триггеры:

- Удаление компонента.
- Удаление фичи.
- Изменение публичной функции.
- Изменение React props.
- Перенос модулей.
- Удаление barrel exports.
- Крупный рефакторинг.
- Проверка оставшегося dead code.

## 18.3. Обязательный workflow

**До изменения**

1. Определить целевой символ.
2. Вызвать `br_impact`.
3. Изучить direct consumers.
4. Проверить routes и related tests.
5. Изучить warnings.
6. Составить план изменений.

**После изменения**

1. Вызвать `br_analyze_diff`.
2. Проверить broken references.
3. Проверить newly orphaned exports.
4. Разобрать test-only и story-only findings.
5. Проверить dynamic warnings.
6. Запустить подходящие тесты и TypeScript validation.

**Перед удалением кандидата**

1. Получить `br_explain`.
2. Проверить public API.
3. Проверить side effects.
4. Проверить неполноту анализа.
5. Только после этого принимать решение об удалении.

## 18.4. Запреты для агента

Skill должен прямо запрещать:

- Автоматически удалять все найденные orphaned exports.
- Считать `verified` гарантией отсутствия runtime usage.
- Игнорировать `unknown` и `analysis_incomplete`.
- Подменять отсутствие найденных ссылок доказательством безопасности.
- Утверждать, что тесты покрывают изменение, только на основании статической зависимости.

---

# 19. Конфигурация

## 19.1. Файл

`blastradius.config.json`

Пример:

```json
{
  "schemaVersion": 1,
  "projects": [
    "apps/*/tsconfig.json",
    "packages/*/tsconfig.json"
  ],
  "frameworks": [
    "next",
    "react"
  ],
  "roots": {
    "production": [
      "apps/web/src/main.tsx"
    ],
    "tests": [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx"
    ],
    "stories": [
      "**/*.stories.tsx"
    ],
    "publicApi": [
      "packages/ui/src/index.ts"
    ]
  },
  "exclude": [
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/generated/**"
  ],
  "analysis": {
    "dynamicImports": "conservative",
    "typeReferences": true,
    "maxDepth": 12
  },
  "git": {
    "includeUntracked": true
  }
}
```

## 19.2. Автоматические defaults

Инструмент должен автоматически обнаруживать распространённые конфигурации, но не должен молча считать анализ полным при неудачном обнаружении.

Пользовательские настройки должны иметь приоритет над autodetection.

## 19.3. Игнорируемые файлы

По умолчанию:

- `node_modules`.
- Build output.
- Cache directories.
- Generated artifacts.
- `.git`.
- Coverage output.

Содержимое внешних npm-пакетов в MVP не индексируется как часть основного графа.

Внешние зависимости должны представляться boundary nodes.

---

# 20. Нефункциональные требования

## 20.1. Производительность

Целевые показатели MVP после прогрева индекса:

| Операция | Цель |
|---|---|
| `br_status` | p95 до 50 мс |
| Impact одного символа | p95 до 300 мс |
| Reverse dependency lookup | p95 до 100 мс |
| Обновление 1–2 файлов | p95 до 2 с |
| Differential analysis после 2 изменений | p95 до 2 с |
| Полная индексация 5 000 файлов | до 60 с |

Это **целевые SLO, а не гарантированные измеренные результаты**.

Условия измерения должны быть зафиксированы: CPU, RAM, SSD, Node version, размер исходников, число TS projects и состояние кэша.

Для монорепозиториев на 50 000+ файлов в MVP необходимо провести отдельный benchmark и опубликовать фактические результаты. Жёсткий SLO для этого масштаба устанавливается после измерений.

## 20.2. Память

Цель для fixture на 5 000 файлов:

- Пиковый RSS не более 1 GB.

При превышении необходимо профилировать TypeScript Program retention, AST retention и SQLite cache.

## 20.3. Offline-first

Обязательные требования:

- Никакой обязательной авторизации.
- Никакой телеметрии.
- Никаких внешних API.
- Никакой отправки исходников.
- Никакого удалённого индексирования.
- Полная работа без интернета после установки зависимостей.

## 20.4. Безопасность

- Запрещено выполнять пользовательский исходный код.
- Запрещено исполнять конфигурационные файлы проекта для их анализа.
- Git-команды должны использовать безопасную передачу аргументов без shell.
- Необходимо проверять пути на выход за пределы workspace.
- Symlinks должны обрабатываться с учётом workspace boundary.
- Логи не должны содержать полные исходные файлы.
- MCP не должен иметь инструментов произвольного выполнения команд.
- По умолчанию все аналитические операции read-only.
- Изменения разрешены только в локальном кэше и явно создаваемой конфигурации.

## 20.5. Устойчивость

При повреждении SQLite cache инструмент должен:

1. Обнаружить несовместимость или повреждение.
2. Вывести диагностическое сообщение.
3. Предложить или выполнить безопасное восстановление индекса.
4. Не изменять исходный код.
5. Не выдавать устаревший индекс как актуальный.

---

# 21. Обработка ошибок

Необходимо предусмотреть следующие ошибки:

| Код | Описание |
|---|---|
| PROJECT_NOT_FOUND | Не обнаружен проект |
| FILE_NOT_FOUND | Файл не найден |
| SYMBOL_NOT_FOUND | Символ не найден |
| AMBIGUOUS_SYMBOL | Несколько подходящих символов |
| MODULE_RESOLUTION_FAILED | Невозможно разрешить модуль |
| UNSUPPORTED_SYNTAX | Неподдерживаемая конструкция |
| SNAPSHOT_NOT_FOUND | Git revision не найден |
| SNAPSHOT_STALE | Индекс не соответствует запрошенному состоянию |
| CACHE_CORRUPTED | Повреждён кэш |
| ANALYSIS_TIMEOUT | Превышено время анализа |
| ANALYSIS_INCOMPLETE | Анализ выполнен частично |
| WORKSPACE_ACCESS_DENIED | Путь вне разрешённого workspace |

Ошибки должны быть машиночитаемыми.

Не допускается возвращать пустой массив результатов вместо ошибки разрешения символа.

---

# 22. План тестирования

## 22.1. Unit tests

Необходимо покрыть:

- AST extraction.
- Import resolution.
- Export binding resolution.
- Graph traversal.
- Reachability.
- Snapshot matching.
- Differential classification.
- Response formatting.

## 22.2. Integration fixtures

Минимальный набор:

| ID | Сценарий | Ожидаемый результат |
|---|---|---|
| T-001 | Прямой named import | Direct dependency |
| T-002 | Default import | Correct symbol resolution |
| T-003 | Alias import | Correct original symbol |
| T-004 | Barrel export | Symbol-specific usage |
| T-005 | Export-star chain | Correct transitive binding |
| T-006 | Unused barrel export | Не считается используемым |
| T-007 | tsconfig paths | Correct resolution |
| T-008 | React component usage | JSX reference |
| T-009 | React.lazy literal | Dynamic import resolved |
| T-010 | Dynamic import expression | Unknown edge |
| T-011 | Next.js page | Route entry |
| T-012 | Next.js layout | Descendant routes |
| T-013 | Test-only export | NOW_TEST_ONLY |
| T-014 | Story-only export | NOW_STORY_ONLY |
| T-015 | Removed consumer | NEW_ORPHAN_EXPORT |
| T-016 | Removed provider | BROKEN_REFERENCE |
| T-017 | Existing dead code | Не новый orphan |
| T-018 | Public package export | Protected |
| T-019 | Side-effect import | Module evaluation preserved |
| T-020 | Circular imports | No infinite traversal |
| T-021 | File rename | Snapshot matching |
| T-022 | JSX spread props | Unknown usage |
| T-023 | Type-only import | Type dependency |
| T-024 | Changed tsconfig paths | Resolution invalidated |
| T-025 | Changed package exports | API graph invalidated |
| T-026 | Git staged vs working tree | Different correct snapshots |
| T-027 | No file changes | No new findings |
| T-028 | Corrupted cache | Safe recovery |
| T-029 | Out-of-workspace path | Access denied |
| T-030 | Repeated same query | Deterministic output |

## 22.3. Golden tests

Для каждого fixture необходимо хранить ожидаемый JSON.

При изменении анализатора тесты должны сравнивать:

- Finding codes.
- Symbol identities.
- Locations.
- Evidence chains.
- Certainty.
- Coverage status.

Нельзя автоматически обновлять golden snapshots без проверки изменения семантики.

## 22.4. Проверка false positives

Особое внимание:

- Public API exports.
- Dynamic imports.
- Barrel files.
- Test-only code.
- Storybook.
- Side effects.
- Framework entry points.

Цель — не максимальное количество находок, а полезные и объяснимые findings.

---

# 23. Benchmarking

## 23.1. Наборы данных

Необходимо использовать:

**Synthetic fixtures**

- 100 файлов.
- 1 000 файлов.
- 5 000 файлов.
- 50 000 файлов.

Сгенерированные зависимости должны включать:

- Deep import chains.
- Wide dependency graphs.
- Cycles.
- Barrel exports.
- Shared utility modules.
- Multiple tsconfig.

**Real-world fixtures**

Минимум два открытых TS/React-проекта с различной структурой.

Для воспроизводимости фиксировать Git commit и конфигурацию анализа.

## 23.2. Метрики

Обязательные:

- Cold indexing time.
- Warm startup time.
- Incremental update time.
- Impact query p50/p95.
- Diff analysis p50/p95.
- Peak RSS.
- Cache size.
- Precision.
- Recall.
- False positive rate.
- Output bytes.
- Approximate token count.

## 23.3. Сравнение с Knip

Необходимо создать отдельный benchmark сценария:

«Удаление фичи → обнаружение новых orphaned exports».

Сравнивать:

- Время получения результата.
- Число нерелевантных findings.
- Наличие объяснения причины.
- Количество действий агента.
- Размер контекста, потребляемого агентом.

Knip используется как baseline, но сравнение должно быть корректным: это инструменты с разными основными задачами.

---

# 24. Критерии качества

## 24.1. Correctness

Для поддерживаемых статических конструкций:

- Не менее 95% precision на размеченном наборе differential orphan findings.
- Не менее 90% recall на поддерживаемых сценариях.
- 100% прохождение обязательных regression fixtures.

При этом unknown/unsupported случаи не должны искусственно повышать precision за счёт сокрытия ошибок: долю неполного анализа нужно измерять отдельно.

## 24.2. Incrementality

При изменении двух файлов инструмент не должен заново парсить все неизменённые файлы без обоснованной инвалидации.

Это проверяется инструментированием количества вызовов парсера.

## 24.3. Explainability

Каждый `verified` finding должен иметь воспроизводимые evidence records.

Для differential finding необходимо объяснить:

- Что изменилось.
- Какая связь исчезла.
- Почему изменился reachability status.
- Какие ограничения анализа остаются.

## 24.4. MCP compatibility

MCP Server должен успешно проходить:

- Initialization.
- Tools listing.
- Tool invocation.
- Input validation.
- Error response handling.
- Multiple sequential requests.
- Graceful shutdown.

## 24.5. Safety

Не допускаются:

- Изменение исходных файлов аналитическими командами.
- Выполнение исходного кода.
- Сетевые запросы во время анализа.
- Выдача неполного результата как гарантированно полного.
- Рекомендация автоматического удаления публичных API.

---

# 25. План разработки на 15 рабочих дней

## Неделя 1 — Core и граф

**День 1**

- Инициализация monorepo.
- Пакеты core/cli/mcp.
- TypeScript configs.
- Vitest.
- CI.
- Базовые типы графа.

**День 2**

- Project discovery.
- Поиск tsconfig.
- Workspace detection.
- File scanner.
- Ignore rules.

**День 3**

- TypeScript AST extractor.
- Imports/exports.
- Symbol declarations.
- Source locations.
- Unit tests.

**День 4**

- Module resolution.
- tsconfig paths.
- Named/default exports.
- Barrel resolution.
- Alias handling.

**День 5**

- SQLite GraphStore.
- Graph edges.
- Reverse indexes.
- Первичный CLI index.
- Golden fixtures.

**Результат недели:** локальный граф файлов и экспортируемых символов, доступный через core API.

## Неделя 2 — Анализ и Git diff

**День 6**

- ReachabilityEngine.
- Production/test/story roots.
- Public API protection.
- SCC/cycle handling.

**День 7**

- ImpactEngine.
- Direct/transitive dependencies.
- Evidence chains.
- CLI impact.

**День 8**

- Next.js route discovery.
- Route associations.
- Related tests.
- Conservative dynamic handling.

**День 9**

- Git snapshot reader.
- HEAD/index/working tree.
- Changed files.
- Rename detection.
- Snapshot identity.

**День 10**

- Differential reachability.
- Newly orphaned exports.
- Broken references.
- Classification.
- CLI diff/orphans.

**Результат недели:** рабочий CLI, способный анализировать изменение и находить новые orphaned exports.

## Неделя 3 — MCP, Skill, качество

**День 11**

- MCP server.
- `br_status`.
- `br_resolve_symbol`.
- `br_impact`.

**День 12**

- `br_analyze_diff`.
- `br_explain`.
- Structured responses.
- Error handling.

**День 13**

- Инкрементальное обновление.
- Кэширование resolution.
- Snapshot consistency.
- Performance profiling.

**День 14**

- Agent Skill.
- Claude Code integration example.
- Codex integration example.
- Cursor integration example.
- README и документация.

**День 15**

- Полный regression suite.
- Benchmarks.
- Исправление критических ошибок.
- Release packaging.
- Публикация v0.1.0.

---

# 26. Definition of Done для MVP

MVP считается завершённым, когда выполнены все условия:

- [ ] Инструмент устанавливается локально из npm-пакета.
- [ ] Работает на macOS, Linux и Windows в заявленных версиях Node.js.
- [ ] Успешно индексирует TS/JS/React-проект.
- [ ] Поддерживает tsconfig paths.
- [ ] Разрешает named/default imports.
- [ ] Корректно обрабатывает основные barrel exports.
- [ ] Находит direct и transitive consumers.
- [ ] Определяет основные Next.js routes.
- [ ] Находит статически связанные тесты.
- [ ] Сравнивает HEAD и working tree.
- [ ] Находит новые orphaned exports в неизменённых файлах.
- [ ] Отличает новые находки от старого dead code.
- [ ] Отличает broken references от orphaned exports.
- [ ] Учитывает test-only и story-only usage.
- [ ] Защищает публичные API от ложных рекомендаций.
- [ ] Маркирует динамические и неразрешимые связи.
- [ ] Использует постоянный SQLite cache.
- [ ] Не выполняет полную переиндексацию при обычной локальной правке.
- [ ] Предоставляет CLI JSON output.
- [ ] Предоставляет MCP tools.
- [ ] Предоставляет Agent Skill.
- [ ] Возвращает evidence для verified findings.
- [ ] Не отправляет код во внешние сервисы.
- [ ] Не изменяет исходный код при анализе.
- [ ] Проходит обязательные regression fixtures.
- [ ] Публикует воспроизводимые benchmark results.

---

# 27. Ограничения первой версии

В README необходимо явно задокументировать:

1. Не гарантируется обнаружение произвольных runtime-зависимостей.
2. Не поддерживается полноценный interprocedural data-flow analysis.
3. React props через произвольные spreads/HOC могут анализироваться неполно.
4. Динамические пути импортов могут оставаться неизвестными.
5. Статические зависимости тестов не являются runtime coverage.
6. Публичные API могут иметь внешних потребителей.
7. CSS Modules в MVP анализируются преимущественно на уровне файловых зависимостей.
8. Не поддерживается полноценная семантика произвольных bundler plugins.
9. Анализ больших монорепозиториев может требовать предварительной индексации.
10. Инструмент не должен позиционироваться как гарантированно безопасный автоматический удалитель кода.

---

# 28. Ключевой демонстрационный сценарий

Для первого публичного релиза необходимо подготовить воспроизводимый demo-проект.

Исходное состояние:

```text
src/
├── app/
│   └── legacy/
│       └── page.tsx
├── components/
│   ├── LegacyChart.tsx
│   └── LegacyTable.tsx
├── hooks/
│   └── useLegacyData.ts
└── utils/
    └── legacyFormatter.ts
```

Маршрут `/legacy` использует `LegacyChart`, который вызывает `useLegacyData`.

`LegacyTable` используется только в Storybook.

После удаления маршрута агент запускает:

```bash
blastradius diff --base HEAD --target worktree
```

Ожидаемый смысл отчёта:

```text
BlastRadius — Differential Analysis

Changed files: 1
New orphaned exports: 3
Broken references: 0
Review required: 1

NEW ORPHAN
  useLegacyData
  src/hooks/useLegacyData.ts

  Reason:
  Last production consumer removed.

NEW ORPHAN
  LegacyChart
  src/components/LegacyChart.tsx

  Reason:
  No remaining production route reaches this symbol.

TEST/STORY ONLY
  LegacyTable
  src/components/LegacyTable.tsx

  Reason:
  Remaining consumer is Storybook.

REVIEW REQUIRED
  legacyFormatter
  src/utils/legacyFormatter.ts

  Reason:
  Possible dynamic property access.
```

Это иллюстративный expected output: каждое finding должно подтверждаться реальным графом demo-проекта.

**Демонстрация считается успешной**, если агент получает эту информацию одним MCP-вызовом, может запросить доказательства и не вынужден самостоятельно восстанавливать всю цепочку через десятки поисков.

---

# 29. Стратегия развития после MVP

## v0.2 — Semantic Accuracy

Приоритеты:

- Более глубокий TypeChecker integration.
- React prop graph.
- Call hierarchy.
- Namespace resolution.
- React Router adapters.
- Улучшенная обработка dynamic patterns.
- Более точное сопоставление символов между snapshots.

## v0.3 — Scale

Приоритеты:

- Профилирование крупных монорепозиториев.
- Оптимизация памяти.
- Watch mode.
- Более точная инвалидация графа.
- Быстрый AST backend на Oxc при подтверждённой необходимости.
- Опциональная интеграция SCIP.

## v0.4 — Agent Workflow

Приоритеты:

- CI integration.
- Pull request impact reports.
- Автоматизированные review suggestions.
- Test selection.
- Расширенные Skills.
- Более подробные dependency explanations.

---

# 30. Архитектурные принципы, которые нельзя нарушать

**1. Graph-first, а не grep-first.**

Основой системы должен быть сохраняемый граф зависимостей, а не выполнение поиска по файлам при каждом запросе.

**2. Evidence-first.**

Любое утверждение о зависимости должно быть связано с фактическими source locations или явно обозначенной эвристикой.

**3. Differential-first.**

Ключевая ценность — понимание последствий конкретного изменения, а не только полный список накопленного dead code.

**4. Conservative deletion.**

Неразрешённая динамическая связь, внешний API или потенциальный side effect должны блокировать безусловные рекомендации удаления.

**5. Incremental by design.**

Инкрементальность должна быть предусмотрена в модели графа и snapshots с самого начала, а не добавлена после реализации полного анализатора.

**6. MCP-native output.**

Формат результата должен проектироваться для кодинг-агента: компактный, детерминированный, структурированный и с явными ограничениями.

**7. Parser-independent core.**

Граф, алгоритмы и MCP-контракты не должны зависеть от конкретного AST-парсера.

**8. Local-only.**

Работа с исходным кодом выполняется исключительно в локальном окружении пользователя.

---

# 31. Итоговый результат разработки

К завершению MVP должны быть поставлены:

1. Рабочий npm CLI-пакет `blastradius`.
2. Локальное ядро анализа TypeScript/JavaScript.
3. Постоянный инкрементальный граф зависимостей.
4. Impact Analysis на уровне файлов и экспортируемых символов.
5. Differential Dead Code Analysis относительно Git.
6. MCP Server с пятью основными tools.
7. Agent Skill для использования в кодинг-агентах.
8. Тестовые fixtures и regression suite.
9. Benchmark suite.
10. README, документация архитектуры и примеры интеграции.

**Главный критерий успеха продукта:** после удаления или рефакторинга фичи кодинг-агент за один-два детерминированных запроса получает объяснимую карту последствий — какие части приложения затронуты, какие связи сломаны и какой код стал недостижимым именно в результате текущего изменения.

BlastRadius должен помогать агенту принимать более точные решения, а не принимать рискованные решения об удалении кода вместо него.