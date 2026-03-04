# freeciv-img-extract

Extracts images from the Freeciv tileset data and generates optimized tileset
PNG files and JavaScript specification files for use by the Freeciv-web client.

## Files

* **img-extract.py** – Python script that reads Freeciv `.spec` files for the
  `amplio2` and `trident` tilesets, crops individual tile images from the source
  PNG sheets, and packs them into combined tileset images together with a
  JavaScript mapping that records each tile's position, size, and image index.

* **sync.sh** – Bash wrapper that runs `img-extract.py` and then copies the
  generated outputs to the correct locations inside the `freeciv-web` webapp
  directory.  It also copies flag `.svg` files from the Freeciv data directory.

## Requirements

* Python 3
* [Pillow](https://python-pillow.org/) (`pip install Pillow`)
* A checkout of the original [Freeciv](https://www.freeciv.org/) project (for
  the tileset data files)

## Usage

```bash
bash scripts/freeciv-img-extract/sync.sh \
  -f /path/to/freeciv \
  -o /path/to/freeciv-web/src/main/webapp
```

| Flag | Description |
|------|-------------|
| `-f` | Path to the (original) Freeciv project root |
| `-o` | Path to the `freeciv-web` webapp output directory |

You can also call `img-extract.py` directly:

```bash
python3 scripts/freeciv-img-extract/img-extract.py \
  -f /path/to/freeciv \
  -o /path/to/output/tileset \
  [-v]
```

The `-v` / `--verbose` flag prints extra progress details while the script runs.

## Output

`img-extract.py` writes all output files into the directory specified by `-o`:

| File | Description |
|------|-------------|
| `freeciv-web-tileset-amplio2-N.png` | Packed tileset image for the *amplio2* tileset (one or more, numbered from 0) |
| `freeciv-web-tileset-trident-N.png` | Packed tileset image for the *trident* tileset |
| `tileset_spec_amplio2.js` | JavaScript object mapping tile tags → `[x, y, w, h, imageIndex]` for amplio2 |
| `tileset_spec_trident.js` | JavaScript object mapping tile tags → `[x, y, w, h, imageIndex]` for trident |

`sync.sh` additionally copies:

* `tileset_spec_*.js` → `<webapp>/javascript/2dcanvas/`
* Flag `.svg` files → `<webapp>/images/flags/`
