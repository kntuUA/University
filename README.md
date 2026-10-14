# ЦНТУ — сайт вступної кампанії

Статичний сайт для абітурієнтів Центральноукраїнського національного технічного університету: головна сторінка, «нічна» 404 і прихований архів. Шість мов інтерфейсу (`uk`, `en`, `pl`, `de`, `es`, `ja`), світла й темна теми, повна доступність з клавіатури. Без JavaScript сторінка теж повністю придатна.

**Збірка не потрібна.** Сайт працює при відкритті `index.html` напряму з диска (`file://`), на GitHub Pages (`/University/`) і на будь-якому статичному хостингу.

## Структура

```
index.html · 404.html · secret.html   сторінки
assets/css/   стилі: джерела base/ components/ features/ pages/ → згенерований main.css
assets/js/    window.CNTU: core/ → boot.js, components/ + features/ → app.js, pages/, i18n/
assets/fonts · assets/img · assets/icons
scripts/      build, перевірки, мок-сервер GitHub Pages, тест-раннер, visual diff
tests/        браузерні тести (e2e/*.test.mjs) і спільні хелпери
docs/         ARCHITECTURE.md · SECRETS.md (спойлери) · CHANGELOG.md
```

Детально — у [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): дерево, діаграма модулів, потоки даних (тема, мова, події) і як додати мову, пасхалку чи сторінку.

## Запуск

```
python3 -m http.server 8000        # або просто відкрити index.html
npm run serve:pages                # мок GitHub Pages: http://127.0.0.1:8000/University/ + 404 зі статусом 404
```

## Розробка (необов'язково)

Node.js потрібен лише для інструментів; `node_modules` у git не потрапляють.

```
npm install
npm run build      # склеїти assets/css/main.css, assets/js/boot.js, assets/js/app.js із джерел
npm run lint       # build --check · Prettier · ESLint · Stylelint · html-validate · check-head · i18n-check
npm test           # 13 наборів у headless Chrome (CHROME_PATH або google-chrome/chromium з PATH); ONLY=terminal,matrix
```

Редагуйте **джерела** (`assets/css/{base,components,features}`, `assets/js/{core,components,features}`), а не згенеровані `main.css`/`boot.js`/`app.js` — після змін `npm run build` і закомітьте результат.

## Нотатки

- **404 на GitHub Pages.** `404.html` віддається на будь-якій глибині URL, тому ресурси додає інлайн-скрипт з обчисленим коренем. Якщо репозиторій перейменовано — змініть `REPO` у `404.html`. Нічна версія показується з 00:00 до 04:59 за місцевим часом (`?night=1` / `?night=0` для перевірки).
- **Preload шрифту** залишено в розмітці свідомо (без нього Lighthouse mobile: Performance 97 → 82). На `file://` Chrome пише в консоль помилку CORS для preload — шрифт усе одно вантажиться через CSS.
- **SEO.** Одна URL-адреса, переклад на клієнті — без `hreflang`. Перед публікацією на іншому домені оновіть `canonical`, `og:url`, `og:image`, `sitemap.xml`.
- **Пасхалки** описано в [docs/SECRETS.md](docs/SECRETS.md) (спойлери).
