import os

def fix_api_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find where branchId is extracted from session and ensure it falls back to undefined if falsy (null)
    # E.g. `const branchId = (session.user as any).branchId;` -> `const branchId = (session.user as any).branchId || undefined;`
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'const branchId = (session.user as any).branchId;' in line or 'const branchId = (session.user as any)?.branchId;' in line:
            lines[i] = line.replace(';', ' || undefined;')

    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))

for root, dirs, files in os.walk('src/app/api'):
    for file in files:
        if file.endswith('.ts'):
            fix_api_file(os.path.join(root, file))

print("API branchId fixed!")
