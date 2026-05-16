import json
import os

input_path = r'C:\Users\kks37\.gemini\antigravity\brain\9324ebce-27b0-4424-b292-c6274994ee43\.system_generated\logs\overview.txt'
output_path = r'c:\telework\event-tracker\scratch\last_response.md'

os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(input_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    last_content = json.loads(lines[13])['content']
    
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(last_content)
