log = open('pip_install.log', 'r', encoding='utf-16le').read()
with open('pip_install_utf8.log', 'w', encoding='utf-8') as f:
    f.write(log)
