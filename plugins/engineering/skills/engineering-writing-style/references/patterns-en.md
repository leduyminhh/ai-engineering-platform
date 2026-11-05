# Phrases to cut or replace (English)

This table is the single source for `scripts/scan-style.mjs`: each row is a plain phrase, no regex. Keep a
phrase when it is used literally.

## Empty openers

| Cụm | Thay bằng |
|---|---|
| In today's fast-paced world | cut, start with the point |
| In the realm of | in |
| It's important to note that | cut, state the fact |
| It is worth noting that | cut, state the fact |
| Let's dive in | cut |
| Certainly! | cut |
| Great question | cut |
| As an AI language model | cut |
| In this article, we will | state the content directly |
| Without further ado | cut |

## Empty intensifiers

| Cụm | Thay bằng |
|---|---|
| delve | look at, examine |
| game-changer | cut, state the concrete change |
| seamless | cut, or name the step removed |
| robust | cut, or give a measure |
| leverage | use |
| cutting-edge | cut, or name the technology |
| tapestry | cut |
| unlock the power of | cut |
| a testament to | shows |
| ever-evolving | cut |

## Repeated closers

| Cụm | Thay bằng |
|---|---|
| In conclusion | cut when it only restates the body |
| To sum up | cut when it only restates the body |
| I hope this helps | cut |
| Feel free to reach out | cut, or ask one specific question |
| Let me know if you have any questions | cut |
| Happy coding | cut |

## Structural signs

The script does not scan this section; check by eye.

- Groups of three in every sentence ("fast, reliable, and easy") when there are only one or two points.
- "Not only … but also …" used as a template across consecutive sentences.
- Bold everywhere: when many phrases in a paragraph are bold, none stands out.
- Emoji at the start of lines or headings in technical text.
- Bullet points for content that is really continuous prose.
- A closing sentence that restates the body in different words.
- Long sentences of near-equal length with the same rhythm.
