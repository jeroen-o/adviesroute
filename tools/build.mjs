// Genereert vaste routepagina's, sitemap, robots.txt, llms.txt en de statische
// SEO-blokken in index.html uit de routedata in index.html.
// Gebruik: node tools/build.mjs   (geen dependencies)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://adviesroute.nl";
const UPDATED = "2026-11-06";
const UPDATED_NL = "6 november 2026";

let index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const start = index.indexOf("// Gedeelde trajecten");
const end = index.indexOf("const lijst = ");
if (start < 0 || end < 0) throw new Error("Datablok niet gevonden in index.html");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(index.slice(start, end) + "\n;this.out = { D, PLAATSEN, LAND, ORDER, VERKEER, NEWS, EQUIP, EQ_LANDEN };", ctx);
const { D, PLAATSEN, LAND, ORDER, VERKEER, NEWS, EQUIP, EQ_LANDEN } = ctx.out;
const ST_LABEL = { v: "V", s: "S", a: "A", n: "–" };
const ST_TEXT = { v: "Verplicht", s: "Onder voorwaarden", a: "Aanbevolen", n: "Niet verplicht" };
const eqStatus = (item, c) => item.all || item.s[c] || ["n", ""];
function needItems(d) {
  const cs = countries(d).filter(c => EQ_LANDEN.includes(c));
  return EQUIP.map(it => {
    const v = cs.filter(c => eqStatus(it, c)[0] === "v"), s = cs.filter(c => eqStatus(it, c)[0] === "s");
    if (!v.length && !s.length) return null;
    const notes = [...new Set([...v, ...s].map(c => eqStatus(it, c)[1]).filter(Boolean))].slice(0, 2).join(" ");
    return { it, st: v.length ? "v" : "s", text: `${v.length ? "Verplicht in " + v.map(c => LAND[c]).join(", ") : ""}${v.length && s.length ? "; " : ""}${s.length ? "onder voorwaarden in " + s.map(c => LAND[c]).join(", ") : ""}.${notes ? " " + notes : ""}` };
  }).filter(Boolean);
}
function equipTable() {
  const head = `<thead><tr><th scope="col">Uitrusting</th>${EQ_LANDEN.map(c => `<th scope="col">${LAND[c]}</th>`).join("")}</tr></thead>`;
  const body = EQUIP.map(it => `<tr><td>${esc(it.n)}</td>${EQ_LANDEN.map(c => { const [st, nt] = eqStatus(it, c); const tip = ST_TEXT[st] + (nt ? ": " + nt : ""); return `<td><span class="st ${st}" title="${esc(tip)}" aria-label="${esc(LAND[c] + ", " + tip)}" tabindex="0">${ST_LABEL[st]}</span></td>`; }).join("")}</tr>`).join("");
  return head + `<tbody>${body}</tbody>`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtKm = n => n.toLocaleString("nl-NL");
const fmtTijd = t => { const [h, m] = t.split(":"); return `${Number(h)} uur ${m === "00" ? "" : m + " min"}`.trim(); };
const fmtTijdKort = t => { const [h, m] = t.split(":"); return `${h} u ${m}`; };
const laadstops = km => (km <= 300 ? 0 : Math.ceil((km - 300) / 250));
function countries(d) { return [...new Set(d.s.map(x => x[1]))]; }
const placesOf = d => PLAATSEN.filter(p => p.dest === d.id);
const roadsText = d => d.s.map(([r, c]) => `${r} (${LAND[c]})`).join(", ");
const tollText = d => d.toll.map(([, t]) => t).join(", ");
const laadText = d => { const n = laadstops(d.km); return n === 0 ? "geen snellaadstop onderweg" : `± ${n} snellaadstop${n > 1 ? "s" : ""} van 20 tot 30 minuten`; };

function cls(road, cc) {
  if (road === "Trein") return "r-train";
  const p = road.replace(/[-0-9].*/, "");
  if (p === "E") return "r-green";
  switch (cc) {
    case "NL": return p === "N" ? "r-yellow" : "r-red";
    case "DE": return p === "A" ? "r-blue de" : "r-yellow";
    case "LU": return "r-blue";
    case "AT": return (p === "A" || p === "S") ? "r-blue" : "r-white";
    case "CH": return p === "A" ? "r-red" : "r-blue";
    case "FR": return p === "D" ? "r-yellow" : "r-red";
    case "IT": return p === "A" ? "r-green" : "r-blue";
    case "ES": return (p === "AP" || p === "A") ? "r-blue" : "r-white";
  }
  return "r-white";
}
const badge = (r, c) => `<span class="r ${cls(r, c)}">${esc(r)}</span>`;

// Gedeelde stylesheet voor de routepagina's: dezelfde stijl als de startpagina
const css = index.match(/<style>([\s\S]*?)<\/style>/)[1] + `
/* Routepagina's */
.crumbs { display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 14px; }
.crumbs a { color: var(--asphalt-fg); opacity: .85; }
.page { padding-block: 24px 40px; }
.page h2.sec { font-family: var(--font-display); font-size: 21px; margin: 32px 0 12px; }
.page .lead { font-size: 16px; max-width: 70ch; }
.places { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 10px 24px; }
.places li { padding: 8px 0; border-bottom: 1px solid var(--line); }
.places li b { display: block; }
.places li span { color: var(--muted); font-size: 14px; }
.cta { display: inline-block; margin-top: 8px; padding: 12px 16px; border-radius: 8px; background: var(--accent); color: var(--surface); font-weight: 600; text-decoration: none; }
`;
fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "assets", "site.css"), css.trim() + "\n");

