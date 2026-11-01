# 🦉 Szóláskaland

Szólás- és közmondás-kvízjáték 4. osztályosoknak, a felvételire készüléshez.
Érintőképernyőn is kényelmesen játszható, és minden megfejtés után elmagyarázza a szólás jelentését.

**▶ Játék:** https://szabovin.github.io/szolaskaland/

## Mit tud?

- **150 szólás és közmondás**, 15 feladattípus-csoportban (állatos, testrészes, számos, „pótold a hiányzó szót”, „folytasd” stb.)
- **Kaland**: 10 feladatos körök, mindig új és ismétlendő szólásokkal vegyesen
- **Villámkör**: 1 vagy 3 perces időre játszott kör, mindkettőnek külön rekordja van
- **Témák**: egy kiválasztott feladatcsoport gyakorlása
- **Album**: az összes szólás a jelentésével és a magyarázatával együtt
- **Szülői sarok**: haladás, a legtöbbször elrontott szólások, nullázás

## Hogyan tanít?

Minden szólásnak van egy szintje 1-től 6-ig. Jó válasz után a szólás szintet lép, és egyre nehezebb feladattípusban jön elő:

1. hiányzó szó kiválasztása
2. jelentés kiválasztása
3. fordított kérdés (a jelentéshez kell megtalálni a szólást)
4. szórendi kirakó
5. betűkirakó
6. ⭐ mester – ekkor már csak időnként jön vissza ismétlésre

Rossz válasz után a szólás egy szintet visszalép, és még ugyanabban a körben újra előkerül.
A játékot pontok, kombószorzó, csillagok, rangok, napi sorozat, hangok, konfetti és felolvasás (🔊) teszik változatossá.

## Haladás mentése

A haladás a böngészőben mentődik (localStorage), külön minden gépen és böngészőben.
Az inkognitó ablak bezárásakor, illetve a böngészőadatok törlésekor a haladás elvész.

## Futtatás helyben

Nem kell hozzá telepíteni semmit: töltsd le a fájlokat, és nyisd meg az `index.html`-t a böngészőben.
A három fájlnak (`index.html`, `jatek.js`, `adatok.js`) ugyanabban a mappában kell lennie.

## Felépítés

| Fájl | Tartalom |
|---|---|
| `index.html` | képernyők és stílusok |
| `jatek.js` | játéklogika, pontozás, mentés |
| `adatok.js` | a szólások, jelentések és magyarázatok |

## Források

A szólásokat egy felvételi gyakorlófeladatsor alapján gyűjtöttük össze, és összevetettük Paczolay Gyula *750 magyar közmondás* című gyűjteményével, a Wikiforrás „Közmondások” oldalával, valamint szólásgyűjteményekkel és értelmező szótárakkal.
Ha hibát találsz, nyiss egy issue-t.
