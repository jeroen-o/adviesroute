# Adviesroute

Bron van [adviesroute.nl](https://adviesroute.nl): adviesroutes met de auto vanuit Nederland naar vakantieregio's in Duitsland, Oostenrijk, Zwitserland, Frankrijk, Italië en Spanje.

- `index.html` – interactieve routeplanner (zoeken, live Duitse verkeersmeldingen, laden, tol). Alle routedata staat in het script in dit bestand.
- `route/<regio>/` – vaste, doorzoekbare pagina per route (gegenereerd).
- `sitemap.xml`, `robots.txt`, `llms.txt`, `assets/site.css` – gegenereerd.

## Na het wijzigen van routedata

```bash
node tools/build.mjs
```

Dit genereert de routepagina's, sitemap, robots.txt, llms.txt en de statische blokken (alle routes, FAQ, structured data) in `index.html`. Geen dependencies nodig.
