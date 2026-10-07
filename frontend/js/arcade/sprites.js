/**
 * Arcade sprites: small pixel-art drawings as inline SVG (no image files).
 * A sprite is rows of characters; each character is a colour from its palette
 * and "." is see-through. Used by the Larong Pinoy games.
 *
 *   ArcadeSprites.sprite("kid", { t: "#e11d48" }, { cls: "my-kid" }) -> "<svg …>"
 */
(function (global) {
  "use strict";

  var SPRITES = {
    // A child, front view. h hair, s skin, e eyes, m mouth, t shirt, p shorts, o shoes
    kid: {
      rows: [
        "...hhhhhh...",
        "..hhhhhhhh..",
        "..hssssssh..",
        "..sesssses..",
        "..ssssssss..",
        "...smmmms...",
        "....ssss....",
        "..tttttttt..",
        ".sttttttttS.",
        ".sttttttttS.",
        ".s.tttttt.S.",
        "...pppppp...",
        "...pp..pp...",
        "...ss..ss...",
        "...ss..ss...",
        "..ooo..ooo..",
      ],
      palette: { h: "#2b1b10", s: "#c68a5a", S: "#c68a5a", e: "#111111", m: "#7a3b2a", t: "#2563eb", p: "#1e293b", o: "#f8fafc" },
    },
    // A child climbing: arms up
    climber: {
      rows: [
        ".s........s.",
        ".s.hhhhhh.s.",
        ".shhhhhhhhs.",
        ".shsssssshs.",
        ".ssessssess.",
        "..ssssssss..",
        "...smmmms...",
        "..tttttttt..",
        "..tttttttt..",
        "..tttttttt..",
        "...pppppp...",
        "...pp..pp...",
        "..ss....ss..",
        ".oo......oo.",
      ],
      palette: { h: "#2b1b10", s: "#c68a5a", e: "#111111", m: "#7a3b2a", t: "#2563eb", p: "#1e293b", o: "#f8fafc" },
    },
    // Cowrie shell (sigay)
    shell: {
      rows: [
        "..wwww..",
        ".wwwwww.",
        "wwbwwbww",
        "wwwbbwww",
        ".wwwwww.",
        "..wwww..",
      ],
      palette: { w: "#f4ead2", b: "#9a7b4f" },
    },
    // Tin can (lata)
    can: {
      rows: [
        ".gggggggg.",
        "gllllllllg",
        "gggggggggg",
        "rrrrrrrrrr",
        "ryyyyyyyyr",
        "ryrrrrrryr",
        "ryyyyyyyyr",
        "rrrrrrrrrr",
        "gggggggggg",
        "gllllllllg",
        ".gggggggg.",
      ],
      palette: { g: "#94a3b8", l: "#e2e8f0", r: "#dc2626", y: "#facc15" },
    },
    // Rubber slipper (tsinelas), seen from above
    slipper: {
      rows: [
        "..wwwwwwww..",
        ".wwbwwwwbww.",
        "wwwwbwwbwwww",
        "wwwwwbbwwwww",
        "wwwwwwwwwww.",
        ".wwwwwwwww..",
      ],
      palette: { w: "#f8fafc", b: "#2563eb" },
    },
    // Prize bag (premyo) at the top of the pole
    prize: {
      rows: [
        "...rrrr...",
        "....rr....",
        "..yyyyyy..",
        ".yyyyyyyy.",
        "yyyddddyyy",
        "yyydyyyyyy",
        "yyyddddyyy",
        "yyyyyydyyy",
        "yyyddddyyy",
        ".yyyyyyyy.",
        "..yyyyyy..",
      ],
      palette: { r: "#dc2626", y: "#fbbf24", d: "#92400e" },
    },
    // Word Clash's dragon: bat wings, horns, angry eyes, open mouth with fangs
    dragon: {
      rows: [
        ".....oy..........yo.....",
        ".....oyy...yo...yyo.....",
        "......oyy..yy..yyo......",
        "qp....oooooooooooo....pq",
        "pqp.oggggggggggggggo.pqp",
        "ppqoggooggggggggooggoqpp",
        "pqpogggwooggggoowgggopqp",
        ".pqogggwwkggggkwwgggoqp.",
        ".ppoddggwkggggkwggddopp.",
        "..poddggglollolgggddop..",
        "...oddgggllllllgggddo...",
        "....orwrrrrrrrrrrwro....",
        "....orwrmmmmmmmmrwro....",
        ".....rrrrwrwwrwrrrr.....",
        ".....oooooooooooooo.....",
        "....gogggyyyyyygggog....",
        "...ggogggbbbbbbgggogg...",
        "...o..gggyyyyyyggg..o...",
        "......dddd....dddd......",
        ".....oooooo..oooooo.....",
      ],
      palette: {
        o: "#0f2e1f", g: "#2fbf71", d: "#1b7f4a", l: "#5fd892", y: "#ffd166", b: "#e9b949",
        w: "#ffffff", k: "#111111", r: "#7a1426", m: "#c0263c", p: "#7c3aed", q: "#4c1d95",
      },
    },
    // Robot opponent
    bot: {
      rows: [
        "....aa....",
        "....aa....",
        ".hhhhhhhh.",
        "hhhhhhhhhh",
        "hvvvvvvvvh",
        "hveevveevh",
        "hvvvvvvvvh",
        "hhhhhhhhhh",
        "hhgggggghh",
        ".hhhhhhhh.",
      ],
      palette: { a: "#f43f5e", h: "#cbd5e1", v: "#334155", e: "#67e8f9", g: "#64748b" },
    },
  };

  /** Draws character rows as an SVG (runs of one colour become one rect). */
  function svg(rows, palette, opts) {
    var o = opts || {};
    var width = rows.reduce(function (w, r) {
      return Math.max(w, r.length);
    }, 0);
    var rects = [];
    rows.forEach(function (row, y) {
      var x = 0;
      while (x < row.length) {
        var ch = row[x];
        if (ch === "." || !palette[ch]) {
          x++;
          continue;
        }
        var start = x;
        while (x < row.length && row[x] === ch) x++;
        rects.push('<rect x="' + start + '" y="' + y + '" width="' + (x - start) + '" height="1" fill="' + palette[ch] + '"/>');
      }
    });
    return (
      '<svg class="' + (o.cls || "") + '" viewBox="0 0 ' + width + " " + rows.length +
      '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + rects.join("") + "</svg>"
    );
  }

  function sprite(name, colors, opts) {
    var s = SPRITES[name];
    if (!s) return "";
    return svg(s.rows, Object.assign({}, s.palette, colors || {}), opts);
  }

  /* Generic kids for opponents: shirt, hair and skin colours. */
  var KIDS = [
    { t: "#dc2626", h: "#1f130b", s: "#b9774a", S: "#b9774a" },
    { t: "#16a34a", h: "#3b2414", s: "#d29a6a", S: "#d29a6a" },
    { t: "#f59e0b", h: "#120c08", s: "#a8683f", S: "#a8683f" },
    { t: "#9333ea", h: "#2b1b10", s: "#c68a5a", S: "#c68a5a" },
    { t: "#0891b2", h: "#1f130b", s: "#9c5f37", S: "#9c5f37" },
  ];

  global.ArcadeSprites = { svg: svg, sprite: sprite, SPRITES: SPRITES, KIDS: KIDS };
})(window);