const headCommon = (title, desc, url, jsonld) => `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#232b33">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="article">
<meta property="og:locale" content="nl_NL">
<meta property="og:site_name" content="Adviesroute">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:modified_time" content="${UPDATED}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/assets/og.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;600;800&family=Overpass+Mono:wght@500;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`;

function routeFaq(d) {
  const pl = placesOf(d);
  return [
    [`Hoe ver is het naar ${d.n}?`, `Vanaf Utrecht is het ± ${fmtKm(d.km)} km naar ${d.n} (${d.p}). Zonder pauzes en file rijd je er ± ${fmtTijd(d.t)} over.`],
    [`Welke wegen neem je naar ${d.n}?`, `De adviesroute loopt via ${roadsText(d)}. Laatste stuk: ${d.s.at(-1)[2]}${d.s.at(-1)[3] ? ` (${d.s.at(-1)[3]})` : ""}.`],
    [`Heb je tol of een vignet nodig op weg naar ${d.n}?`, `${tollText(d)}. Controleer de actuele tarieven en regels bij de officiële tolbeheerder voordat je vertrekt.`],
    [`Hoeveel laadstops heb je nodig met een elektrische auto?`, `Met een praktijkbereik van ongeveer 300 km op de snelweg reken je op ${laadText(d)}. Met caravan, in de winter of met veel klimmen zijn het er meer.`],
    [`Wat moet je verplicht in de auto hebben op weg naar ${d.n}?`, needItems(d).filter(x => x.st === "v").map(x => `${x.it.n} (${x.text.replace(/\.$/, "").split(".")[0].replace(/^Verplicht in /, "")})`).join(", ") + ". Onder voorwaarden: " + needItems(d).filter(x => x.st === "s").map(x => x.it.n.toLowerCase()).join(", ") + "."],
    [`Wat is een goed alternatief bij file?`, d.alt.tx],
    ...(pl.length ? [[`Welke plaatsen bereik je via deze route?`, `Via de route naar ${d.n} bereik je onder meer ${pl.slice(0, 10).map(p => p.n).join(", ")}${pl.length > 10 ? ` en nog ${pl.length - 10} andere plaatsen` : ""}.`]] : [])
  ];
}

