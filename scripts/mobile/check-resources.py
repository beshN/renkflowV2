#!/usr/bin/env python3
"""Fail before compiling if a localized key or formatted copy is missing/corrupt."""
from pathlib import Path
import re,json,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
android=root/'apps/native-android/app/src/main'
resources={item.attrib['name']:item.text or '' for item in ET.parse(android/'res/values/strings.xml').getroot()}
assert len(resources)==len(ET.parse(android/'res/values/strings.xml').getroot()),'Duplicate Android resource'
for file in (android/'java').rglob('*.kt'):
 for key in re.findall(r'R\.string\.(\w+)',file.read_text()):assert key in resources,f'{file}: missing {key}'
ios=root/'apps/native-ios/RenkflowField'
entries={}
for line in (ios/'tr.lproj/Localizable.strings').read_text().splitlines():
 match=re.fullmatch(r'("(?:[^"\\]|\\.)*") = ("(?:[^"\\]|\\.)*");',line)
 if match:
  key,value=map(json.loads,match.groups());assert key not in entries,f'duplicate {key}';entries[key]=value
for file in ios.rglob('*.swift'):
 for key in re.findall(r'\bL\("([^"]+)"',file.read_text()):assert key in entries,f'{file}: missing {key}'
print(f'Localized resource references complete: Android {len(resources)}, iOS {len(entries)}')
