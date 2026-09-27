import os

def fix_array_check(filepath, setter_name):
    with open(filepath, 'r') as f:
        content = f.read()

    # Search for `setOrders(data)` or similar and replace with `setOrders(Array.isArray(data) ? data : [])`
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if f"{setter_name}(data)" in line:
            lines[i] = line.replace(f"{setter_name}(data)", f"{setter_name}(Array.isArray(data) ? data : [])")

    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))

fix_array_check('src/app/dashboard/purchases/page.tsx', 'setOrders')
fix_array_check('src/app/dashboard/sales/page.tsx', 'setSales')
fix_array_check('src/app/dashboard/transfers/page.tsx', 'setTransfers')
fix_array_check('src/app/dashboard/reports/page.tsx', 'setSessions')

print("Frontend arrays fixed!")
