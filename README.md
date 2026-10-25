# 89values

Web-App, die die persönlichen Top-Werte ermittelt. Aus 200 Werten (13 Bereiche, jeweils mit Beschreibung) stehen immer zwei im Duell, ein Tipp entscheidet. Am Ende erscheinen die Top 3, dazu Platz 4 und 5.

Mobile first, statisches HTML/CSS/JavaScript ohne Build. Hell- und Dunkelmodus folgen der Systemeinstellung, jeder Bereich hat eine eigene Farbe.

## Starten

`index.html` im Browser öffnen oder den Ordner auf einem beliebigen statischen Hosting bereitstellen. Der Fortschritt wird im Browser (`localStorage`) gespeichert, die App lässt sich pausieren und fortsetzen.

## Methode

Alle Paare zu vergleichen wären 19.900 Duelle. Deshalb:

1. **Vorrunde (100 Duelle):** Jeder Wert tritt einmal gegen einen zufälligen anderen an. Gleichnamige Werte aus verschiedenen Bereichen treffen nie aufeinander.
2. **Gezielte Duelle:** Danach spielen nur Werte, die noch unter die Top 5 kommen könnten. Gewählt wird zufällig unter den unsichersten, der Gegner unter den fünf ähnlichsten.

Die Rangliste wird nach jedem Duell mit dem Bradley-Terry-Modell neu geschätzt (wie Elo, aber über alle Duelle gemeinsam). Wer gegen starke Werte gewinnt, steigt mehr.

Standard sind 250 Duelle, etwa 8 bis 10 Minuten. In einer Simulation mit 250 Duellen lagen die angezeigten Top 3 in rund 85 % der Fälle in den tatsächlichen Top 10, bei 300 Duellen in rund 94 %. Ab 100 Duellen kann vorzeitig ausgewertet werden, „Genauer machen" ergänzt 50 weitere Duelle.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Oberfläche und Ablauf |
| `rank.js` | Paarbildung und Wertung |
| `data/werte.js` | die 200 Werte (aus `werte_tabelle.csv` erzeugt) |
