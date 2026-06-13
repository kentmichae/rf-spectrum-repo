
import os
screenshots_dir = os.path.join(os.getcwd(), 'docs', 'screenshots')
os.makedirs(screenshots_dir, exist_ok=True)

try:
    import subprocess
    import json
    
    # Use puppeteer-core with system chromium
    subprocess.run(['npm', 'install', 'puppeteer-core'], capture_output=True, text=True, cwd=os.getcwd())
    
    # Now write a node script
    node_script = """
const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    
    const urls = [
        'http://localhost:3001',
        'http://localhost:3001/',
        'http://localhost:3001/observations',
        'http://localhost:3001/map',
        'http://localhost:3001/users',
        'http://localhost:3001/sync',
        'http://localhost:3001/import',
        'http://localhost:3001/settings',
    ];
    
    const names = [
        'login-screen.png',
        'dashboard-screen.png',
        'observations-screen.png',
        'map-screen.png',
        'users-screen.png',
        'sync-screen.png',
        'import-screen.png',
        'settings-screen.png',
    ];
    
    const outDir = '${screenshots_dir}';
    
    for (let i = 0; i < urls.length; i++) {
        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(urls[i], { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
            await page.screenshot({ path: path.join(outDir, names[i]), fullPage: false });
            console.log('Screenshot ' + names[i] + ' taken');
            await page.close();
        } catch (e) {
            console.log('Failed ' + names[i] + ': ' + e.message);
        }
    }
    
    await browser.close();
    console.log('All done!');
})();
"""
    
    # Write the node script
    node_script_path = os.path.join(script_dir, 'capture.js')
    with open(node_script_path, 'w') as nf:
        nf.write(node_script)
    
    # Run the node script
    result = subprocess.run(['node', 'capture.js'], capture_output=True, text=True, cwd=script_dir)
    print('STDOUT:', result.stdout)
    print('STDERR:', result.stderr[-500:] if result.stderr else '')
    print('Return code:', result.returncode)
    
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
