#!/usr/bin/env bash
# optimize-glb.sh
# Applies prune, dedup, and draco to each .glb file in the current directory.

set -e  # Exit on any error
echo "Handling glb files."

for file in *.glb; do
  # Skip if no .glb files found
  [ -e "$file" ] || continue

  echo "Processing $file ..."
  gltf-transform prune dedup draco "$file" "$file"
  gltf-transform dedup "$file" "$file"
  gltf-transform draco "$file" "$file"
done

echo "All done!"