function routePage(d) {
  const url = `${SITE}/route/${d.id}/`;
  const pl = placesOf(d);
  const title = `Route naar ${d.n} vanuit Nederland | Adviesroute`;
  const mainRoads = [...new Set(d.s.map(x => x[0]).filter(r => /^(A|AP|E)\d/.test(r) || /^A-?\d/.test(r)))].slice(0, 6).join(", ");
  const desc = `Autoroute naar ${d.n}: ± ${fmtKm(d.km)} km, ± ${fmtTijdKort(d.t)} vanaf Utrecht via ${mainRoads}. Met tol, vignet, file-alternatief en laadstops.`;
  const faq = routeFaq(d);
  const related = D.filter(x => x.c === d.c && x.id !== d.id);
  const links = countries(d).flatMap(c => (VERKEER[c] || []).map(([n, u]) => `<a href="${u}" rel="noopener" target="_blank">${LAND[c]}: ${esc(n)}</a>`)).join("");
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": url, url, name: title, description: desc, inLanguage: "nl-NL", dateModified: UPDATED,
        isPartOf: { "@id": `${SITE}/#website` }, breadcrumb: { "@id": url + "#breadcrumb" },
        about: { "@type": "TouristDestination", name: d.n, description: d.p,
          containedInPlace: { "@type": "Country", name: LAND[d.c] },
          containsPlace: pl.map(p => ({ "@type": "Place", name: p.n })) } },
      { "@type": "BreadcrumbList", "@id": url + "#breadcrumb", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Adviesroute", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: LAND[d.c], item: `${SITE}/#alle-routes` },
        { "@type": "ListItem", position: 3, name: `Route naar ${d.n}`, item: url } ] },
      { "@type": "FAQPage", "@id": url + "#faq", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
    ]
  };
  return `${headCommon(title, desc, url, jsonld)}
<body>
<div class="news" role="region" aria-label="Nieuws"><div class="wrap"><span class="news-label">Nieuws</span><div class="news-text"><a href="/${NEWS[0].h}">${esc(NEWS[0].t)}</a> <small>${esc(NEWS[0].d)}</small></div></div></div>
<header class="road">
  <div class="wrap">
    <nav class="crumbs" aria-label="Kruimelpad"><a href="/">Adviesroute</a><span aria-hidden="true">›</span><a href="/#alle-routes">${LAND[d.c]}</a><span aria-hidden="true">›</span><span>${esc(d.n)}</span></nav>
    <h1>Route naar ${esc(d.n)}</h1>
    <p>${esc(d.p)} · ± ${fmtKm(d.km)} km · ± ${fmtTijdKort(d.t)} vanaf Utrecht</p>
  </div>
</header>
<main class="wrap page">
  <article class="detail">
    <p class="lead">De adviesroute van Utrecht naar ${esc(d.n)} is ± ${fmtKm(d.km)} km lang en kost zonder pauzes en file ± ${fmtTijd(d.t)}. Je rijdt via ${d.s.map(([r]) => esc(r)).join(", ")}.</p>
    <div class="summary" aria-label="Wegen in volgorde">${d.s.map(([r, c]) => badge(r, c)).join('<span class="arrow">›</span>')}</div>
    <div class="toll">${d.toll.map(([k, t]) => `<span class="pill ${k}">${esc(t)}</span>`).join("")}</div>

    <h2 class="sec">Hoofdroute vanaf Utrecht</h2>
    <ol class="route">
      ${d.s.map(([r, c, t, nt]) => `<li><div class="sign">${badge(r, c)}</div><div class="txt"><b>${esc(t)}<span class="cc">${c}</span></b>${nt ? `<span>${esc(nt)}</span>` : ""}</div></li>`).join("\n      ")}
      <li><div class="sign"><span class="r r-dest">Doel</span></div><div class="txt"><b>${esc(d.p)}</b></div></li>
    </ol>

    <h2 class="sec">Alternatief bij file</h2>
    <div class="alt"><p>${esc(d.alt.tx)}</p><div class="roads">${d.alt.r.map(([r, c]) => badge(r, c)).join("")}</div></div>

    <h2 class="sec">Goed om te weten</h2>
    <ul class="tips">${d.tips.map(t => `<li>${esc(t)}</li>`).join("")}
      <li>Elektrisch: reken op ${laadText(d)} bij een praktijkbereik van ongeveer 300 km. <a href="/#laden">Meer over laden onderweg</a></li>
    </ul>

    <h2 class="sec">Verplicht in je auto op deze route</h2>
    <ul class="need-list">${needItems(d).map(x => `<li><span class="st ${x.st}">${ST_LABEL[x.st]}</span><div><b>${esc(x.it.n)}</b> <span>${esc(x.text)}</span></div></li>`).join("")}</ul>
    <p class="note" style="margin-top:8px"><a href="/#in-de-auto">Volledig overzicht per land</a></p>

    <h2 class="sec">Live verkeer en verkeersinformatie</h2>
    <p><a class="cta" href="/#${d.id}">Bekijk live meldingen op deze route</a></p>
    <div class="links" style="margin-top:12px">${links}</div>

    ${pl.length ? `<h2 class="sec">Plaatsen bereikbaar via deze route</h2>
    <ul class="places">${pl.map(p => `<li id="${p.id}"><b>${esc(p.n)}</b><span>${esc(p.leg)}</span></li>`).join("")}</ul>` : ""}

    <h2 class="sec">Veelgestelde vragen</h2>
    <div class="faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>

    ${related.length ? `<h2 class="sec">Andere routes naar ${LAND[d.c]}</h2>
    <div class="links">${related.map(x => `<a href="/route/${x.id}/">${esc(x.n)}</a>`).join("")}</div>` : ""}

    <div class="disclaimer"><strong>Indicatief.</strong> Afstanden en reistijden zijn berekend vanaf Utrecht, zonder pauzes, laadstops en file. Wegwerkzaamheden en tol-, vignet- en laadtarieven veranderen per seizoen. Controleer vóór vertrek de actuele situatie in je navigatie en bij de officiële bronnen.</div>
  </article>
</main>
<footer class="wrap">Laatst bijgewerkt: <time datetime="${UPDATED}">${UPDATED_NL}</time> · <a href="/">Alle adviesroutes</a> · <a href="/#praktisch">Tol en regels per land</a></footer>
</body>
</html>
`;
}

