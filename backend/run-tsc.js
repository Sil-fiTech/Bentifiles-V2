const cp = require('child_process');
try {
    const result = cp.execSync('npx tsc', { encoding: 'utf-8', stdio: 'pipe' });
    console.log('SUCCESS');
    console.log(result);
} catch (e) {
    console.log('FAILED');
    console.log(e.stdout || e.stderr || e.message);
}
