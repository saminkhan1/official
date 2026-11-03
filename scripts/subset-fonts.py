#!/usr/bin/env python3
"""
scripts/subset-fonts.py

Subsets, optimizes, and splits web fonts for wengtechno.com:
1. Clamps Cinzel variable font weight axis to [400, 500].
2. Renames internal font family names to comply with SIL OFL Reserved Font Name (RFN) clause.
3. Drops hinting and unneeded OpenType features while preserving kerning and localized forms.
4. Splits each font into:
   - A core file containing ASCII (U+0020-007E) and common punctuation (dashes, curly quotes, ellipsis, nbsp)
   - An extended file containing Latin-1 Supplement and Latin Extended-A
5. Exports compressed WOFF2 files and computes exact unicode-range descriptors.

To run:
  python3 scripts/subset-fonts.py
When to rerun:
  Rerun whenever new typography weights or non-Latin glyphs are added to the website.
"""

import os
import sys
import tempfile
import fontTools.varLib.instancer as instancer
from fontTools.ttLib import TTFont
import fontTools.subset as subset

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
FONTS_DIR = os.path.join(REPO_DIR, "fonts")
MASTER_DIR = os.path.join(REPO_DIR, "fonts", "master")

os.makedirs(FONTS_DIR, exist_ok=True)
os.makedirs(MASTER_DIR, exist_ok=True)

def unicode_list_to_ranges(codepoints):
    sorted_cps = sorted(codepoints)
    if not sorted_cps:
        return ""
    ranges = []
    start = sorted_cps[0]
    prev = start
    for cp in sorted_cps[1:]:
        if cp == prev + 1:
            prev = cp
        else:
            if start == prev:
                ranges.append(f"U+{start:04X}")
            else:
                ranges.append(f"U+{start:04X}-{prev:04X}")
            start = cp
            prev = cp
    if start == prev:
        ranges.append(f"U+{start:04X}")
    else:
        ranges.append(f"U+{start:04X}-{prev:04X}")
    return ", ".join(ranges)

def rename_font(font, new_family, new_full_name, new_ps_name):
    """Update name table records to satisfy SIL OFL Reserved Font Name requirements."""
    if "name" not in font:
        return
    name_table = font["name"]
    # nameIDs: 1 = Family, 4 = Full Name, 6 = PostScript Name, 16 = Typographic Family
    for rec in name_table.names:
        if rec.nameID == 1:
            rec.string = new_family.encode(rec.getEncoding())
        elif rec.nameID == 4:
            rec.string = new_full_name.encode(rec.getEncoding())
        elif rec.nameID == 6:
            rec.string = new_ps_name.encode(rec.getEncoding())
        elif rec.nameID == 16:
            rec.string = new_family.encode(rec.getEncoding())

