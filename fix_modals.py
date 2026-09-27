import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Fix the backdrop
    content = content.replace(
        'absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50',
        'fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 sm:items-start sm:pt-10 items-center overflow-y-auto p-4'
    )
    
    # 2. Add max-h and overflow to the inner modal window if it has rounded-lg bg-white
    # We will just inject max-h-[90vh] overflow-y-auto into the class list of the inner divs
    # E.g. className="w-[500px] rounded-lg bg-white p-6 shadow-xl"
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'rounded-lg bg-white' in line and 'shadow-xl' in line:
            if 'max-h' not in line:
                lines[i] = line.replace('rounded-lg', 'rounded-lg max-h-[90vh] overflow-y-auto')
    
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))

for root, dirs, files in os.walk('src/app/dashboard'):
    for file in files:
        if file.endswith('.tsx'):
            fix_file(os.path.join(root, file))

print("Modals fixed!")
