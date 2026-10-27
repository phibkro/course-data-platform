"""Test harness: feed synthetic re-fetches of one course page into the evidence store.

  cosmetic  same page plus an HTML comment (as when a CMS stamps a render time)
  edit      one sentence added to the course content
  revert    the original bytes again
Each adds a fetch row with a newer fetched_at; nothing upstream is contacted.
"""
import sys
from store import Store

KEY = 'TDT4173/2026'
mode = sys.argv[1]
s = Store()
first = s.db.execute("select hash from fetches where source='ntnu-course-page' and key=? order by fetched_at asc limit 1", [KEY]).fetchall()[0][0]
html = s.get_evidence(first).decode('utf8')
if mode == 'cosmetic':
    body = html.replace('</body>', '<!-- rendered 2026-10-27T12:00 -->\n</body>')
elif mode == 'edit':
    marker = 'Course content'
    i = html.find(marker)
    j = html.find('<p>', i)
    assert i > 0 and j > 0, 'content section not found'
    body = html[:j + 3] + 'This year the course adds a module on graph neural networks for course recommendation. ' + html[j + 3:]
elif mode == 'revert':
    body = html
print(mode, s.put_evidence(body.encode('utf8'), url=f'https://www.ntnu.edu/studies/courses/TDT4173/2026', source='ntnu-course-page', key=KEY)[:12])
