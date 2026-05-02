import re
c = open('.temp_camu.xml','rb').read().decode('cp949', errors='ignore')
m = re.findall(r'ACODE="([^"]+)"[^>]*>([\d,]+)</TE>', c)
print(set(m))
