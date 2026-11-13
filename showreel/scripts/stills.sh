#!/bin/sh
# Renders the review stills for both formats into out/stills/.
cd "$(dirname "$0")/.." || exit 1
npx remotion bundle --out-dir=build >/dev/null || exit 1
for comp in ShowreelLandscape ShowreelPortrait; do
  for frame in 15 110 270 450 630 760 880; do
    echo "$comp $frame"
  done
done | xargs -P 4 -n 2 sh -c 'npx remotion still build "$0" "out/stills/$0-$(printf %03d "$1").png" --frame="$1" --log=error'
