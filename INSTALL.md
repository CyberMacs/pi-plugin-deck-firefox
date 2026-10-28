# Telepítés és frissítés

## A. Ideiglenes fejlesztői telepítés

1. A GitHub projektoldalon válaszd: **Code → Download ZIP**.
2. Csomagold ki egy tetszőleges mappába.
3. Firefoxban nyisd meg: `about:debugging#/runtime/this-firefox`.
4. **Load Temporary Add-on** → válaszd a `manifest.json` fájlt.
5. A Firefox oldalsávján nyisd meg a *Pi Plugin Deck*-et, és használd a ChatGPT mellett.

Ez a telepítés **nem állandó**. A böngésző újraindításakor általában újra be kell tölteni.

## B. Állandó telepítés Firefox Desktopban

A normál Firefox aláírt kiegészítőket igényel. Ehhez a Mozilla [Add-on Developer Hub](https://addons.mozilla.org/developers/) oldalán a projekt kiadható *Unlisted / On your own* módon, vagy aláírt XPI-t biztosíthat a karbantartó.

- **Nem listázott** nem azt jelenti, hogy a kódot a Mozilla nem ellenőrzi.
- A GitHub forráskód ZIP-je nem egyenlő aláírt XPI-vel.
- Csak megbízható forrásból származó, valóban Mozilla által aláírt `.xpi` fájlt telepíts.
- Az aláírt `.xpi` Firefoxban: `about:addons` → fogaskerék → **Install Add-on From File**.

### Átváltás ideiglenes telepítésről

1. A régi Deck oldalsávjában készíts **JSON exportot** (beállítások/kategóriák biztonsági mentése).
2. Távolítsd el a régi ideiglenes példányt az `about:debugging` oldalon.
3. Telepítsd az aláírt XPI-t, majd szükség esetén **importáld** a JSON-mentést.
4. Ellenőrizd a kategóriákat, a kedvenceket és a `@`-beillesztést.

**Beállítások:** a telepített Deck `browser.storage.local` tárolóban tartja őket, ezért böngésző-újraindítás után megmaradnak. A kiegészítő eltávolításakor az adatok elveszhetnek; frissítés előtt célszerű JSON exportot készíteni.

## Saját pluginok frissítése

1. ChatGPT-fiókba bejelentkezve nyisd meg: `https://chatgpt.com/plugins?directoryTab=personal&category=plugins-created-by-you`.
2. Várd meg, amíg a lista megjelenik.
3. A Deck oldalsávjában kattints: **↻ Sajátak frissítése**.
4. Ellenőrizd és fogadd el a felkínált neveket.

A szinkronizálás a látható oldalszerkezetre épül, ezért a ChatGPT változásai megtörhetik. Ha nem talál neveket, a **Diagnosztika** segít a hiba azonosításában. A kimásolt diagnosztikát megosztás előtt olvasd át.

## Kompatibilitás

A projekt Firefox Desktop oldalsávra készült. A v0.2.3-ban a manifest legalább Firefox 128-at jelöl, de az adatgyűjtési engedélynyilatkozatot újabb Firefox-verziók értelmezik; ezért **Firefox 140 vagy újabb** javasolt. Android-kompatibilitás nem célja a kiadásnak.