// 1. Routepagina's
for (const d of D) {
  const dir = path.join(ROOT, "route", d.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), routePage(d));
}

// 2. Statische blokken in index.html
const routeIndex = `<div class="route-index">${ORDER.map(c => `<div><h3>${LAND[c]}</h3><ul>${D.filter(d => d.c === c).map(d => `<li><a href="/route/${d.id}/">Route naar ${esc(d.n)}</a></li>`).join("")}</ul></div>`).join("")}</div>`;

const siteFaq = [
  ["Welke route neem je naar Oostenrijk?", "Vanuit Midden- en Oost-Nederland rijd je meestal via Arnhem (A12), de Duitse A3 tot Nürnberg en de A9 naar München. Voor Tirol ga je daarna via de A8 en A93 naar Kufstein, voor Salzburgerland en Karinthië via de A8 naar Salzburg. Vanuit Zuid-Nederland is de route via Venlo, de A61 en Stuttgart een goed alternatief."],
  ["Heb je een vignet nodig in Oostenrijk en Zwitserland?", "Ja. In Oostenrijk is een vignet verplicht op de Autobahn en Schnellstraße; een online gekocht digitaal vignet is voor consumenten pas na 18 dagen geldig. Voor enkele tunnels en de Brennerautobahn betaal je extra tol. In Zwitserland is een vignet van CHF 40 per kalenderjaar verplicht op alle snelwegen; het e-vignet is direct geldig."],
  ["Betaal je tol in Duitsland?", "Nee. Personenauto's betalen in Duitsland geen tol en geen vignet. In veel steden heb je wel een groene Umweltplakette nodig voor de milieuzone."],
  ["Wat is de snelste route naar Italië?", "Naar het Gardameer, de Dolomieten, Venetië en Toscane is de route via München, Kufstein en de Brenner meestal het snelst. Naar het Comomeer en Lago Maggiore rijd je via Basel en de Gotthard. Bij file voor de Gotthard is de San Bernardino een alternatief."],
  ["Is de AP-7 in Spanje tolvrij?", "De AP-7 langs de Spaanse Middellandse Zeekust is sinds 2020–2021 grotendeels tolvrij. In Frankrijk betaal je onderweg wel péage."],
  ["Hoeveel laadstops heb je nodig met een elektrische auto?", "Met een praktijkbereik van ongeveer 300 km op de snelweg en laden van 10 tot 80 procent reken je op één snellaadstop per 250 km. Naar Oostenrijk (± 950 km) zijn dat er ongeveer drie, naar Zuid-Frankrijk of Italië vier, naar de Costa Blanca zeven."],
  ["Wanneer is het het drukst op weg naar het zuiden?", "Op zaterdagen in juli en augustus, vooral rond Köln, Frankfurt, München, Lyon, het Inntal en de Gotthard. In het wintersportseizoen zijn de zaterdagen rond Kufstein, Salzburg en de Fernpass het drukst. Vertrek op een doordeweekse dag of 's nachts."],
  ["Wat moet je verplicht in de auto hebben in het buitenland?", "Dat verschilt per land. Een veiligheidshesje is verplicht in België, Luxemburg, Duitsland, Oostenrijk, Frankrijk, Italië en Spanje. Een gevarendriehoek is verplicht in onder meer België, Duitsland, Oostenrijk, Zwitserland, Frankrijk en Italië. Een verbanddoos is verplicht in Duitsland en Oostenrijk. In Oostenrijk en Zwitserland heb je een vignet nodig, en in Italië en Spanje een rood-wit waarschuwingsbord als je fietsendrager uitsteekt. Neem altijd je rijbewijs, kentekenbewijs en verzekeringsbewijs mee."],
  ["Hoe actueel zijn de verkeersmeldingen?", "De meldingen en afsluitingen op Duitse Autobahnen worden live opgehaald bij Die Autobahn GmbH des Bundes zodra je een route opent. Voor de andere landen verwijst de site naar de officiële verkeerscentrales."]
];
const faqHtml = siteFaq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n");
const indexJsonld = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: SITE + "/", name: "Adviesroute", inLanguage: "nl-NL",
      description: "Adviesroutes vanuit Nederland naar vakantiebestemmingen in Duitsland, Oostenrijk, Zwitserland, Frankrijk, Italië en Spanje." },
    { "@type": "WebPage", "@id": `${SITE}/#webpage`, url: SITE + "/", name: "Adviesroute: de beste autoroute naar je vakantiebestemming", inLanguage: "nl-NL", dateModified: UPDATED, isPartOf: { "@id": `${SITE}/#website` } },
    { "@type": "ItemList", "@id": `${SITE}/#routes`, name: "Adviesroutes", numberOfItems: D.length,
      itemListElement: D.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: `Route naar ${d.n}`, url: `${SITE}/route/${d.id}/` })) },
    { "@type": "FAQPage", "@id": `${SITE}/#vragen`, mainEntity: siteFaq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
  ]
};
const replaceBlock = (src, name, content) => src.replace(new RegExp(`<!-- ${name}:START -->[\\s\\S]*?<!-- ${name}:END -->`), `<!-- ${name}:START -->${content}<!-- ${name}:END -->`);
index = replaceBlock(index, "ROUTES", routeIndex);
index = replaceBlock(index, "FAQ", faqHtml);
index = replaceBlock(index, "EQUIP", equipTable());
index = replaceBlock(index, "JSONLD", `<script type="application/ld+json">${JSON.stringify(indexJsonld)}</script>`);
fs.writeFileSync(path.join(ROOT, "index.html"), index);

