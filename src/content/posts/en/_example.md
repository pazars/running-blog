---
# TODO: replace this placeholder front matter with the real article copy.
# All text below is lorem-ipsum filler (per the no-AI content policy); only the
# structure exists to show how an English post is wired.
#
# The `_` filename prefix keeps this file OUT of the build (see the loader glob
# in src/content.config.ts). Copy it to a name without the prefix to publish.
#
# WHERE THIS FILE LIVES MATTERS: English posts go in src/content/posts/en/.
# The locale is derived from the directory (src/i18n/posts.ts -> localeOf), so
# there is no `lang` frontmatter field to forget or contradict. Latvian posts
# stay flat in src/content/posts/.
title: "Tempor incididunt sit velit"
subtitle: "Duis fugiat minim aute consequat ea voluptate adipisicing proident."
summary: "Magna fugiat tempor id nulla tempor proident sint."
# English slug: it becomes the URL segment AND the D1 view-counter key, so it
# must be unique across every locale (assertPostInvariants() fails the build
# otherwise). A translated post therefore never reuses the Latvian slug.
slug: "example-english-post"
# Links this post to its Latvian counterpart: set it to the ORIGINAL post's
# slug. The original needs no translationKey - it defaults to its own slug.
# Omit this line entirely for an English-only article; the language switcher then
# falls back to the Latvian home page and no hreflang is emitted.
translationKey: "vilkacu-maratons-2026"
date: 2026-06-22
# Tags are CANONICAL slugs shared across locales: copy the ORIGINAL post's
# tags verbatim (do not translate them). Per-language display names live in
# src/i18n/tags.ts - a new tag gets its labels there.
tags: ["treniņi", "sacensības"]
# Relative to THIS file - one level deeper than a Latvian post, hence ../../../
thumbnail: "../../../assets/thumb-example.jpg"
thumbnailAlt: "Eu anim dolor consectetur" # TODO: real alt text
thumbnailAttribution: "Photo: Eu irure" # TODO: real photo credit (omit if none)
---

<!-- TODO: replace placeholder copy - Dāvis writes the article body. -->

Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Duis aute irure dolor

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus
error sit voluptatem accusantium doloremque laudantium.
