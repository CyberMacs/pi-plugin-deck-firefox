# GitHub közzététel (projektgazdának)

Előkészített cél:

- **Tulajdonos:** `CyberMacs`
- **Repository név:** `pi-plugin-deck-firefox`
- **Visibility:** `Public`
- **Leírás:** `Firefox-oldalsáv ChatGPT @plugin gyorsindításhoz: kategóriák, kedvencek, saját pluginlista frissítése.`
- **Licenc:** MIT, a `LICENSE` fájl már a csomagban van.

## Új repository létrehozása

1. Lépj be GitHubra, majd nyisd meg a [New repository](https://github.com/new) oldalt.
2. Owner: `CyberMacs`. Név: `pi-plugin-deck-firefox`.
3. Válaszd a **Public** opciót.
4. Jelöld be **Add a README file** lehetőséget. Így a GitHub-kapcsolattal a teljes előkészített csomagot fel tudjuk tölteni a már létező `main` ágra.
5. Kattints **Create repository**, majd add meg a létrejött repository linkjét a beszélgetésben.

## Kódfeltöltés

### Egyszerűen böngészőből

A létrehozott repositoryban válaszd **Add file → Upload files**, és töltsd fel a csomag tartalmát. A ZIP fájlt ne önmagában töltsd fel, hanem **kicsomagolva a benne található projektfájlokat és az `assets` mappát**. A meglévő README-t felül kell írni. Az olyan rejtett fájlokat, mint a `.gitignore`, külön ellenőrizd.

### GitHub-kapcsolaton keresztül (ajánlott)

A létrehozott repository linkjének megadása után a ChatGPT a kapcsolt GitHub-fiókon keresztül töltheti fel a már előkészített fájlokat. Nem kell helyben Git parancsokat futtatni. A meglévő README mintafájl lecserélésre kerül a projekt magyar README-jére.

## Ellenőrzés

- A README képernyőképe megjelenik.
- A `LICENSE`, `manifest.json`, `sidebar.js`, `content.js` látszik.
- A repository **Public**.
- A projekt nem adja ki magát hivatalos OpenAI-kiegészítőnek.
- A forrás ZIP nem aláírt Firefox-XPI. Az állandó telepítéshez Mozilla-aláírás szükséges.