def process_fonts():
    # Character sets
    # Core: ASCII + nbsp + hyphens/dashes + curly quotes + ellipsis
    core_unicodes = set(range(0x20, 0x7F)) | {
        0xA0, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015,
        0x2018, 0x2019, 0x201C, 0x201D, 0x2026
    }
    # Extended: Latin-1 Supplement + Latin Extended-A
    ext_unicodes = (set(range(0xA1, 0x100)) | set(range(0x100, 0x180))) - core_unicodes

    core_str = unicode_list_to_ranges(core_unicodes)
    ext_str = unicode_list_to_ranges(ext_unicodes)

    font_configs = [
        {
            "id": "cinzel",
            "master_ttf": "Cinzel-Variable.ttf",
            "is_variable": True,
            "axis_limits": {"wght": (400, 500)},
            "new_family": "Cinzel Weng",
            "new_full": "Cinzel Weng Regular",
            "new_ps": "CinzelWeng-Regular",
            "layout_features": "kern,locl,mark",
            "core_file": "cinzel-core.woff2",
            "ext_file": "cinzel-ext.woff2"
        },
        {
            "id": "cinzel-decorative-bold",
            "master_ttf": "CinzelDecorative-Bold.ttf",
            "is_variable": False,
            "new_family": "Cinzel Decorative Weng",
            "new_full": "Cinzel Decorative Weng Bold",
            "new_ps": "CinzelDecorativeWeng-Bold",
            "layout_features": "kern",
            "core_file": "cinzel-decorative-bold-core.woff2",
            "ext_file": "cinzel-decorative-bold-ext.woff2"
        },
        {
            "id": "della-respira",
            "master_ttf": "DellaRespira-Regular.ttf",
            "is_variable": False,
            "new_family": "Della Respira Weng",
            "new_full": "Della Respira Weng Regular",
            "new_ps": "DellaRespiraWeng-Regular",
            "layout_features": "kern",
            "core_file": "della-respira-core.woff2",
            "ext_file": "della-respira-ext.woff2"
        }
    ]

    results = []

    for cfg in font_configs:
        master_path = os.path.join(MASTER_DIR, cfg["master_ttf"])
        if not os.path.exists(master_path):
            raise FileNotFoundError(f"Master font file not found: {master_path}")

        font = TTFont(master_path)
        
        # Clamp variable axis if applicable
        if cfg.get("is_variable") and cfg.get("axis_limits"):
            font = instancer.instantiateVariableFont(font, cfg["axis_limits"])

        # Rename to respect SIL OFL RFN
        rename_font(font, cfg["new_family"], cfg["new_full"], cfg["new_ps"])

        # Save temporary prepared TTF for pyftsubset
        with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
            tmp_path = tmp.name
        font.save(tmp_path)

        # 1. Core subset
        core_out_path = os.path.join(FONTS_DIR, cfg["core_file"])
        cmd_core = [
            tmp_path,
            f"--unicodes={core_str}",
            "--flavor=woff2",
            "--no-hinting",
            "--desubroutinize",
            f"--layout-features={cfg['layout_features']}",
            f"--output-file={core_out_path}"
        ]
        subset.main(cmd_core)

        # 2. Ext subset
        ext_out_path = os.path.join(FONTS_DIR, cfg["ext_file"])
        cmd_ext = [
            tmp_path,
            f"--unicodes={ext_str}",
            "--flavor=woff2",
            "--no-hinting",
            "--desubroutinize",
            f"--layout-features={cfg['layout_features']}",
            f"--output-file={ext_out_path}"
        ]
        subset.main(cmd_ext)

        # Remove temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

        # Inspect resulting files
        core_font = TTFont(core_out_path)
        ext_font = TTFont(ext_out_path)

        core_cmap = core_font.getBestCmap()
        ext_cmap = ext_font.getBestCmap()

        core_range_exact = unicode_list_to_ranges(core_cmap.keys())
        ext_range_exact = unicode_list_to_ranges(ext_cmap.keys())

        results.append({
            "id": cfg["id"],
            "core_file": cfg["core_file"],
            "core_bytes": os.path.getsize(core_out_path),
            "core_glyphs": len(core_font.getGlyphOrder()),
            "core_range": core_range_exact,
            "ext_file": cfg["ext_file"],
            "ext_bytes": os.path.getsize(ext_out_path),
            "ext_glyphs": len(ext_font.getGlyphOrder()),
            "ext_range": ext_range_exact
        })

    return results

if __name__ == "__main__":
    print("Running font optimization and subsetting pipeline...")
    res = process_fonts()
    print("\n=== GENERATED FONT SUBSETS REPORT ===")
    total_core = sum(r["core_bytes"] for r in res)
    total_ext = sum(r["ext_bytes"] for r in res)
    for r in res:
        print(f"\nFont: {r['id']}")
        print(f"  Core File: {r['core_file']} ({r['core_bytes']} bytes, {r['core_glyphs']} glyphs)")
        print(f"    unicode-range: {r['core_range']}")
        print(f"  Ext File:  {r['ext_file']} ({r['ext_bytes']} bytes, {r['ext_glyphs']} glyphs)")
        print(f"    unicode-range: {r['ext_range']}")
    print(f"\nTotal Core Payload (preloaded): {total_core} bytes ({total_core / 1024:.2f} KB)")
    print(f"Total Extended Payload (lazy):   {total_ext} bytes ({total_ext / 1024:.2f} KB)")
