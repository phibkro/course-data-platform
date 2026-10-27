"""Embed graph data into the viewer. Default: public data/graph.json. --private: include the personal plan."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
src = ROOT / ('.cache/viewer-data.json' if '--private' in sys.argv else 'data/graph.json')
out = ROOT / ('.cache/subject-graph-private.html' if '--private' in sys.argv else 'viewer/dist/subject-graph.html')
out.parent.mkdir(parents=True, exist_ok=True)
html = (ROOT / 'viewer/template.html').read_text().replace('__DATA__', src.read_text().replace('</', '<\\/'))
out.write_text(html)
print(out, len(html) // 1024, 'KB')
