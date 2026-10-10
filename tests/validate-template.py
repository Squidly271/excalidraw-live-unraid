#!/usr/bin/env python3
"""Check the public template's actual exposure and installation contract."""
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
t = ET.parse(root / 'templates/excalidraw-live.xml').getroot()
assert t.tag == 'Container' and t.attrib['version'] == '2'
for name in ('Name', 'Repository', 'Overview', 'Category', 'Icon', 'Project', 'Support', 'TemplateURL'):
    assert t.findtext(name), name
assert t.findtext('Network') == 'bridge'
assert t.findtext('Privileged') == 'false'
ports = [x for x in t.findall('Config') if x.attrib['Type'] == 'Port']
assert len(ports) == 1
assert ports[0].attrib['Target'] == '3000' and ports[0].text == '127.0.0.1:3031'
paths = [x for x in t.findall('Config') if x.attrib['Type'] == 'Path']
assert len(paths) == 1 and paths[0].attrib['Target'] == '/data'
assert paths[0].attrib['Mode'] == 'rw'
params = t.findtext('ExtraParams')
for expected in ('--user=99:100', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--restart=unless-stopped'):
    assert expected in params, expected
assert '--privileged' not in params and 'docker.sock' not in ET.tostring(t).decode()
assert ET.parse(root / 'ca_profile.xml').getroot().findtext('Profile').strip()
assert 'Permission is hereby granted' in (root / 'LICENSE').read_text()
print('PASS: template metadata, loopback binding, single appdata mount, non-root hardening and CA profile')
