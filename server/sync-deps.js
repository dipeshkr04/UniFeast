const fs = require('fs');
const { execSync } = require('child_process');

try {
  const reqContent = fs.readFileSync('req.txt', 'utf-8');
  const packageContent = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  // Parse req.txt (format: npm i pkg1 pkg2 --flags)
  const parts = reqContent.replace(/[\r\n]+/g, ' ').split(' ').filter(Boolean);

  let packages = [];
  let flags = [];
  parts.forEach(p => {
    if (p === 'npm' || p === 'i' || p === 'install') return;
    if (p.startsWith('-')) {
      flags.push(p);
    } else {
      packages.push(p);
    }
  });

  const currentDeps = Object.keys(packageContent.dependencies || {});

  const toInstall = packages.filter(p => !currentDeps.includes(p));
  const toRemove = currentDeps.filter(p => !packages.includes(p));

  if (toInstall.length > 0) {
    console.log(`Installing missing packages: ${toInstall.join(', ')}`);
    execSync(`npm install ${toInstall.join(' ')} ${flags.join(' ')}`, { stdio: 'inherit' });
  } else {
    console.log('No missing packages to install. Dependencies are synced.');
  }

  if (toRemove.length > 0) {
    console.log(`Removing extra packages: ${toRemove.join(', ')}`);
    execSync(`npm uninstall ${toRemove.join(' ')}`, { stdio: 'inherit' });
  } else {
    console.log('No extra packages to remove.');
  }
} catch (error) {
  console.error("Error syncing dependencies:", error.message);
}