// 3. Sitemap, robots, llms.txt
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${UPDATED}</lastmod></url>
${D.map(d => `  <url><loc>${SITE}/route/${d.id}/</loc><lastmod>${UPDATED}</lastmod></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);
fs.writeFileSync(path.join(ROOT, "llms.txt"), `# Adviesroute

> Adviesroute (adviesroute.nl) geeft adviesroutes met de auto vanuit Nederland naar ${D.length} vakantieregio's en ${PLAATSEN.length} plaatsen in Duitsland, Oostenrijk, Zwitserland, Frankrijk, Italië en Spanje. Per route: de wegen in volgorde, afstand en rijtijd vanaf Utrecht, tol en vignet, een alternatief bij file, laadstops voor elektrische auto's en de plaatsen in de regio. Afstanden en rijtijden zijn indicatief. Laatst bijgewerkt: ${UPDATED}.

## Verplicht in de auto
${EQUIP.map(it => `- ${it.n}: ${EQ_LANDEN.map(c => `${LAND[c]} ${ST_TEXT[eqStatus(it, c)[0]].toLowerCase()}`).join(", ")}.`).join("\n")}

## Algemeen
- [Startpagina met live verkeer, laden, tol en regels per land](${SITE}/)
- Duitsland: geen tol voor personenauto's. Oostenrijk: vignet verplicht, extra tol voor Brenner (A13), Tauern- en Katschbergtunnel (A10) en Arlbergtunnel. Zwitserland: vignet CHF 40 per jaar. Frankrijk en Italië: tol per traject. Spanje: AP-7 grotendeels tolvrij.

${ORDER.map(c => `## ${LAND[c]}
${D.filter(d => d.c === c).map(d => `- [Route naar ${d.n}](${SITE}/route/${d.id}/): ${d.p}. ± ${fmtKm(d.km)} km, ± ${fmtTijdKort(d.t)} vanaf Utrecht via ${d.s.map(x => x[0]).join(" → ")}. ${tollText(d)}. Plaatsen: ${placesOf(d).map(p => p.n).join(", ")}.`).join("\n")}`).join("\n\n")}
`);

console.log(`Gebouwd: ${D.length} routepagina's, ${PLAATSEN.length} plaatsen, sitemap, robots.txt, llms.txt`);
