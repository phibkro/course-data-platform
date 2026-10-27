"""Parse cached NTNU course pages (.cache/pages/<year>/CODE.html) into one JSON record per course and study year.

Deterministic: section text is taken by heading from the page's fixed template.
Output: .cache/courses.json
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / ".cache/pages"
HEADINGS = ['About the course', 'Course content', 'Learning outcome', 'Learning methods and activities',
            'Compulsory assignments', 'Further on evaluation', 'Specialization courses', 'Required previous knowledge',
            'Recommended previous knowledge', 'Course materials', 'Credit reductions', 'Subject areas', 'Timetable',
            'Examination', 'Version', 'Admission', 'Notes']
CODE = r'[A-ZÆØÅ]{2,}[A-Z0-9-]*\d{3,5}[A-Z]?'


def text(path):
    return text_of(path.read_text(errors='ignore'))


def text_of(s):
    t = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
    t = html.unescape(re.sub(r'<[^>]+>', '\n', t))
    t = re.sub(r'[ \t\xa0]+', ' ', t)
    return re.sub(r'\n\s*\n+', '\n', t)


def field(t, label, nxt):
    m = re.search(re.escape(label) + r'\n(.*?)\n(?:' + '|'.join(map(re.escape, nxt)) + ')', t, flags=re.S)
    return m.group(1).strip().replace('\n', ' ') if m else None


def section(t, label):
    m = re.search(r'\n' + re.escape(label) + r'\n(.*?)\n(?:' + '|'.join(map(re.escape, HEADINGS)) + r')\n', t, flags=re.S)
    return m.group(1).strip().replace('\n', ' ') if m else None


def parse(path):
    return parse_text(path.read_text(errors='ignore'), path.stem, int(path.parent.name))


def parse_text(html_source, code, year):
    t = text_of(html_source)
    m = re.search(r'Course - (.*?) - ' + re.escape(code), t)
    if not m:
        return None
    d = {'code': code, 'year': year, 'name': m.group(1).strip()}
    d['credits'] = field(t, 'Credits', ['Level'])
    d['level'] = field(t, 'Level', ['Course start'])
    d['start'] = field(t, 'Course start', ['Duration'])
    d['language'] = field(t, 'Language of instruction', ['Location'])
    d['location'] = field(t, 'Location', ['Examination arrangement', 'About'])
    d['assessment'] = field(t, 'Examination arrangement', ['About'])
    for key, label in [('content', 'Course content'), ('outcomes', 'Learning outcome'),
                       ('methods', 'Learning methods and activities'), ('compulsory', 'Compulsory assignments'),
                       ('further', 'Further on evaluation'), ('required', 'Required previous knowledge'),
                       ('recommended', 'Recommended previous knowledge'), ('subject_areas', 'Subject areas')]:
        d[key] = section(t, label)
    reductions = re.search(r'Credit reductions\n(.*?)\nSubject areas', t, flags=re.S)
    d['reductions'] = [{'code': c, 'credits': float(v), 'from': f.strip() or None}
                       for c, v, f in re.findall(r'(' + CODE + r')\n\s*([\d.]+) sp\n?((?:Autumn|Spring|Summer)?\s*\n?\s*\d{4})?',
                                                 reductions.group(1))] if reductions else []
    i = t.rfind('\nExamination\n')
    d['exam_block'] = t[i:i + 1400].replace('\n', ' | ') if i >= 0 else None
    d['restricted'] = 'Admission to a programme of study is required' in t
    spec = re.search(r'Admission to a programme of study is required:(.*?)\n(?:Required previous knowledge|Course materials|Credit reductions|Subject areas)', t, flags=re.S)
    d['admission_programmes'] = re.findall(r'\(([A-ZÆØÅ0-9/]+)\)', spec.group(1)) if spec else []
    d['not_offered'] = bool(re.search(r'no longer (offered|taught)|not taught', t, re.I))
    return d


if __name__ == '__main__':
    records = [r for p in sorted(PAGES.glob('*/*.html')) if (r := parse(p))]
    (ROOT / '.cache/courses.json').write_text(json.dumps(records, ensure_ascii=False))
    print(len(records), 'course-years parsed;', len({r['code'] for r in records}), 'distinct codes;', sum(bool(r['outcomes']) for r in records), 'with learning outcomes;',
          sum(len(r['reductions']) for r in records), 'credit reductions', file=sys.stderr)
